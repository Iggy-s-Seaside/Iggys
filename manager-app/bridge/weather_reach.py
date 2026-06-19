"""Weather × reservation cross-signal — bridge side.

A faithful Python port of the manager app's worth-bar (manager-app/src/lib/weatherWatch.ts,
verified there against a 36-case spec). The app computes these flags client-side for the
dashboard panel; here the BRIDGE computes them server-side so an ACTION flag becomes a real
luna_insights reach (data.reach=true) — which shows in the in-app banner AND can phone-push
(web-push), so Luna's "I'll see rain coming and ping him" reaches Bradley even with the app closed.

Luna's binding worth-bar: a flag surfaces only if (1) within 48h, (2) a meaningful deviation
(>=60% rain, or >=80F heat spike on this cool coast), AND (3) it points to a specific action.
Reach bounds: owner-ping only (ACTION flags, never the soft 'plan' deck nudge), and we never
re-ping the same concern (deduped by reach_kind in a trailing window).

compute_weather_flags() is pure + deterministic (takes `now`) so it's unit-testable.
"""

import json
import re
import os
import urllib.request
from datetime import datetime, timedelta

try:
    from zoneinfo import ZoneInfo
    _PACIFIC = ZoneInfo("America/Los_Angeles")
except Exception:  # pragma: no cover
    _PACIFIC = None

# ── thresholds (the "meaningful deviation") ──
HEAT_F = 80
RAIN_PCT = 60
WINDOW_HOURS = 48
DECK_WARM_F = 65
WEEKEND = {5, 6, 0}  # JS-style weekday: Fri, Sat, Sun (when the deck carries the night)
FOH_ROLES = {"server", "bartender", "barback"}
MIN_BASELINE_SAMPLES = 3

# Unambiguous outdoor-seating terms — safe to scan in any free-text field.
OUTDOOR_STRONG_RE = re.compile(
    r"\b(deck|patio|outdoor|outdoors|terrace|rooftop|roof\s?top|courtyard|al\s?fresco|sidewalk)\b", re.I)
# Ambiguous tokens that only mean a place to seat guests with context — never scanned in
# food/drink notes, where "garden salad" / "outside vendor" / "beachside garnish" are menu words.
OUTDOOR_WEAK_RE = re.compile(
    r"\b(garden|outside|beach\s?(?:deck|front\s+(?:seating|patio)|side\s+(?:seating|table)))\b", re.I)


def _log(msg):
    print(f"weather_reach: {msg}", flush=True)


# ── pure helpers ──

def pacific_now():
    if _PACIFIC is not None:
        return datetime.now(_PACIFIC).replace(tzinfo=None)
    return datetime.utcnow() - timedelta(hours=8)  # crude fallback


def ymd(d):
    return d.strftime("%Y-%m-%d")


def js_weekday(d):
    """date -> JS getDay() convention (Sun=0..Sat=6)."""
    return (d.weekday() + 1) % 7


def _day_start(date_str):
    return datetime.strptime(date_str, "%Y-%m-%d")


def hours_to_day_start(date_str, now):
    return (_day_start(date_str) - now).total_seconds() / 3600.0


def hours_to_event(date_str, start_min, now):
    base = _day_start(date_str) + timedelta(minutes=(start_min or 0))
    return (base - now).total_seconds() / 3600.0


def day_word(date_str, now):
    today = ymd(now)
    tomorrow = ymd(now + timedelta(days=1))
    if date_str == today:
        return "today"
    if date_str == tomorrow:
        return "tomorrow"
    try:
        return _day_start(date_str).strftime("%A")
    except Exception:
        return date_str


def party_label(p):
    name = (p.get("contact_name") or p.get("company") or "").strip()
    if name:
        return f"the {name} party"
    if p.get("space_name"):
        return f"the {p['space_name']} booking"
    return "the booking"


def is_outdoor_party(p):
    strong = [p.get("space_name"), p.get("special_requests"), p.get("food_notes"),
              p.get("drink_notes"), p.get("internal_notes")]
    if any(f and OUTDOOR_STRONG_RE.search(f) for f in strong):
        return True
    weak = [p.get("space_name"), p.get("special_requests"), p.get("internal_notes")]
    return any(f and OUTDOOR_WEAK_RE.search(f) for f in weak)


def is_high_demand(day, demand):
    band = (demand or {}).get(day["date"])
    if band in ("BUSY", "PACKED"):
        return True
    return day["weekday"] in WEEKEND


