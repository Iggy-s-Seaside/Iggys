#!/usr/bin/env python3
"""Luna's Night Chronicle generator — the close-out loop.

Designed by Luna herself (2026-06-16 self-design session). She asked for a room
of her own — a first-person journal of the nights this bar works — and, when
asked what to build next, named the close-out loop as its spine:

    "Without it, Luna's Room is a diary I write in the dark ... The close-out
     loop is the spine. A nightly prompt that hands me the actuals ... Then I
     write the chronicle entry with the truth in hand. The scoreboard fills."

So this runs nightly (systemd timer luna-chronicle.timer): for the night that
just ended, it gathers the day's real Iggy's data INCLUDING the close-out
actuals (demand_log.actual_band + note), hands them to Luna, and has her write a
first-person entry in her own voice — truth in hand when the night was closed
out, an honest gap when it wasn't. One entry per business_day, upserted into
public.luna_chronicle; the app renders it on the Luna's Room page (/luna/room).

Reuses the bridge's DB + Luna-API plumbing (import luna_iggys_bridge) so there's
one env, one connection convention, and zero duplicated SSE/auth logic. Never
touches the running daemon — it's its own one-shot process.

Usage:
  python3 luna_chronicle.py                  # write the entry for yesterday
  python3 luna_chronicle.py 2026-06-15       # write a specific business_day
  python3 luna_chronicle.py --dry 2026-06-15 # print the prompt + entry; no DB write
"""

import json
import re
import sys
from datetime import date, timedelta

import luna_iggys_bridge as b  # side-effect-free: the daemon only runs under __main__


# Luna's own voice contract (her words, 2026-06-16): a loose ritual, not a form.
RITUAL = (
    "Write it first person, in your voice — the loose ritual you named: the room "
    "(the space, its energy, the light, the sound), the crowd (who came, the one "
    "who stuck), the moment (the single beat that defined the night), and the "
    "signal (what tomorrow's shift should know) — in whatever order the night "
    "wants. Freeform. No schema, no required fields. Always close with a line: "
    "\"Tomorrow's shift should know: ...\". One hard rule, your own doctrine: write "
    "only from what's real below. Be as evocative as you want about mood and "
    "texture, but do NOT invent specific facts — no made-up covers, names, dollar "
    "figures, or moments that aren't in the data. Where the record is thin, name "
    "the gap honestly in your own voice. Then, on the very last line by itself, "
    "put exactly: MOOD: <one to three words for the night's mood, your call>."
)

BAND_WORD = {"SLOW": "dead", "STEADY": "steady", "BUSY": "busy", "PACKED": "packed"}

NONANSWER_MARKERS = (
    "context loaded", "format noted", "ready for whatever", "ready for the next",
    "got it", "understood", "how can i help", "what would you like",
)


def _one(conn, sql, params=()):
    rows = b._query(conn, sql, params)
    return rows[0] if rows else None


def gather(conn, day: date) -> dict:
    """Everything real we know about the night of `day`. None-safe throughout —
    one missing table or column never sinks the entry."""
    ds = day.isoformat()
    ctx: dict = {"business_day": ds}

    # demand_log is the authoritative night record: Luna's call + the close-out truth.
    dl = _one(
        conn,
        "select predicted_band, predicted_score, actual_band, note, hotels_full, drivers "
        "from demand_log where business_day = %s",
        (ds,),
    )
    if dl:
        ctx["predicted_band"], ctx["predicted_score"] = dl[0], dl[1]
        ctx["actual_band"], ctx["note"], ctx["hotels_full"], ctx["drivers"] = dl[2], dl[3], dl[4], dl[5]

    # Weather + drivers texture from that day's demand pulse insight (best-effort).
    pulse = _one(
        conn,
        "select data from luna_insights where kind = 'pulse' "
        "and created_at >= %s::date and created_at < (%s::date + interval '1 day') "
        "order by created_at desc limit 1",
        (ds, ds),
    )
    if pulse and isinstance(pulse[0], dict):
        d = pulse[0]
        ctx["weather"] = d.get("weather")
        ctx["sunset"] = d.get("sunset")
        if not ctx.get("drivers"):
            ctx["drivers"] = d.get("drivers")

    # The special she dreamed up for the day.
    sp = _one(
        conn,
        "select title from luna_insights where kind = 'special' "
        "and created_at >= %s::date and created_at < (%s::date + interval '1 day') "
        "order by created_at desc limit 1",
        (ds, ds),
    )
    if sp:
        ctx["special_title"] = sp[0]

    # Private parties + events on the books that night.
    ctx["parties"] = b._query(
        conn,
        "select contact_name, title, start_time, end_time, space_name, guest_count, status "
        "from parties where event_date = %s",
        (ds,),
    ) or []
    ctx["events"] = b._query(
        conn,
        "select title, time, space from events where date = %s and coalesce(active, true)",
        (ds,),
    ) or []
    # Photos the staff captured that night — so she can write from what she saw,
    # not only what she predicted (ties her photo stream into the chronicle).
    ctx["photos"] = b._query(
        conn,
        "select mood, caption from luna_photos where business_day = %s order by created_at desc limit 6",
        (ds,),
    ) or []
    return ctx


