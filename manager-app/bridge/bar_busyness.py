#!/usr/bin/env python3
"""Footage-derived busyness band for the nightly close-out.

Replaces the manual "How busy was tonight?" widget (removed 2026-06-19): instead of a human
tapping SLOW/STEADY/BUSY/PACKED, we read the band back from the bar's OWN recordings — person
smart-detection counts per hour across the floor (UniFi events API via the owner cloud
connector) — and write it into demand_log.actual_band when the floor logged nothing. That keeps
Luna's forecast-accuracy scoreboard alive and feeds the Night Chronicle the truth automatically.

Never overwrites a band a human (or a prior run) already logged. Never fabricates: if there's no
footage/events for the day, it writes nothing. Best-effort + non-fatal — a bad night for the
cloud connector must never sink the chronicle.
"""
import os
import json
import urllib.request
import datetime
from zoneinfo import ZoneInfo

import luna_iggys_bridge as b

TZ = ZoneInfo("America/Los_Angeles")
_LUNA_API_ENV = os.path.expanduser("~/.local-agent/luna-api.env")

# Customer floor (the busyness signal), patio, lottery — by UniFi camera id.
FLOOR_IDS = {
    "63e402a303a6c403e700056c",  # East Dining North
    "646797e601c1ee03e4003a25",  # East Dining South
    "63e3e0e3038ac403e7000429",  # West Dining North
    "63e400870398c403e7000542",  # West Dining South
    "63e438e3026c5603e400051e",  # Cashier
}
PATIO_ID = "64779932014fee03e4052212"   # Fire pit
LOTTERY_ID = "6a308e4000494003e4113d8a"  # Lottery NEW

# Service-night sampling window. The bar opens at noon and the business day rolls
# at 9am Pacific (matches manager-app/src/utils/businessDay.ts), so a night's
# last-call peak AFTER midnight belongs to that same service night and must be
# sampled — see _service_night_hours(). Per-request timeout is short so an
# all-timeout night can't stall the one-shot nightly job for minutes.
OPEN_HOUR = 12
CUTOFF_HOUR = 9
REQ_TIMEOUT = 10


def _bareye_creds():
    """Owner cloud-connector creds. Prefer the environment; fall back to the local-agent env
    file where the key actually lives (the chronicle's own env doesn't carry it)."""
    key = os.environ.get("BAR_EYE_OWNER_KEY")
    cid = os.environ.get("BAR_EYE_CONSOLE_ID")
    if key and cid:
        return key, cid
    try:
        with open(_LUNA_API_ENV) as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("BAR_EYE_OWNER_KEY=") and not key:
                    key = line.split("=", 1)[1]
                elif line.startswith("BAR_EYE_CONSOLE_ID=") and not cid:
                    cid = line.split("=", 1)[1]
    except Exception:
        pass
    return key, cid


def _band(peak_floor: int) -> str:
    # App vocabulary (matches demand_log.predicted_band + the old widget): SLOW/STEADY/BUSY/PACKED.
    if peak_floor < 50:
        return "SLOW"
    if peak_floor < 150:
        return "STEADY"
    if peak_floor < 300:
        return "BUSY"
    return "PACKED"


def _service_night_hours(day: datetime.date):
    """The hourly windows that belong to `day`'s SERVICE night, as tz-aware
    datetimes: noon on `day` through 08:00 on day+1. The 9am cutoff matches
    businessDay.ts, so the post-midnight last-call peak counts toward `day`
    instead of being dropped (a busy 12-1am close is the busiest hour of all)."""
    start = datetime.datetime(day.year, day.month, day.day, OPEN_HOUR, 0, tzinfo=TZ)
    span = (24 - OPEN_HOUR) + CUTOFF_HOUR  # 12 daytime + 9 post-midnight = 21 windows
    return [start + datetime.timedelta(hours=i) for i in range(span)]