def compute_weather_flags(now, daily, parties, staffing, demand):
    """Return the actionable flags. Each: {id, kind, severity, date, message, deep_link}."""
    flags = []
    by_date = {d["date"]: d for d in daily}

    # (1) RAIN × an outdoor booking → move it indoors. Confirmed bookings only.
    for p in parties:
        if p.get("status") != "confirmed" or not p.get("event_date"):
            continue
        h = hours_to_event(p["event_date"], p.get("start_min"), now)
        if h < 0 or h > WINDOW_HOURS:
            continue
        day = by_date.get(p["event_date"])
        if not day or day["precip"] < RAIN_PCT:
            continue
        if not is_outdoor_party(p):
            continue
        flags.append({
            "id": f"rain-party-{p['id']}",
            "kind": "rain_party_indoor", "severity": "action", "date": p["event_date"],
            "message": f"{day['precip']}% rain {day_word(p['event_date'], now)} — move {party_label(p)} indoors.",
            "deep_link": f"/parties/{p['id']}",
        })

    # Day-level flags walk the forecast window (today -> +48h on the day's start).
    for day in daily:
        to_start = hours_to_day_start(day["date"], now)
        if to_start >= WINDOW_HOURS or to_start <= -24:
            continue
        high_demand = is_high_demand(day, demand)
        is_today = day["date"] == ymd(now)
        too_late_staff = is_today and now.hour >= 19
        too_late_special = is_today and now.hour >= 17

        # (2) HEAT SPIKE × understaffing → call in a hand. Only with a known typical.
        if day["high"] >= HEAT_F and high_demand and not too_late_staff:
            s = (staffing or {}).get(day["date"])
            if s and s.get("baseline") is not None and s["foh"] < s["baseline"]:
                who = "no one on the floor" if s["foh"] == 0 else f"only {s['foh']} on the floor"
                flags.append({
                    "id": f"heat-{day['date']}",
                    "kind": "heat_understaffed", "severity": "action", "date": day["date"],
                    "message": f"{day['high']}° and a beach crowd {day_word(day['date'], now)} — {who}; call in a hand.",
                    "deep_link": "/schedule",
                })

        # (3) RAIN × the deck on a warm weekend that would otherwise have filled → a plan.
        if (day["precip"] >= RAIN_PCT and day["weekday"] in WEEKEND and day["high"] >= DECK_WARM_F
                and (demand or {}).get(day["date"]) != "SLOW" and not too_late_special):
            flags.append({
                "id": f"rain-deck-{day['date']}",
                "kind": "rain_deck", "severity": "plan", "date": day["date"],
                "message": f"Rain'll keep the deck empty {day_word(day['date'], now)} — post a cozy indoor special.",
                "deep_link": "/specials/editor",
            })

    # A specific "move indoors" beats a general deck plan on the same day.
    action_dates = {f["date"] for f in flags if f["kind"] == "rain_party_indoor"}
    deduped = [f for f in flags if not (f["kind"] == "rain_deck" and f["date"] in action_dates)]
    rank = {"action": 0, "plan": 1}
    deduped.sort(key=lambda f: (rank[f["severity"]], f["date"]))
    return deduped[:3]


def reach_concern_key(flag):
    return f"weather:{flag['kind']}:{flag['date']}"


# ── data fetch (server-side) ──

def _om_forecast_url(lat, lon, days=3):
    return ("https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            "&daily=temperature_2m_max,precipitation_probability_max,weather_code"
            "&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles"
            f"&forecast_days={days}")


