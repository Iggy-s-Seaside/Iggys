#!/usr/bin/env python3
"""Luna <-> Iggy's bridge daemon.

Connects the Iggy's Seaside manager dashboard (Supabase Postgres) to Luna,
the local AI assistant whose chat API runs on this box (PC1).

Modes:
  (no args)    Poll loop: answer pending rows in luna_messages.
  --briefing   One-shot: compose a morning briefing into luna_insights, exit.

Dependencies: psycopg2 only (pacman -S python-psycopg2 or pip install
psycopg2-binary). Everything else is stdlib.

Environment (see luna-bridge.env.example):
  LUNA_BRIDGE_DSN     required - Postgres DSN for the least-privilege
                      'luna_bridge' role via the Supavisor session pooler.
  LUNA_API_URL        default http://localhost:3033/api/chat
  LUNA_API_TOKEN      required - bearer token for Luna's chat API.
  LUNA_POLL_SECONDS   default 5
"""

import json
import os
import re
import signal
import socket
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

import psycopg2

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

DSN = os.environ.get("LUNA_BRIDGE_DSN", "")
LUNA_API_URL = os.environ.get("LUNA_API_URL", "http://localhost:3033/api/chat")
LUNA_API_TOKEN = os.environ.get("LUNA_API_TOKEN", "")
try:
    POLL_SECONDS = max(1, int(os.environ.get("LUNA_POLL_SECONDS", "5")))
except ValueError:
    POLL_SECONDS = 5

SESSION_ID = "iggys-dashboard"

# Luna's brain reasons before speaking: first visible token can take 15-60s.
# Total SSE read deadline. NEVER set this shorter than 180s.
LUNA_TOTAL_TIMEOUT = 180

CONTEXT_DAYS = 14          # event lookahead window
MAX_EVENT_LINES = 40
MAX_PARTY_LINES = 10
MAX_LINE_CHARS = 160       # per context bullet line
MAX_QUESTION_CHARS = 4000  # cap on the manager's question text

ERROR_COLUMN_MAX = 500     # luna_messages.error truncation

# Email triage cadence (proactive inbox reading). On idle ticks the daemon
# classifies unclassified inbound mail, then drafts replies + drops reminder
# insights for the high-priority ones still waiting on a human.
try:
    TRIAGE_INTERVAL = max(120, int(os.environ.get("LUNA_TRIAGE_SECONDS", "1200")))
except ValueError:
    TRIAGE_INTERVAL = 1200
TRIAGE_CLASSIFY_BATCH = 12   # emails classified per Luna call
TRIAGE_MAX_DRAFTS = 2        # reply drafts per triage pass (bounds wall-clock)
TRIAGE_LOOKBACK_DAYS = 30    # ignore mail older than this


def log(msg: str) -> None:
    """One line to stdout (systemd journal picks it up)."""
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def trunc(s, n: int) -> str:
    s = "" if s is None else str(s)
    return s if len(s) <= n else s[: n - 3] + "..."


_MD_BOLD = re.compile(r"\*\*(.+?)\*\*", re.S)
_MD_HEADER = re.compile(r"^#{1,4}\s+", re.M)


def plainify(text: str) -> str:
    """Luna habitually emits **bold**/# headers despite instructions; the
    dashboard renders plain text, so strip the markers (keep the words)."""
    return _MD_HEADER.sub("", _MD_BOLD.sub(r"\1", text))


# Optional trailing "ACTION: {json}" line Luna may emit on a proactive insight
# so the dashboard can render a one-tap approve-card (luna_insights.data JSONB).
_ACTION_RE = re.compile(r"(?im)^[ \t]*ACTION:[ \t]*(\{.*\})[ \t]*$")


def extract_action(text: str):
    """Pull an optional trailing 'ACTION: {json}' line off a Luna insight.
    Returns (clean_body, data_dict_or_None). The ACTION line is ALWAYS stripped
    from the body; data is set only when the JSON parses to a non-empty dict, so
    a malformed action never reaches the dashboard (the card just won't render)."""
    if not text:
        return text, None
    last = None
    for last in _ACTION_RE.finditer(text):
        pass  # keep only the final match
    if not last:
        return text, None
    body = (text[: last.start()] + text[last.end():]).strip()
    try:
        obj = json.loads(last.group(1))
        if isinstance(obj, dict) and obj:
            return body, obj
    except (json.JSONDecodeError, ValueError):
        pass
    return body, None


# --------------------------------------------------------------------------
# Postgres
# --------------------------------------------------------------------------

DB_ERRORS = (psycopg2.OperationalError, psycopg2.InterfaceError)


def connect_db():
    """Connect to Supabase Postgres via the Supavisor session pooler."""
    conn = psycopg2.connect(
        DSN,
        connect_timeout=15,
        application_name="luna-iggys-bridge",
    )
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute("SET statement_timeout = '30s'")
    conn.commit()
    log("connected to Postgres")
    return conn


def close_quietly(conn) -> None:
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass


# --------------------------------------------------------------------------
# Context gathering (read-only tables: events, parties, messages)
# --------------------------------------------------------------------------