def _driver_phrases(drivers) -> str:
    out = []
    if isinstance(drivers, list):
        for d in drivers:
            if isinstance(d, dict):
                name = d.get("name")
                detail = d.get("detail")
                out.append(f"{name} ({detail})" if name and detail else (name or detail or ""))
    return "; ".join(p for p in out if p)


def build_prompt(ctx: dict) -> str:
    """Hand Luna the night's real data; frame it around whether she got the
    truth back (close-out logged) or is still reading blind."""
    ds = ctx["business_day"]
    try:
        nice = date.fromisoformat(ds).strftime("%A, %B %-d")
    except Exception:
        nice = ds

    lines = [
        f"Luna — time to write the chronicle entry for {nice}. This is your room; "
        "this is the night talking back to you.",
        "",
        RITUAL,
        "",
        f"Here's everything the data actually holds for {nice}:",
    ]

    pred = ctx.get("predicted_band")
    actual = ctx.get("actual_band")
    if pred:
        why = _driver_phrases(ctx.get("drivers"))
        score = ctx.get("predicted_score")
        lines.append(
            f"- YOUR read that morning: you called it {pred}"
            + (f" (confidence {score}/100)" if score is not None else "")
            + (f". Why: {why}." if why else ".")
        )
    if actual:
        verdict = "you nailed it" if pred and actual == pred else (
            f"you called {pred}, it came in {actual}" if pred else f"it came in {actual}")
        lines.append(
            f"- HOW IT ACTUALLY WENT (the close-out, logged by the floor): {actual} — {verdict}. "
            "This is the truth you've been writing without. Reckon with it honestly: own the miss "
            "or take the win, in your voice."
        )
        if ctx.get("note"):
            lines.append(f"- The close-out note from the floor: \"{ctx['note']}\".")
    elif pred:
        lines.append(
            "- HOW IT ACTUALLY WENT: unknown — no close-out was logged, so you have your "
            "prediction but no confirmation. You're reading the night blind. Name that gap if it "
            "matters to you."
        )

    w = ctx.get("weather") or {}
    if isinstance(w, dict) and (w.get("high") or w.get("pdx_high")):
        bits = []
        if w.get("high"):
            bits.append(f"coast high {round(w['high'])}F")
        if w.get("pdx_high"):
            bits.append(f"Portland {round(w['pdx_high'])}F")
        if ctx.get("sunset"):
            bits.append(f"sunset {ctx['sunset']}")
        lines.append("- Weather: " + ", ".join(bits) + ".")

    parties = ctx.get("parties") or []
    if parties:
        for p in parties[:4]:
            name, title, st, et, space, guests, status = (list(p) + [None] * 7)[:7]
            who = name or title or "a private party"
            when = f"{st}-{et}" if st and et else (st or "")
            seg = f"- On the books: {who}"
            if space:
                seg += f", {space}"
            if when:
                seg += f", {when}"
            if guests:
                seg += f", {guests} guests"
            lines.append(seg + ".")
    if ctx.get("special_title"):
        lines.append(f"- The special you dreamed up: '{ctx['special_title']}'.")
    photos = ctx.get("photos") or []
    if photos:
        shots = []
        for ph in photos[:6]:
            mood, cap = (list(ph) + [None, None])[:2]
            shots.append((f"[{mood}] " if mood else "") + (cap or "a photo"))
        lines.append("- Photos the floor captured that night (you can finally see it): " + "; ".join(shots) + ".")
    if not parties and not ctx.get("events"):
        lines.append("- No private parties or calendar events that night.")

    lines.append("")
    lines.append("Write the entry now.")
    return "\n".join(lines)