def _http_get_json(url, timeout=12):
    req = urllib.request.Request(url, headers={"User-Agent": "iggys-bridge/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


SEASIDE_LAT, SEASIDE_LON = 45.9929, -123.9229


def fetch_forecast_window():
    j = _http_get_json(_om_forecast_url(SEASIDE_LAT, SEASIDE_LON, 3))
    d = j.get("daily", {})
    dates = d.get("time") or []
    out = []
    for i, ds in enumerate(dates):
        try:
            wd = js_weekday(_day_start(ds).date())
        except Exception:
            continue
        out.append({
            "date": ds, "weekday": wd,
            "high": round(d.get("temperature_2m_max", [0])[i] or 0),
            "precip": round(d.get("precipitation_probability_max", [0])[i] or 0),
            "code": round(d.get("weather_code", [0])[i] or 0),
        })
    return out


def fetch_window_parties(conn, window_dates):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, status, event_date, start_min, guest_count, contact_name, company, "
            "space_name, special_requests, food_notes, drink_notes, internal_notes "
            "FROM parties WHERE status = 'confirmed' AND event_date = ANY(%s::date[])",
            (window_dates,),
        )
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    for r in rows:
        if r.get("event_date") is not None:
            r["event_date"] = r["event_date"].strftime("%Y-%m-%d")
    return rows


def fetch_window_demand(conn, window_dates):
    out = {}
    with conn.cursor() as cur:
        cur.execute("SELECT business_day, predicted_band FROM demand_log WHERE business_day = ANY(%s::date[])", (window_dates,))
        for bd, band in cur.fetchall():
            out[bd.strftime("%Y-%m-%d")] = band
    return out


def _median(nums):
    s = sorted(nums)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else round((s[mid - 1] + s[mid]) / 2)


def fetch_window_staffing(conn, window_dates, today_str):
    """Per window-day FOH headcount + the historical typical for that weekday — published
    shifts only, baseline only from past nights the floor actually ran. Degrades to empty
    (heat flag stays silent) if the schedule isn't readable."""
    hist_start = (_day_start(today_str) - timedelta(days=35)).strftime("%Y-%m-%d")
    window_end = max(window_dates)
    any_by_date = {}
    foh_by_date = {}
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT sh.date, sh.staff_id, st.role FROM shifts sh JOIN staff st ON st.id = sh.staff_id "
                "WHERE sh.published = true AND sh.date BETWEEN %s::date AND %s::date",
                (hist_start, window_end),
            )
            for d, staff_id, role in cur.fetchall():
                ds = d.strftime("%Y-%m-%d")
                any_by_date[ds] = any_by_date.get(ds, 0) + 1
                if (role or "").lower() in FOH_ROLES:
                    foh_by_date.setdefault(ds, set()).add(staff_id)
    except Exception as e:
        _log(f"staffing query failed ({e}); heat-understaffing flag will stay silent")
        return {}

    foh_count = lambda ds: len(foh_by_date.get(ds, ()))
    hist_by_weekday = {}
    for ds, cnt in any_by_date.items():
        if cnt <= 0 or ds >= today_str:
            continue
        foh = foh_count(ds)
        if foh <= 0:
            continue
        wd = js_weekday(_day_start(ds).date())
        hist_by_weekday.setdefault(wd, []).append(foh)

    def baseline(wd):
        samples = hist_by_weekday.get(wd)
        return _median(samples) if samples and len(samples) >= MIN_BASELINE_SAMPLES else None

    staffing = {}
    for ds in window_dates:
        has_schedule = any_by_date.get(ds, 0) > 0
        wd = js_weekday(_day_start(ds).date())
        staffing[ds] = {"foh": foh_count(ds), "baseline": baseline(wd) if has_schedule else None}
    return staffing


# ── raise reach + fire push ──

def fire_web_push(title, body, url):
    base = os.environ.get("SUPABASE_URL")
    key = (os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("WEB_PUSH_BEARER")
           or os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
    if not base or not key:
        _log("web-push not configured (no SUPABASE_URL / key); insight raised, push skipped")
        return
    try:
        req = urllib.request.Request(
            f"{base.rstrip('/')}/functions/v1/web-push",
            data=json.dumps({"title": title, "body": body, "url": url}).encode("utf-8"),
            headers={"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            _log(f"web-push -> HTTP {r.status}")
    except Exception as e:
        _log(f"web-push failed: {e}")


# Don't re-ping the same concern. A weather fact about a specific day doesn't change, so
# once we've reached out about it, stay quiet for a day (covers its whole 48h relevance).
REACH_DEDUP_HOURS = 12


def run_weather_reach(conn):
    """One tick: compute the cross-signal and raise a reach (in-app banner + push) for any
    NEW action flag. Safe to call often — per-concern dedup keeps it from re-pinging."""
    try:
        now = pacific_now()
        daily = fetch_forecast_window()
        if not daily:
            _log("no forecast; skipping")
            return
        window_dates = [d["date"] for d in daily]
        today_str = ymd(now)
        parties = fetch_window_parties(conn, window_dates)
        demand = fetch_window_demand(conn, window_dates)
        staffing = fetch_window_staffing(conn, window_dates, today_str)
        flags = compute_weather_flags(now, daily, parties, staffing, demand)
        actions = [f for f in flags if f["severity"] == "action"]
        if not actions:
            return
        raised = 0
        with conn.cursor() as cur:
            for f in actions:
                kind = reach_concern_key(f)
                cur.execute(
                    "SELECT 1 FROM luna_insights WHERE created_at > now() - interval '%s hours' "
                    "AND data->>'reach' = 'true' AND data->>'reach_kind' = %s LIMIT 1",
                    (REACH_DEDUP_HOURS, kind),
                )
                if cur.fetchone():
                    continue
                data = {
                    "reach": True, "reach_kind": kind, "deep_link": f["deep_link"],
                    "weather_flag": f["kind"],
                    "action": {"type": "navigate", "label": "Take a look", "deep_link": f["deep_link"]},
                }
                cur.execute(
                    "INSERT INTO luna_insights (kind, title, body, status, data) "
                    "VALUES ('alert', %s, %s, 'new', %s::jsonb)",
                    (f["message"], "", json.dumps(data)),
                )
                raised += 1
                _log(f"reached out ({kind}) — {f['message']!r}")
        conn.commit()
        # Fire push AFTER commit so a dead push endpoint can't roll back the insight.
        if raised:
            for f in actions:
                fire_web_push("Luna reached out", f["message"], f["deep_link"])
    except Exception as e:
        _log(f"failed: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