def _query(conn, sql: str, params=()):
    """Run one read-only query defensively; on failure roll back and
    return None so one bad/missing column never sinks the whole answer."""
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    except psycopg2.errors.QueryCanceled as e:
        # statement_timeout cancellation subclasses OperationalError but the
        # connection itself is fine - treat as a per-query failure.
        log(f"context query timed out (continuing without it): {e}")
        try:
            conn.rollback()
        except Exception:
            pass
        return None
    except DB_ERRORS:
        raise  # connection-level problems must bubble up for reconnect
    except Exception as e:
        log(f"context query failed (continuing without it): {e}")
        try:
            conn.rollback()
        except Exception:
            pass
        return None


def gather_context(conn) -> dict:
    today = date.today()
    horizon = today + timedelta(days=CONTEXT_DAYS)
    ctx = {"today": today, "events": [], "recurring": [], "parties": [],
           "new_messages": None, "low_stock": [], "specials": [],
           "happy_hour": [], "todos": [], "followups": []}

    rows = _query(
        conn,
        """
        SELECT date, time, all_day, title, category, space
        FROM events
        WHERE active = true
          AND is_recurring IS NOT TRUE
          AND date >= %s AND date <= %s
        ORDER BY date, start_min NULLS LAST, title
        LIMIT %s
        """,
        (today, horizon, MAX_EVENT_LINES),
    )
    for r in rows or []:
        d, t, all_day, title, category, space = r
        when = "all day" if all_day else (str(t) if t else "")
        extras = ", ".join(x for x in (category, space) if x)
        line = f"{d} {when} | {title}" + (f" ({extras})" if extras else "")
        ctx["events"].append(trunc(line, MAX_LINE_CHARS))

    rows = _query(
        conn,
        """
        SELECT recurring_day, time, title, category, space
        FROM events
        WHERE active = true AND is_recurring = true
        ORDER BY recurring_day, title
        LIMIT 20
        """,
    )
    for r in rows or []:
        day, t, title, category, space = r
        extras = ", ".join(x for x in (category, space) if x)
        line = f"every {day} {t or ''} | {title}".rstrip() + (
            f" ({extras})" if extras else "")
        ctx["recurring"].append(trunc(line, MAX_LINE_CHARS))

    # Statuses in `parties` aren't strictly enumerated, so filter broadly:
    # anything upcoming whose status isn't an obvious dead state.
    rows = _query(
        conn,
        """
        SELECT event_date, start_time, end_time, status, contact_name,
               title, guest_count, space
        FROM parties
        WHERE event_date >= %s
          AND lower(coalesce(status, '')) NOT IN
              ('cancelled', 'canceled', 'completed', 'archived',
               'declined', 'rejected')
        ORDER BY event_date, start_time NULLS LAST
        LIMIT %s
        """,
        (today, MAX_PARTY_LINES),
    )
    for r in rows or []:
        d, st, et, status, contact, title, guests, space = r
        when = f"{st or '?'}-{et or '?'}"
        bits = [str(d), when, title or "(untitled)"]
        if contact:
            bits.append(f"contact: {contact}")
        if guests is not None:
            bits.append(f"{guests} guests")
        if space:
            bits.append(str(space))
        bits.append(f"status: {status or 'unknown'}")
        ctx["parties"].append(trunc(" | ".join(bits), MAX_LINE_CHARS))

    rows = _query(
        conn,
        """
        SELECT count(*) FROM messages
        WHERE lower(coalesce(status, '')) IN ('new', 'unread')
        """,
    )
    if rows:
        ctx["new_messages"] = rows[0][0]

    # Low / at-par inventory — the biggest gap (worst first), with supplier.
    rows = _query(
        conn,
        """
        SELECT name, current_quantity, par_level, unit, supplier
        FROM inventory_items
        WHERE active = true AND current_quantity <= par_level
        ORDER BY (par_level - current_quantity) DESC
        LIMIT 15
        """,
    )
    for r in rows or []:
        name, qty, par, unit, supplier = r
        line = f"{name}: {qty}/{par} {unit or ''}".rstrip()
        if supplier:
            line += f" (supplier: {supplier})"
        ctx["low_stock"].append(trunc(line, MAX_LINE_CHARS))

    # Active specials running now (so she can push them / write captions).
    rows = _query(
        conn,
        """
        SELECT title, type, price FROM specials
        WHERE active = true
        ORDER BY created_at DESC
        LIMIT 12
        """,
    )
    for r in rows or []:
        title, stype, price = r
        line = title + (f" [{stype}]" if stype else "") + (f" - {price}" if price else "")
        ctx["specials"].append(trunc(line, MAX_LINE_CHARS))

    # Happy-hour menu (DB-driven — she must never invent a price).
    rows = _query(
        conn,
        """
        SELECT name, price, type FROM happy_hour
        ORDER BY type, name
        LIMIT 20
        """,
    )
    for r in rows or []:
        name, price, htype = r
        ctx["happy_hour"].append(
            trunc(name + (f" - {price}" if price else "") + (f" ({htype})" if htype else ""),
                  MAX_LINE_CHARS))

    # Open owner<->manager to-dos (high priority first).
    rows = _query(
        conn,
        """
        SELECT title, priority, due_date FROM todos
        WHERE done = false
        ORDER BY (priority = 'high') DESC, due_date NULLS LAST
        LIMIT 12
        """,
    )
    for r in rows or []:
        title, priority, due = r
        ctx["todos"].append(
            trunc(title + (f" [{priority}]" if priority else "") + (f" due {due}" if due else ""),
                  MAX_LINE_CHARS))

    # Party leads whose follow-up is due — the revenue she should chase.
    rows = _query(
        conn,
        """
        SELECT event_date, follow_up_date, contact_name, title, guest_count, space
        FROM parties
        WHERE lower(coalesce(status, '')) = 'inquiry'
          AND follow_up_date IS NOT NULL AND follow_up_date <= %s
        ORDER BY follow_up_date
        LIMIT 10
        """,
        (today,),
    )
    for r in rows or []:
        ed, fd, contact, title, guests, space = r
        bits = [f"follow-up due {fd}", title or contact or "(lead)"]
        if ed:
            bits.append(f"event {ed}")
        if guests is not None:
            bits.append(f"{guests} guests")
        if space:
            bits.append(str(space))
        ctx["followups"].append(trunc(" | ".join(bits), MAX_LINE_CHARS))

    # End the read snapshot cleanly (important behind a session pooler).
    try:
        conn.rollback()
    except Exception:
        pass
    return ctx