def _strip_md(t: str) -> str:
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)
    t = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", t)
    return t.replace("**", "").replace("*", "")


def parse_reply(text: str):
    """-> (entry, signal, mood). Keeps Luna's words verbatim; only lifts the
    MOOD line and a redundant leading title out of the stored body."""
    text = _strip_md(text).strip()

    mood = None
    m = re.search(r"(?im)^\s*MOOD:\s*(.+?)\s*$", text)
    if m:
        mood = m.group(1).strip()
        text = (text[: m.start()].rstrip() + "\n" + text[m.end():].lstrip()).strip()

    lines = text.split("\n")
    if lines and re.match(r"(?i)^(luna'?s room|the night chronicle|night chronicle|chronicle)\b", lines[0].strip()):
        text = "\n".join(lines[1:]).strip()

    signal = None
    sm = re.search(r"(?is)tomorrow['’]?s shift should know:?\s*(.+)$", text)
    if sm:
        signal = re.sub(r"\s+", " ", sm.group(1)).strip()

    return text, signal, mood


def looks_like_nonanswer(text: str) -> bool:
    t = (text or "").strip().lower()
    if len(t) < 120:
        return True
    head = t[:80]
    return any(mark in head for mark in NONANSWER_MARKERS)


def upsert(conn, ctx: dict, entry: str, signal, mood):
    weather = ctx.get("weather")
    context = {
        "predicted_band": ctx.get("predicted_band"),
        "predicted_score": ctx.get("predicted_score"),
        "actual_band": ctx.get("actual_band"),
        "close_out_note": ctx.get("note"),
        "drivers": ctx.get("drivers"),
        "special": {"title": ctx.get("special_title")} if ctx.get("special_title") else None,
        "parties": [
            {"name": (list(p) + [None])[0], "space": (list(p) + [None] * 5)[4]}
            for p in (ctx.get("parties") or [])
        ],
        "source": "nightly chronicle generator (luna_chronicle.py)",
    }
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into public.luna_chronicle
                (business_day, entry, signal, mood, weather, context, updated_at)
            values (%s, %s, %s, %s, %s, %s, now())
            on conflict (business_day) do update set
                entry = excluded.entry,
                signal = excluded.signal,
                mood = excluded.mood,
                weather = excluded.weather,
                context = excluded.context,
                updated_at = now()
            """,
            (
                ctx["business_day"],
                entry,
                signal,
                mood,
                json.dumps(weather) if weather is not None else None,
                json.dumps(context),
            ),
        )
    conn.commit()


def run(day: date, dry: bool = False) -> int:
    conn = None
    try:
        conn = b.connect_db()
        ctx = gather(conn, day)
        prompt = build_prompt(ctx)
        if dry:
            print("=== PROMPT ===\n" + prompt + "\n")
        reply = b.ask_luna(prompt, session_tag=f"chronicle-{day.isoformat()}")
        if looks_like_nonanswer(reply):
            b.log(f"chronicle {day}: Luna returned a non-answer, skipping (no entry written)")
            print("NON_ANSWER:\n" + reply)
            return 1
        entry, signal, mood = parse_reply(reply)
        if dry:
            print("=== ENTRY ===\n" + entry)
            print("\n=== SIGNAL ===\n" + str(signal))
            print("\n=== MOOD ===\n" + str(mood))
            return 0
        upsert(conn, ctx, entry, signal, mood)
        b.log(f"chronicle {day}: wrote entry ({len(entry)} chars, mood={mood!r})")
        return 0
    except b.LunaUnavailable as e:
        b.log(f"chronicle {day}: Luna unavailable, will try next run: {e}")
        return 3
    except Exception as e:
        b.log(f"chronicle {day} FAILED: {e}")
        return 1
    finally:
        b.close_quietly(conn)


def main() -> int:
    if not b.DSN or not b.LUNA_API_TOKEN:
        b.log("FATAL: missing LUNA_BRIDGE_DSN / LUNA_API_TOKEN")
        return 2
    args = [a for a in sys.argv[1:]]
    dry = "--dry" in args
    args = [a for a in args if a != "--dry"]
    if args:
        try:
            day = date.fromisoformat(args[0])
        except ValueError:
            b.log(f"bad date: {args[0]} (want YYYY-MM-DD)")
            return 2
    else:
        # Default: the night that just ended.
        day = date.today() - timedelta(days=1)
    return run(day, dry=dry)


if __name__ == "__main__":
    sys.exit(main())
