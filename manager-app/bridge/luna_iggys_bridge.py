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
           "new_messages": None}

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

    return "\n".join(lines)


# --------------------------------------------------------------------------
# Prompts
# --------------------------------------------------------------------------

def build_question_prompt(ctx: dict, author_email, content: str,
                          history=None) -> str:
    parts = [
        "You are Luna answering inside the Iggy's Seaside bar manager "
        "dashboard (Seaside, Oregon). A manager asked the question below. "
        "Be concise, concrete, and helpful. Reply with the answer itself "
        "only - no acknowledgment of these instructions, and no markdown "
        "syntax (no ** or # markers; plain text and simple dashes only).",
        "",
        "CONTEXT:",
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
    return (
        "You are Luna, the AI assistant for Iggy's Seaside bar (Seaside, "
        "Oregon). Write a crisp morning briefing for the bar owner. Cover: "
        "1) what's coming up (events and parties worth knowing about), "
        "2) what needs attention (unread messages, gaps, anything odd), "
        "3) exactly one concrete suggestion for today. Short and scannable; "
        "no preamble, no sign-off, and no markdown syntax (no ** or # "
        "markers; plain text and simple dashes only).\n\n"
        "CONTEXT:\n"
        f"{context_block(ctx)}"
    )


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
    log(f"bridge daemon starting (poll every {POLL_SECONDS}s, "
        f"Luna at {LUNA_API_URL})")
    conn = None
    backoff = 2
    while True:
        try:
            if conn is None or conn.closed:
                conn = connect_db()
                requeue_stuck(conn)
                backoff = 2
            if process_pending(conn) == 0:
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
        title = f"Morning briefing - {date.today().strftime('%b %d')}"
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO luna_insights (kind, title, body, status)
                VALUES ('briefing', %s, %s, 'new')
                """,
                (title, reply),
            )
        conn.commit()
        log(f"briefing: inserted '{title}' ({len(reply)} chars)")
        return 0
    except Exception as e:
        log(f"briefing FAILED: {e}")
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
    run_daemon()
    return 0


if __name__ == "__main__":
    sys.exit(main())