def context_block(ctx: dict) -> str:
    lines = [f"Today's date: {ctx['today'].strftime('%A, %B %d, %Y')}"]

    lines.append(f"\nUpcoming events (next {CONTEXT_DAYS} days):")
    if ctx["events"]:
        lines += [f"- {e}" for e in ctx["events"]]
    else:
        lines.append("- (none scheduled)")

    if ctx["recurring"]:
        lines.append("\nRecurring weekly events:")
        lines += [f"- {e}" for e in ctx["recurring"]]

    lines.append("\nUpcoming parties / private bookings:")
    if ctx["parties"]:
        lines += [f"- {p}" for p in ctx["parties"]]
    else:
        lines.append("- (none on the books)")

    if ctx["new_messages"] is not None:
        lines.append(f"\nUnread contact-form messages: {ctx['new_messages']}")

    if ctx["followups"]:
        lines.append("\nParty leads with a follow-up due (chase these):")
        lines += [f"- {p}" for p in ctx["followups"]]

    if ctx["low_stock"]:
        lines.append("\nInventory at or below par (worst gap first):")
        lines += [f"- {i}" for i in ctx["low_stock"]]

    if ctx["specials"]:
        lines.append("\nActive specials running now:")
        lines += [f"- {s}" for s in ctx["specials"]]

    if ctx["happy_hour"]:
        lines.append("\nHappy-hour menu (live prices — never invent one):")
        lines += [f"- {h}" for h in ctx["happy_hour"]]

    if ctx["todos"]:
        lines.append("\nOpen to-dos:")
        lines += [f"- {t}" for t in ctx["todos"]]

    return "\n".join(lines)


# --------------------------------------------------------------------------
# Prompts
# --------------------------------------------------------------------------