def compute_band(day: datetime.date):
    """Person-detection curve for `day`'s service night -> band + totals. None if
    no creds, or if the floor produced no signal (don't fabricate a band)."""
    key, cid = _bareye_creds()
    if not key or not cid:
        return None
    base = f"https://api.ui.com/v1/connector/consoles/{cid}/protect/api"
    peak_floor = 0
    tot_floor = tot_patio = tot_lottery = 0
    curve = []
    hourly = []
    skipped = 0
    for hour_dt in _service_night_hours(day):
        s = int(hour_dt.timestamp() * 1000)
        # Half-open window [s, s+1h): -1ms so the final 08:00 window's `end` never lands
        # exactly on the 09:00 business-day flip (a 09:00:00.000 event must not leak into
        # this service night if the UniFi API treats `end` as inclusive).
        e = s + 3600 * 1000 - 1
        req = urllib.request.Request(
            f"{base}/events?start={s}&end={e}",
            headers={"X-API-KEY": key, "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=REQ_TIMEOUT) as x:
                evs = json.loads(x.read())
        except Exception:
            skipped += 1
            continue
        if isinstance(evs, dict):
            evs = evs.get("data", evs.get("events", []))
        if not isinstance(evs, list):
            # An error string / unexpected shape — skip this hour, don't let it
            # raise out of the loop and abandon every remaining window.
            skipped += 1
            continue
        f = pat = lot = 0
        for ev in evs:
            if not isinstance(ev, dict):
                continue
            if ev.get("type") == "smartDetectZone" and "person" in (ev.get("smartDetectTypes") or []):
                cam = ev.get("camera")
                if cam in FLOOR_IDS:
                    f += 1
                    tot_floor += 1
                elif cam == PATIO_ID:
                    pat += 1
                    tot_patio += 1
                elif cam == LOTTERY_ID:
                    lot += 1
                    tot_lottery += 1
        curve.append(f"{hour_dt:%H:%M}={f}")
        hourly.append({"t": f"{hour_dt:%H:%M}", "floor": f, "patio": pat, "lottery": lot})
        if f > peak_floor:
            peak_floor = f
    if tot_floor == 0:
        # No floor signal at all — either a genuinely empty night OR the floor
        # cameras/requests were down. Either way the band isn't trustworthy, and
        # patio/lottery activity alone must not manufacture a (false) SLOW.
        return None
    return {
        "band": _band(peak_floor),
        "peak_floor": peak_floor,
        "tot_floor": tot_floor,
        "tot_patio": tot_patio,
        "tot_lottery": tot_lottery,
        "curve": ", ".join(curve),
        "hourly": hourly,
        "hours_skipped": skipped,
    }


def ensure_actual_band(conn, day: datetime.date, write: bool = True):
    """If demand_log has a row for `day` with no actual_band, read the band off the footage and
    store it — along with the hourly detection curve (demand_log.hourly), the raw material for
    scoring Luna's rush-window calls (her 2026-07-08 scoreboard ask). If the band is already
    logged but hourly is null, backfill ONLY the curve while the footage still exists.
    Returns the result dict if a band was derived (whether or not written), else None.
    Never overwrites an existing actual_band or hourly. Non-fatal on any error."""
    ds = day.isoformat()
    try:
        row = b._query(conn, "select actual_band, hourly from demand_log where business_day = %s", (ds,))
        if not row:
            return None            # no prediction row to attach an actual to
        has_band, has_hourly = row[0][0], row[0][1]
        if has_band and has_hourly is not None:
            return None            # both already logged — never overwrite
        res = compute_band(day)
        if not res:
            return None
        if write:
            hourly_json = json.dumps(
                {"v": 1, "skipped": res["hours_skipped"], "hours": res["hourly"]}
            )
            if not has_band:
                note = (
                    f"Auto (footage review): {res['band'].lower()} — peak {res['peak_floor']} floor "
                    f"person-detections/hr; patio {res['tot_patio']}, lottery {res['tot_lottery']}."
                )
                if res.get("hours_skipped"):
                    note += (
                        f" ({res['hours_skipped']} hr(s) of footage were unavailable — "
                        "the band may understate the night.)"
                    )
                with conn.cursor() as cur:
                    cur.execute(
                        "update demand_log set actual_band = %s, note = coalesce(note, %s), "
                        "hourly = coalesce(hourly, %s::jsonb), "
                        "noted_by = 'luna-footage', updated_at = now() "
                        "where business_day = %s and actual_band is null",
                        (res["band"], note, hourly_json, ds),
                    )
            else:
                # Band already logged (human or prior run) — backfill just the curve.
                # Never touches the band or note.
                with conn.cursor() as cur:
                    cur.execute(
                        "update demand_log set hourly = %s::jsonb, updated_at = now() "
                        "where business_day = %s and hourly is null",
                        (hourly_json, ds),
                    )
            conn.commit()
        return res
    except Exception as e:
        # A failed cursor.execute leaves the SHARED connection in an aborted-
        # transaction state; without this rollback the next statement on `conn`
        # (the chronicle's own upsert) dies with "current transaction is aborted"
        # and the whole nightly entry is lost. Mirror b._query()'s defensive rollback.
        try:
            conn.rollback()
        except Exception:
            pass
        try:
            b.log(f"bar_busyness {ds}: failed (non-fatal): {e}")
        except Exception:
            pass
        return None