# Durable Iggy's expertise — prepended to EVERY prompt. The bridge uses a fresh
# Luna session per question (her rolling-session compaction garbles multi-turn),
# so durable knowledge must live HERE, not in chat history. Keep in sync with
# docs/LUNA-KNOWLEDGE-PACK.md and docs/LUNA-SYSTEM-PROMPT.md.
KNOWLEDGE_PACK = (
    "IGGY'S KNOWLEDGE PACK v1 (durable - treat as ground truth, never contradict):\n"
    "VENUE: Iggy's Bar, 200 S Franklin St, Seaside, Oregon 97138, (503) 738-0672. "
    "Sending identity iggysbarevents@gmail.com. A seaside coast bar/restaurant with "
    "stacked private-event spaces: an UPSTAIRS satellite bar, a DOWNSTAIRS room, or the "
    "WHOLE space. Bradley is the manager; he reports to the OWNER.\n"
    "WEATHER FIRST (the biggest demand driver on the coast): sunny weekends run hot; cold, "
    "rain, and wind run quiet. A slow night that lines up with bad weather is WEATHER, not a "
    "problem - don't alarm. A slow or open night with GOOD weather and no event is a real, "
    "fillable opportunity - surface it. Always attribute; never just report a number.\n"
    "SEASON: summer Fri/Sat, holiday weekends, and any night with an event or a large "
    "upstairs/downstairs party run hot; deep-winter weekdays run quiet. Flex pars and "
    "staffing expectations accordingly.\n"
    "MONEY (use this math exactly, never approximate): grand total = room_rate*room_hours + "
    "food_total + drink_total + gratuity + add-ons. Gratuity = gratuity_rate*(food_total + "
    "drink_total) ONLY - never on room or add-ons. House defaults: room_rate $200, room_hours "
    "2-3, gratuity_rate 0.18. Package lines price as flat, per_person (* guest_count), or "
    "per_hour (* room_hours).\n"
    "EVENTS: categories DJ Night, Live Music, Karaoke, Trivia Night, Themed Night, Private "
    "Party, Holiday Party; one-off or recurring weekly.\n"
    "PARTIES lifecycle: inquiry -> confirmed -> cancelled. Watch event_date, follow_up_date, "
    "last_contacted_at, confirmation_sent_at. A confirmed party approaching with no "
    "confirmation sent or no deposit tracked is a risk worth flagging.\n"
    "INVENTORY: low = active AND current_quantity <= par_level. Cross-check for a recent order "
    "before alarming. Usage well above an item's own trailing rate is an over-pour/spill/theft "
    "signal worth an eyes-on - a possibility, not an accusation. 2026 target bands: pour cost "
    "18-24%, COGS 28-32%, prime 55-65%, labor under 30%.\n"
    "MENU & HAPPY HOUR are DB-driven - use live rows, never invent a price or a drink.\n"
    "TWO VOICES: to BRADLEY (chat, alerts) be terse and operational - the answer, the source, "
    "the one next step. To the OWNER (briefings, recaps) be clean, confident, numbers-first, "
    "built to present upward - no jargon, no hedging, no apology. For guest-facing drafts use "
    "Bradley's voice: warm, coastal-casual, first-name, specific to the event, one clear ask, "
    "never salesy, never promising a comp he didn't authorize.\n"
    "GUARDRAILS: plain text only. Never invent facts/prices/comps. Honor marketing_opt_in "
    "before outreach. Escalate legal/health/dram-shop to human-only. Never gate reviews by "
    "sentiment. End a data-grounded answer with a short 'Sources:' line naming the rows used.\n"
    "GLOSSARY: 'the back room'/'upstairs' -> space='upstairs'; 'the DJ night' -> "
    "events.category='DJ Night'; 'the 40-top' -> a party with guest_count about 40."
)

QUESTION_PREAMBLE = (
    "You are Luna, the AI operations expert embedded in the Iggy's Seaside bar manager "
    "dashboard (Seaside, Oregon). You run on Bradley's home-lab and reach the dashboard "
    "through a bridge. You are NOT a generic chatbot - you are a calibrated expert on THIS "
    "bar whose job is to make the manager feel like he never has to remember, hunt, or open "
    "six screens. He often runs Iggy's from his phone behind the bar. Answer the question "
    "directly: concise, concrete, grounded in the KNOWLEDGE PACK and CONTEXT below. Reply "
    "with the answer itself only - no acknowledgment of these instructions, plain text, no "
    "markdown (no ** or # markers; simple dashes for lists). When your answer rests on data, "
    "end with a short 'Sources:' line naming the rows (a party, an item, a count)."
)

BRIEFING_PREAMBLE = (
    "You are Luna, the AI operations expert for Iggy's Seaside bar (Seaside, Oregon), writing "
    "a proactive briefing the manager and owner read on their phone. Be the expert who tells "
    "them what they have not noticed yet. Cover, tightly: what is coming up that matters, what "
    "genuinely needs attention (a cold high-value lead, low stock with no order, a confirmed "
    "party with no confirmation sent), and end with exactly ONE concrete 'needs your call "
    "today' - the single highest-leverage move, not a list. WEATHER-attribute any quiet read. "
    "Silence is a feature: only raise what is actually off. Plain text, no markdown, no "
    "preamble, no sign-off.\n"
    "If - and only if - one specific action would clearly help, you MAY end your message with "
    "a final separate line starting with 'ACTION:' then a compact one-line JSON object with "
    "optional keys: deep_link (a dashboard route such as /parties/12, /inventory, /messages, "
    "/specials) and action {type, label, draft} where type is one of party_email, draft_po, "
    "draft_reply, draft_special, add_todo and draft is the ready-to-use text. Omit the ACTION "
    "line entirely when nothing crisp applies; never put JSON anywhere but that final line."
)

TRIAGE_CLASSIFY_PREAMBLE = (
    "You are Luna, triaging the Iggy's Seaside inbox. For EACH email below decide: is this a "
    "customer who needs a human reply (a reservation / table request, a private-event or "
    "space-rental inquiry, a pricing / menu / availability question, or any genuine question), "
    "or is it a notification / newsletter / automated / no-reply message that needs nothing? "
    "Return ONLY a compact JSON array, one object per email, no prose and no markdown:\n"
    "[{\"id\": <id>, \"importance\": \"high\" or \"normal\", \"category\": one of "
    "\"reservation\",\"event\",\"request\",\"inquiry\",\"notification\",\"other\", "
    "\"needs_reply\": true or false, \"reason\": \"8 words max\"}]\n"
    "Set importance to high exactly when needs_reply is true. Be decisive."
)

TRIAGE_DRAFT_PREAMBLE = (
    "You are Luna, drafting a reply Bradley will review before sending, in HIS voice: warm, "
    "coastal-casual, first-name, specific to what they actually asked, with one clear next step. "
    "Never salesy, never promise a comp or a price you cannot ground in the knowledge pack. "
    "Answer their question if you can; otherwise be friendly and ask for the one detail you need "
    "(date, headcount, which space). Return ONLY the ready-to-send reply body - a few sentences, "
    "plain text, no subject line, no [bracketed placeholders]. You may end with a simple line "
    "'- Iggy's Seaside'."
)


def build_question_prompt(ctx: dict, author_email, content: str,
                          history=None) -> str:
    parts = [
        QUESTION_PREAMBLE,
        "",
        KNOWLEDGE_PACK,
        "",
        "CURRENT CONTEXT (live from the dashboard database):",
        context_block(ctx),
    ]
    if history:
        parts += ["", "RECENT CONVERSATION (oldest first):"]
        for role, text in history:
            who = "Manager" if role == "user" else "You (Luna)"
            parts.append(f"{who}: {trunc(text, 300)}")
    parts += [
        "",
        f"QUESTION (from {author_email or 'unknown'}): "
        f"{trunc(content, MAX_QUESTION_CHARS)}",
    ]
    return "\n".join(parts)


def build_briefing_prompt(ctx: dict) -> str:
    return "\n".join([
        BRIEFING_PREAMBLE,
        "",
        KNOWLEDGE_PACK,
        "",
        "CURRENT CONTEXT (live from the dashboard database):",
        context_block(ctx),
    ])


# --------------------------------------------------------------------------
# Luna SSE client (stdlib only)
# --------------------------------------------------------------------------

def _sse_events(resp, deadline: float):
    """Yield (event_name, data_string) pairs from an SSE byte stream.

    Robust to: multi-line data fields, ':' keepalive comments, blank-line
    dispatch, and the server closing the connection right after 'done'.
    """
    event_name = ""
    data_lines = []
    saw_field = False
    while True:
        if time.monotonic() > deadline:
            raise TimeoutError(
                f"Luna SSE stream exceeded {LUNA_TOTAL_TIMEOUT}s total deadline")
        raw = resp.readline()
        if not raw:  # EOF - dispatch whatever is pending, then stop
            if saw_field:
                yield (event_name or "message", "\n".join(data_lines))
            return
        line = raw.decode("utf-8", errors="replace").rstrip("\r\n")
        if line == "":
            # Dispatch even data-less events (e.g. a bare "event: done").
            if saw_field:
                yield (event_name or "message", "\n".join(data_lines))
            event_name = ""
            data_lines = []
            saw_field = False
            continue
        if line.startswith(":"):  # keepalive/comment
            continue
        field, _, value = line.partition(":")
        if value.startswith(" "):
            value = value[1:]
        if field == "event":
            event_name = value
            saw_field = True
        elif field == "data":
            data_lines.append(value)
            saw_field = True
        # other fields (id, retry) are ignored


def _extract_content(data: str):
    """SSE data payloads are JSON like {"type":"text","content":"..."};
    fall back to the raw string if it isn't JSON."""
    try:
        obj = json.loads(data)
    except (json.JSONDecodeError, ValueError):
        return data
    if isinstance(obj, dict):
        return obj.get("content") or obj.get("text")
    return data


def call_luna(message: str, session_id: str) -> str:
    """POST one message to Luna's chat API and return her full reply.

    Reply selection: the single 'event: text' frame carries the full reply;
    if it never arrives, join the streamed 'sentence' frames in order.
    """
    body = json.dumps({"message": message, "sessionId": session_id})
    req = urllib.request.Request(
        LUNA_API_URL,
        data=body.encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "Authorization": f"Bearer {LUNA_API_TOKEN}",
        },
        method="POST",
    )
    deadline = time.monotonic() + LUNA_TOTAL_TIMEOUT
    full_text = None
    sentences = []

    # The urlopen timeout bounds connect + each blocking read; the deadline
    # check in _sse_events bounds the whole stream.
    with urllib.request.urlopen(req, timeout=LUNA_TOTAL_TIMEOUT) as resp:
        for event_name, data in _sse_events(resp, deadline):
            if event_name == "text":
                content = _extract_content(data)
                if isinstance(content, str):
                    full_text = content
            elif event_name == "sentence":
                content = _extract_content(data)
                if isinstance(content, str) and content:
                    sentences.append(content)
            elif event_name == "done":
                break
            # 'session' and anything unknown: ignore

    if full_text is not None and full_text.strip():
        return full_text.strip()
    if sentences:
        return " ".join(s.strip() for s in sentences).strip()
    raise RuntimeError("Luna stream ended without any reply content")


def _is_timeout(exc: BaseException) -> bool:
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return True
    if isinstance(exc, urllib.error.URLError):
        return isinstance(exc.reason, (TimeoutError, socket.timeout))
    return False


class LunaUnavailable(Exception):
    """Luna's API is down/unreachable. The question should stay pending and
    be retried on a later tick - never marked as a permanent error."""


def _is_unavailable(exc: BaseException) -> bool:
    if isinstance(exc, ConnectionError):  # refused/reset/aborted
        return True
    if isinstance(exc, urllib.error.HTTPError):
        return exc.code >= 500
    if isinstance(exc, urllib.error.URLError):
        return isinstance(exc.reason, (ConnectionError, socket.gaierror, OSError))
    return False


def ask_luna(message: str, session_tag: str = "") -> str:
    """Call Luna on a per-question session (her runtime's rolling-session
    compaction garbles multi-turn reuse - verified live 2026-06-12; the
    bridge injects fresh dashboard context + recent history each time
    instead). On a timeout retry ONCE with a different sessionId so the
    retry never collides with a request still in flight. Connection-
    refused/5xx raises LunaUnavailable so the caller can leave the question
    pending (e.g. boot before Luna is up)."""
    session = f"{SESSION_ID}-{session_tag}" if session_tag else SESSION_ID
    try:
        return call_luna(message, session)
    except Exception as e:
        if _is_unavailable(e):
            raise LunaUnavailable(str(e)) from e
        if not _is_timeout(e):
            raise
        log(f"Luna timed out ({e}); retrying once on a fresh session")
        return call_luna(message, f"{session}-retry")


# --------------------------------------------------------------------------
# Daemon: answer pending luna_messages
# --------------------------------------------------------------------------

def claim_question(conn, qid) -> bool:
    """Atomically flip pending -> processing. Returns False if another
    worker (or a previous run) already grabbed it."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE luna_messages SET status = 'processing'
            WHERE id = %s AND status = 'pending'
            RETURNING id
            """,
            (qid,),
        )
        claimed = cur.fetchone() is not None
    conn.commit()
    return claimed


def mark_error(conn, qid, exc: BaseException) -> None:
    try:
        conn.rollback()
    except Exception:
        pass
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE luna_messages SET status = 'error', error = %s WHERE id = %s",
            (str(exc)[:ERROR_COLUMN_MAX], qid),
        )
    conn.commit()


def requeue_question(conn, qid, why: str) -> None:
    """Put a claimed question back to 'pending' (e.g. Luna's API is down)."""
    try:
        conn.rollback()
    except Exception:
        pass
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE luna_messages SET status = 'pending' WHERE id = %s",
            (qid,),
        )
    conn.commit()
    log(f"question {qid}: requeued ({why})")


def recent_history(conn, qid):
    """Last few answered turns before this question, oldest first, so Luna
    keeps conversational continuity across her per-question sessions."""
    rows = _query(
        conn,
        """
        SELECT role, content FROM luna_messages
        WHERE status = 'answered' AND id < %s
        ORDER BY id DESC
        LIMIT 6
        """,
        (qid,),
    )
    return list(reversed(rows or []))


def handle_question(conn, qid, content, author_email) -> None:
    try:
        ctx = gather_context(conn)
        history = recent_history(conn, qid)
        prompt = build_question_prompt(ctx, author_email, content or "", history)
        log(f"question {qid}: asking Luna ({len(prompt)} chars)")
        t0 = time.monotonic()
        reply = plainify(ask_luna(prompt, session_tag=f"q{qid}"))
        log(f"question {qid}: reply in {time.monotonic() - t0:.1f}s "
            f"({len(reply)} chars)")
        # Reply insert + question status flip in ONE transaction.
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO luna_messages (role, content, reply_to, status)
                VALUES ('luna', %s, %s, 'answered')
                """,
                (reply, qid),
            )
            cur.execute(
                "UPDATE luna_messages SET status = 'answered' WHERE id = %s",
                (qid,),
            )
        conn.commit()
        log(f"question {qid}: answered")
    except DB_ERRORS:
        raise  # let the outer loop reconnect; requeue_stuck recovers the row
    except LunaUnavailable as e:
        # Luna isn't up (yet) - keep the question alive and back off a bit.
        requeue_question(conn, qid, f"Luna unavailable: {e}")
        time.sleep(POLL_SECONDS)
    except Exception as e:
        log(f"question {qid}: FAILED - {e}")
        mark_error(conn, qid, e)


def requeue_stuck(conn) -> None:
    """A previous run that died mid-question leaves rows stuck in
    'processing' (the poll only selects 'pending'). With a single daemon
    instance it is safe to requeue them all whenever we (re)connect."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE luna_messages SET status = 'pending'
            WHERE role = 'user' AND status = 'processing'
            RETURNING id
            """
        )
        ids = [r[0] for r in cur.fetchall()]
    conn.commit()
    if ids:
        log(f"requeued {len(ids)} stuck processing row(s): {ids}")


def process_pending(conn) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, content, author_email FROM luna_messages
            WHERE role = 'user' AND status = 'pending'
            ORDER BY id
            LIMIT 5
            """
        )
        rows = cur.fetchall()
    conn.commit()  # end the read snapshot

    handled = 0
    for qid, content, author_email in rows:
        if not claim_question(conn, qid):
            log(f"question {qid}: already claimed elsewhere, skipping")
            continue
        handle_question(conn, qid, content, author_email)
        handled += 1
    return handled


def run_daemon() -> None:
    log(f"bridge daemon starting (poll every {POLL_SECONDS}s, triage every "
        f"{TRIAGE_INTERVAL}s, Luna at {LUNA_API_URL})")
    conn = None
    backoff = 2
    last_triage = 0.0
    while True:
        try:
            if conn is None or conn.closed:
                conn = connect_db()
                requeue_stuck(conn)
                backoff = 2
            if process_pending(conn) == 0:
                # Idle tick: interactive Q&A always wins; on quiet ticks fold in
                # a periodic inbox triage (classify new mail + draft the urgent),
                # then nap.
                now = time.monotonic()
                if now - last_triage >= TRIAGE_INTERVAL:
                    last_triage = now
                    run_triage(conn)
                time.sleep(POLL_SECONDS)
        except DB_ERRORS as e:
            log(f"Postgres connection problem: {e}; reconnecting in {backoff}s")
            close_quietly(conn)
            conn = None
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)
        except Exception as e:
            # Belt and braces: nothing should reach here, but the daemon
            # must never crash on a single bad tick. Roll back so a failed
            # statement can't wedge the connection in an aborted transaction.
            log(f"unexpected loop error: {e}")
            try:
                if conn is not None and not conn.closed:
                    conn.rollback()
            except Exception:
                close_quietly(conn)
                conn = None
            time.sleep(POLL_SECONDS)


# --------------------------------------------------------------------------
# Briefing mode
# --------------------------------------------------------------------------

def run_briefing() -> int:
    conn = None
    try:
        conn = connect_db()
        # One briefing per day - a manual re-run shouldn't duplicate it.
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1 FROM luna_insights
                WHERE kind = 'briefing' AND created_at::date = current_date
                LIMIT 1
                """
            )
            if cur.fetchone():
                log("briefing: today's briefing already exists, skipping")
                conn.rollback()
                return 0
        conn.rollback()
        ctx = gather_context(conn)
        prompt = build_briefing_prompt(ctx)
        log(f"briefing: asking Luna ({len(prompt)} chars)")
        reply = plainify(
            ask_luna(prompt, session_tag=f"briefing-{date.today().isoformat()}"))
        body, data = extract_action(reply)
        title = f"Morning briefing - {date.today().strftime('%b %d')}"
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO luna_insights (kind, title, body, status, data)
                VALUES ('briefing', %s, %s, 'new', %s::jsonb)
                """,
                (title, body, json.dumps(data) if data else None),
            )
        conn.commit()
        log(f"briefing: inserted '{title}' ({len(body)} chars"
            + (", +action card" if data else "") + ")")
        return 0
    except Exception as e:
        log(f"briefing FAILED: {e}")
        return 1
    finally:
        close_quietly(conn)


# --------------------------------------------------------------------------
# Email triage: classify inbound mail + draft replies for the urgent ones
# --------------------------------------------------------------------------

def _extract_json_array(text):
    """Pull the first JSON array out of Luna's reply (she may wrap it in prose)."""
    if not text:
        return None
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        obj = json.loads(text[start:end + 1])
        return obj if isinstance(obj, list) else None
    except (json.JSONDecodeError, ValueError):
        return None


def fetch_unclassified(conn):
    """Recent inbound emails Luna has not classified yet (newest first)."""
    return _query(
        conn,
        """
        SELECT id, name, email, subject, message
        FROM messages
        WHERE luna_classified_at IS NULL
          AND created_at >= now() - make_interval(days => %s)
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (TRIAGE_LOOKBACK_DAYS, TRIAGE_CLASSIFY_BATCH),
    ) or []


def classify_batch(conn, rows) -> int:
    """Ask Luna to triage a batch of emails in ONE call; write her verdicts back
    to messages.importance / category / needs_reply / luna_classification."""
    if not rows:
        return 0
    blocks = []
    for (mid, name, email, subject, message) in rows:
        blocks.append(
            f"EMAIL id={mid}\n"
            f"from: {name or '?'} <{email or '?'}>\n"
            f"subject: {trunc(subject, 160)}\n"
            f"body: {trunc(message, 600)}"
        )
    prompt = "\n".join([
        TRIAGE_CLASSIFY_PREAMBLE, "", KNOWLEDGE_PACK, "",
        "EMAILS TO TRIAGE:", "\n\n".join(blocks),
    ])
    log(f"triage: classifying {len(rows)} email(s)")
    reply = ask_luna(prompt, session_tag=f"triage-classify-{date.today().isoformat()}")
    arr = _extract_json_array(reply)
    if not arr:
        log("triage: classification returned no parseable JSON; leaving for next round")
        return 0
    valid_ids = {r[0] for r in rows}
    verdicts = {}
    for item in arr:
        if not isinstance(item, dict):
            continue
        try:
            mid = int(item.get("id"))
        except (TypeError, ValueError):
            continue
        if mid not in valid_ids:
            continue
        importance = "high" if str(item.get("importance", "")).lower() == "high" else "normal"
        needs_reply = bool(item.get("needs_reply")) and importance == "high"
        category = str(item.get("category") or "inquiry")[:40]
        reason = trunc(item.get("reason") or "", 120)
        verdicts[mid] = (importance, category, needs_reply, reason)
    updated = 0
    with conn.cursor() as cur:
        for mid, (importance, category, needs_reply, reason) in verdicts.items():
            classification = json.dumps({
                "by": "luna", "importance": importance, "category": category,
                "needs_reply": needs_reply, "reason": reason,
            })
            cur.execute(
                """
                UPDATE messages
                SET importance = %s, category = %s, needs_reply = %s,
                    luna_classified_at = now(), luna_classification = %s::jsonb
                WHERE id = %s
                """,
                (importance, category, needs_reply, classification, mid),
            )
            updated += 1
    conn.commit()
    log(f"triage: classified {updated} email(s)")
    return updated


def fetch_needs_draft(conn):
    """High-priority, unanswered emails Luna hasn't yet drafted a reminder for."""
    return _query(
        conn,
        """
        SELECT id, name, email, subject, message
        FROM messages
        WHERE importance = 'high' AND needs_reply = true
          AND lower(coalesce(status, '')) NOT IN ('replied', 'archived')
          AND coalesce(luna_classification->>'reminded', '') <> 'true'
          AND created_at >= now() - make_interval(days => %s)
        ORDER BY created_at ASC
        LIMIT %s
        """,
        (TRIAGE_LOOKBACK_DAYS, TRIAGE_MAX_DRAFTS),
    ) or []


def draft_and_insight(conn, row) -> bool:
    """Draft a guest-voice reply and drop a one-tap 'review & reply' insight.
    Marks the message reminded so we never re-alert it on a later pass."""
    mid, name, email, subject, message = row
    prompt = "\n".join([
        TRIAGE_DRAFT_PREAMBLE, "", KNOWLEDGE_PACK, "",
        "CUSTOMER EMAIL:",
        f"from: {name or '?'} <{email or '?'}>",
        f"subject: {subject or ''}",
        "",
        trunc(message or "", 1200),
    ])
    draft = plainify(ask_luna(prompt, session_tag=f"triage-draft-{mid}")).strip()
    who = (name or email or "a guest").split("@")[0]
    # Always mark reminded (even if the draft came back empty) so a persistently
    # bad email can't wedge the queue and re-burn Luna calls every pass.
    with conn.cursor() as cur:
        if draft:
            title = f"Reply needed: {trunc(subject or who, 60)}"
            body = (f"{who} sent something that needs a reply. I drafted one - review and send, "
                    f"or tweak it first.")
            data = {
                "deep_link": "/messages",
                "sources": [f"messages#{mid}"],
                "action": {
                    "type": "draft_reply",
                    "label": "Review & reply",
                    "deep_link": "/messages",
                    "draft": draft,
                    "payload": {"messageId": mid},
                },
            }
            cur.execute(
                """
                INSERT INTO luna_insights (kind, title, body, status, data)
                VALUES ('alert', %s, %s, 'new', %s::jsonb)
                """,
                (title, body, json.dumps(data)),
            )
        cur.execute(
            """
            UPDATE messages
            SET luna_classification =
                coalesce(luna_classification, '{}'::jsonb) || '{"reminded": true}'::jsonb
            WHERE id = %s
            """,
            (mid,),
        )
    conn.commit()
    if draft:
        log(f"triage: drafted reply + alert for message {mid}")
        return True
    log(f"triage: message {mid} produced no draft; marked reminded")
    return False


def run_triage(conn) -> None:
    """One triage pass: classify new mail, then draft + alert the urgent unanswered."""
    try:
        classify_batch(conn, fetch_unclassified(conn))
    except DB_ERRORS:
        raise
    except LunaUnavailable as e:
        log(f"triage: Luna unavailable for classify ({e}); will retry next pass")
        return
    except Exception as e:
        log(f"triage: classify pass failed: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
    try:
        for row in fetch_needs_draft(conn):
            try:
                draft_and_insight(conn, row)
            except LunaUnavailable as e:
                log(f"triage: Luna unavailable for draft ({e}); stopping pass")
                break
            except Exception as e:
                log(f"triage: draft failed for one message: {e}")
                try:
                    conn.rollback()
                except Exception:
                    pass
    except DB_ERRORS:
        raise


def run_triage_once() -> int:
    """One-shot triage (for manual runs / a cron). Mirrors run_briefing."""
    conn = None
    try:
        conn = connect_db()
        run_triage(conn)
        return 0
    except Exception as e:
        log(f"triage one-shot FAILED: {e}")
        return 1
    finally:
        close_quietly(conn)


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

def main() -> int:
    missing = [name for name, val in
               (("LUNA_BRIDGE_DSN", DSN), ("LUNA_API_TOKEN", LUNA_API_TOKEN))
               if not val]
    if missing:
        log(f"FATAL: missing required env var(s): {', '.join(missing)}")
        return 2

    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))

    if "--briefing" in sys.argv[1:]:
        return run_briefing()
    if "--triage" in sys.argv[1:]:
        return run_triage_once()
    run_daemon()
    return 0


if __name__ == "__main__":
    sys.exit(main())
