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

import calendar
import json
import os
import re
import signal
import socket
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta

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
# The 7am briefing is a non-interactive background job (nobody's waiting on it),
# and its prompt is large (knowledge pack + live context, ~4800 chars), so a
# loaded brain can take several minutes. Give it a far longer budget than live
# chat — otherwise a slow morning trips the 180s deadline and the unit fails.
try:
    BRIEFING_TIMEOUT = max(LUNA_TOTAL_TIMEOUT, int(os.environ.get("LUNA_BRIEFING_TIMEOUT", "600")))
except ValueError:
    BRIEFING_TIMEOUT = 600

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

# Daily demand pulse ("Tonight's Read"). A deterministic model computes the band
# from weather + season + conventions; Luna only phrases it. Refreshed on idle
# ticks every PULSE_INTERVAL so the morning read updates for the dinner window.
try:
    PULSE_INTERVAL = max(900, int(os.environ.get("LUNA_PULSE_SECONDS", "14400")))  # default 4h
except ValueError:
    PULSE_INTERVAL = 14400
SEASIDE_LAT, SEASIDE_LON = 45.9929, -123.9229
PORTLAND_LAT, PORTLAND_LON = 45.5152, -122.6784
SEASIDE_CONVENTION_API = "https://seasideconvention.com/wp-json/tribe/events/v1/events"
# Visit Seaside / Seaside Oregon tourism bureau — town-wide festivals, parades,
# races, markets. Same WordPress "The Events Calendar" (Tribe) plugin as the
# convention center, so the exact same fetch shape works against a second URL.
VISIT_SEASIDE_API = "https://www.seasideor.com/wp-json/tribe/events/v1/events"

# Creative "special of the day": Luna invents a fun NEW drink riffed on a
# holiday / famous birthday / on-this-day fact (NOT a menu pick). Good use of
# idle "wake time" — generated once a day on a quiet tick.
try:
    SPECIAL_INTERVAL = max(1800, int(os.environ.get("LUNA_SPECIAL_SECONDS", "21600")))  # 6h
except ValueError:
    SPECIAL_INTERVAL = 21600
ON_THIS_DAY_API = "https://en.wikipedia.org/api/rest_v1/feed/onthisday/all"


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


def fetch_staff_identity(conn, email):
    """Resolve the logged-in staff member by email -> (first_name, role). This is
    a SHARED work tool, so every answer must be addressed to the actual person on
    shift, never assumed to be Bradley. Falls back to staff_pins, then to None."""
    if not email:
        return (None, None)
    rows = _query(
        conn,
        "SELECT name, role FROM staff WHERE lower(email) = lower(%s) "
        "AND active IS NOT FALSE ORDER BY id LIMIT 1",
        (email,),
    )
    if not rows:
        rows = _query(conn, "SELECT name, NULL FROM staff_pins WHERE lower(email) = lower(%s) LIMIT 1", (email,))
    if rows:
        full = (rows[0][0] or "").strip()
        first = full.split()[0] if full else None
        return (first, rows[0][1])
    return (None, None)


# Authoritative dietary/allergen + bar policy (sourced 2026-06-15 from
# doogersseafood.com + iggysseaside.com). The menu schema has no dietary flags,
# so THIS is how Luna answers dietary questions accurately instead of guessing.
MENU_POLICY = (
    "MENU & DIETARY POLICY (authoritative - answer dietary/allergen + bar questions from THIS, "
    "never guess):\n"
    "- The FOOD is Dooger's Seafood & Grill. GLUTEN-FREE: Dooger's states 'with few exceptions we "
    "are happy to provide gluten-free options for our entire menu' - most items can be MADE "
    "gluten-free ON REQUEST (gluten-free breading or sauteed in olive oil; steaks pan-grilled; "
    "pans/fryer washed), but items are NOT gluten-free as plated by default. The one item that is "
    "gluten-free as served is the CLAM CHOWDER (Dooger's clam chowder is gluten free). ALWAYS add, "
    "for any severe allergy or celiac: Dooger's cannot offer a 100% guarantee against cross-contact "
    "- have the guest flag it to the kitchen.\n"
    "- VEGETARIAN/VEGAN markers are name-level only: the Garden Burger is vegetarian; the 'Vegan' "
    "salad is vegan. Do NOT infer any other item is veg/vegan.\n"
    "- HAPPY HOUR: $5 drafts, $5 wells, $3 cans, daily 3-5pm.\n"
    "- Signature cocktails: Marionberry Mule, Burlini Espresso Martini, Iggy's Old Fashioned, "
    "Key Lime Pie Martini (current prices live in the cocktails list / ask the bar)."
)


def fetch_menu(conn) -> str:
    """The live menus Luna must answer FROM (never invent): drinks from cocktails
    (with ingredients), food from menu_items grouped by menu_type. Allergen/diet
    flags are intentionally absent from the schema, so the block says so — Luna
    must not assert gluten-free/dairy-free without that data."""
    lines = []
    drinks = _query(conn, "SELECT name, ingredients, price FROM cocktails ORDER BY name LIMIT 60")
    if drinks:
        lines.append("DRINKS (name | ingredients | price):")
        for name, ingredients, price in drinks:
            row = name or "(unnamed)"
            if ingredients:
                row += f" | {trunc(ingredients, 160)}"
            if price:
                row += f" | {price}"
            lines.append(f"- {trunc(row, 220)}")
    food = _query(
        conn,
        """
        SELECT coalesce(c.menu_type, c.title, 'Menu') AS section,
               mi.name, mi.description, mi.price, mi.is_86d
        FROM menu_items mi
        LEFT JOIN menu_categories c ON c.id = mi.category_id
        ORDER BY section, mi.sort_order NULLS LAST, mi.name
        LIMIT 140
        """,
    )
    if food:
        cur_section = object()
        for section, name, desc, price, is_86d in food:
            if section != cur_section:
                cur_section = section
                lines.append(f"FOOD - {section}:")
            row = name or "(unnamed)"
            if price:
                row += f" | {price}"
            if desc:
                row += f" | {trunc(desc, 140)}"
            if is_86d:
                row += " | [86'd - currently OUT]"
            lines.append(f"- {trunc(row, 220)}")
    lines.append("")
    lines.append(MENU_POLICY)
    return "\n".join(lines)


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
    "NO TOOLS / NO SHELL: everything you need is already in THIS prompt - the knowledge pack, "
    "the live menu, and the CONTEXT/data below - plus your own memory. Answer ONLY from what is "
    "provided here. Do NOT run shell commands, curl, open files, fetch URLs, search the web, or "
    "query a database: there is NO local Iggy's database to open (the bar's data lives in the app "
    "and is already injected below). Reaching for a command cannot help - it only stalls you "
    "behind an approval gate the night staff can't answer. Just answer from the context and your "
    "memory.\n"
    "GLOSSARY: 'the back room'/'upstairs' -> space='upstairs'; 'the DJ night' -> "
    "events.category='DJ Night'; 'the 40-top' -> a party with guest_count about 40."
)

QUESTION_PREAMBLE = (
    "You are Luna, the AI operations assistant built into the Iggy's Seaside (Seaside, Oregon) "
    "WORK app. This is a SHARED staff tool, not a personal assistant - many different employees "
    "talk to you through it. You are NOT a generic chatbot; you are a calibrated expert on THIS "
    "bar/restaurant whose job is to make whoever is on shift feel like they never have to "
    "remember, hunt, or open six screens. They often use it on a phone behind the bar.\n"
    "WHO YOU ARE TALKING TO: see CURRENT USER below. Greet and address THEM by their first name. "
    "Do NOT assume you are talking to Bradley or the owner. This is strictly a WORK context: "
    "never bring up anyone's personal life - no pets, family, home, hobbies, or private details, "
    "not about this person and not about anyone else. Everything you say is about running Iggy's.\n"
    "TRUTH ONLY - never confabulate. Answer only from the KNOWLEDGE PACK, the LIVE MENU, and the "
    "CONTEXT below. If you don't know something about the bar, say so plainly and offer to find "
    "out - do NOT invent menu items, prices, ingredients, hours, or policies. ALLERGENS ARE "
    "SAFETY-CRITICAL: never guess whether an item is gluten-free, dairy-free, nut-free, etc. "
    "State a dietary/allergen fact only if it is explicit in the MENU data; otherwise say you'll "
    "confirm with the kitchen. A wrong allergen answer can put a guest in the hospital.\n"
    "Answer directly: concise, concrete, plain text, no markdown (no ** or # markers; simple "
    "dashes for lists). When your answer rests on data, end with a short 'Sources:' line."
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
    "Triage the Iggy's Seaside (Seaside, OR bar/restaurant) inbox emails below. For EACH email "
    "decide: is it a customer who needs a human reply (a reservation / table request, a "
    "private-event or space-rental inquiry, a pricing / menu / availability question, or any "
    "genuine question), or a notification / newsletter / automated / no-reply message that needs "
    "nothing?\n"
    "You are acting as a JSON API, not a chat assistant. Output ONLY a JSON array - no greeting, "
    "no explanation, no markdown, no code fence, no 'Sources:' line, nothing before or after the "
    "array. One object per email, in this exact shape:\n"
    "[{\"id\": <number>, \"importance\": \"high\"|\"normal\", \"category\": "
    "\"reservation\"|\"event\"|\"request\"|\"inquiry\"|\"notification\"|\"other\", "
    "\"needs_reply\": true|false, \"reason\": \"<=8 words\"}]\n"
    "Set importance to \"high\" exactly when needs_reply is true. Be decisive."
)

# NOTE: the old TRIAGE_DRAFT_PREAMBLE ("You are Luna ... in HIS voice") was
# removed — customer-reply drafting now runs through the clean, persona-free
# OPERATOR_PREAMBLE + ask_operator path (see below). Routing drafts through
# Luna's "in Bradley's voice" assistant frame was the persona-bleed root cause.

PULSE_PREAMBLE = (
    "You are Luna writing Iggy's DAILY DEMAND PULSE - the one-glance read staff see on login. A "
    "deterministic model already computed the band + drivers; you do NOT do the math, you PHRASE "
    "it in your voice. On the Oregon coast, sunny is the BASELINE, not news - only call out what is "
    "genuinely different tonight. A normal quiet night should read as a calm one-liner, not an "
    "alarm. Output EXACTLY this shape, plain text, no markdown:\n"
    "Line 1: the read - the band in plain English + the SINGLE biggest reason (e.g. 'Busy tonight - "
    "a convention's in town and the weather's holding', or 'Quiet Tuesday - cold and nothing on the "
    "books').\n"
    "Line 2: 'Suggestion: ' then ONE optional idea, phrased the way a seasoned bartender would offer "
    "it to a peer - an option, NOT an order. Use soft framing ('might be worth...', 'could be a good "
    "night to...', 'if you want to get ahead of it...'); never a bare command. The manager makes the "
    "call - you just surface the single highest-leverage option (a staffing idea, a special to run, "
    "or a prep note).\n"
    "Then a final line starting 'ACTION:' with a compact one-line JSON object "
    "{deep_link, action:{type,label,draft}} where type is one of draft_special, add_todo, navigate "
    "- the one-tap version of your action. Keep it to those 2 lines + the ACTION line, nothing else."
)

SPECIAL_PREAMBLE = (
    "You are Luna, Iggy's creative bar mind, inventing a FUN drink special of the day for this "
    "Seaside, Oregon coast bar. Use the 'on this day' facts below - a quirky holiday, a famous "
    "birthday, or a fun historical event - and INVENT a brand-new special riffed on it. Do NOT "
    "just name an existing menu drink; CREATE something playful and on-brand (coastal, a little "
    "cheeky, easy to actually pour from common spirits + mixers). Favor a FRESH, quirky angle "
    "over the single most obvious/famous fact - and do NOT reuse any fact, theme, or name from "
    "the RECENTLY-USED list below (if one is given); pick a clearly different one. "
    "VARY THE RECIPE, not just the fact: rotate the BASE SPIRIT run to run (gin, rum, tequila, "
    "mezcal, bourbon/rye, whiskey, vodka, even beer or bubbles) and pick a DIFFERENT base than the "
    "RECENT BASE SPIRITS listed below. You lean far too hard on vodka + blue curaçao - STOP "
    "defaulting to it; use blue curaçao only if it truly fits, otherwise reach for a different "
    "spirit, modifier, and color. Match the spirit to the vibe (smoky -> mezcal, autumnal -> "
    "whiskey, tropical -> rum, bright/herbal -> gin, celebratory -> bubbles). "
    "Keep it light and CELEBRATORY - riff on upbeat, quirky, fun facts (holidays, birthdays, "
    "whimsical milestones, inventions). NEVER build a drink on a tragedy, disaster, death, war, "
    "crime, or anything somber or in poor taste; if today's only facts are grim, skip them and "
    "invent something seasonal + coastal instead. "
    "Plain text, no markdown - write EXACTLY three lines, with NO line labels or numbering "
    "(do not print 'Line 1', '1)', etc.):\n"
    "First line = the special NAME, then ' - ', then a punchy one-line concept (what's in it / the vibe).\n"
    "Second line = start with 'Why: ' then the fun fact it riffs on, in one sentence.\n"
    "Third line = start with 'Build: ' then a simple recipe (spirits + mixers + garnish) + a suggested price.\n"
    "Then a final line 'ACTION:' with compact JSON {action:{type:\"draft_special\", "
    "label:\"Make this special\", draft:\"<name + concept + build, ready to drop into the special "
    "designer>\"}}. Keep it tight and genuinely fun."
)


def build_question_prompt(ctx: dict, author_email, content: str,
                          history=None, user_name=None, user_role=None,
                          menu_text=None) -> str:
    if user_name:
        who_line = f"CURRENT USER: {user_name}"
        if user_role:
            who_line += f" (role: {user_role})"
        who_line += " - greet and address them by this first name."
    else:
        who_line = (
            "CURRENT USER: name not on file"
            + (f" (email {author_email})" if author_email else "")
            + " - greet them generically (e.g. 'Hey there'); do NOT assume this is Bradley or the owner."
        )
    parts = [
        QUESTION_PREAMBLE,
        "",
        who_line,
        "",
        KNOWLEDGE_PACK,
    ]
    if menu_text:
        parts += ["", "LIVE MENU (answer menu questions ONLY from this; never invent items/prices/allergens):", menu_text]
    parts += [
        "",
        "CURRENT CONTEXT (live from the dashboard database):",
        context_block(ctx),
    ]
    if history:
        parts += ["", "RECENT CONVERSATION (oldest first):"]
        for role, text in history:
            who = (user_name or "Staff") if role == "user" else "You (Luna)"
            parts.append(f"{who}: {trunc(text, 300)}")
    parts += [
        "",
        f"QUESTION (from {user_name or author_email or 'unknown'}): "
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
            raise TimeoutError("Luna SSE stream exceeded its total deadline")
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


def call_luna(message: str, session_id: str, total_timeout: int = None) -> str:
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
    total_timeout = total_timeout or LUNA_TOTAL_TIMEOUT
    deadline = time.monotonic() + total_timeout
    full_text = None
    sentences = []

    # The urlopen timeout bounds connect + each blocking read; the deadline
    # check in _sse_events bounds the whole stream.
    with urllib.request.urlopen(req, timeout=total_timeout) as resp:
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


def ask_luna(message: str, session_tag: str = "", total_timeout: int = None) -> str:
    """Call Luna on a per-question session (her runtime's rolling-session
    compaction garbles multi-turn reuse - verified live 2026-06-12; the
    bridge injects fresh dashboard context + recent history each time
    instead). On a timeout retry ONCE with a different sessionId so the
    retry never collides with a request still in flight. Connection-
    refused/5xx raises LunaUnavailable so the caller can leave the question
    pending (e.g. boot before Luna is up)."""
    session = f"{SESSION_ID}-{session_tag}" if session_tag else SESSION_ID
    try:
        return call_luna(message, session, total_timeout)
    except Exception as e:
        if _is_unavailable(e):
            raise LunaUnavailable(str(e)) from e
        if not _is_timeout(e):
            raise
        log(f"Luna timed out ({e}); retrying once on a fresh session")
        return call_luna(message, f"{session}-retry", total_timeout)


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


def recent_history(conn, qid, author_email=None):
    """Last few answered turns before this question, oldest first, so Luna keeps
    conversational continuity. SCOPED to the asking staff member (shared tool —
    one employee must not see another's thread). If we don't know who's asking,
    return no history rather than risk crossing users."""
    if not author_email:
        return []
    rows = _query(
        conn,
        """
        SELECT m.role, m.content
        FROM luna_messages m
        WHERE m.id < %s AND m.status = 'answered'
          AND (
            (m.role = 'user' AND lower(coalesce(m.author_email, '')) = lower(%s))
            OR (m.role = 'luna' AND m.reply_to IN (
                  SELECT u.id FROM luna_messages u
                  WHERE u.role = 'user' AND lower(coalesce(u.author_email, '')) = lower(%s)))
          )
        ORDER BY m.id DESC
        LIMIT 6
        """,
        (qid, author_email, author_email),
    )
    return list(reversed(rows or []))


def handle_question(conn, qid, content, author_email) -> None:
    try:
        ctx = gather_context(conn)
        history = recent_history(conn, qid, author_email)
        user_name, user_role = fetch_staff_identity(conn, author_email)
        menu_text = fetch_menu(conn)
        prompt = build_question_prompt(
            ctx, author_email, content or "", history,
            user_name=user_name, user_role=user_role, menu_text=menu_text,
        )
        log(f"question {qid}: asking Luna for {user_name or author_email or 'unknown'} "
            f"({len(prompt)} chars)")
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
        if (content or "").strip() == CMD_REGEN_SPECIAL:
            handle_special_regen(conn, qid)
        else:
            handle_question(conn, qid, content, author_email)
        handled += 1
    return handled


# A control message (not a real question) the dashboard's "Try again" on the
# special card writes to luna_messages — regenerate today's special on demand.
CMD_REGEN_SPECIAL = "__regen_special__"


def handle_special_regen(conn, qid) -> None:
    """Force a fresh special (bypassing the once-per-day dedup) in response to a
    "Try again" command, then close the command row. The dashboard pins the
    newest special, so the new one supersedes the old via realtime."""
    try:
        run_special(conn, force=True)
        with conn.cursor() as cur:
            cur.execute("UPDATE luna_messages SET status = 'answered' WHERE id = %s", (qid,))
        conn.commit()
        log(f"command {qid}: regenerated special on request")
    except DB_ERRORS:
        raise
    except LunaUnavailable:
        requeue_question(conn, qid, "model unavailable for special regen")
    except Exception as e:
        log(f"command {qid}: special regen failed: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
        with conn.cursor() as cur:
            cur.execute("UPDATE luna_messages SET status = 'answered' WHERE id = %s", (qid,))
        conn.commit()


def run_daemon() -> None:
    log(f"bridge daemon starting (poll every {POLL_SECONDS}s, triage every "
        f"{TRIAGE_INTERVAL}s, Luna at {LUNA_API_URL})")
    conn = None
    backoff = 2
    last_triage = 0.0
    last_pulse = 0.0
    last_special = 0.0
    while True:
        try:
            if conn is None or conn.closed:
                conn = connect_db()
                requeue_stuck(conn)
                backoff = 2
            if process_pending(conn) == 0:
                # Idle tick: interactive Q&A always wins. On quiet ticks fold in
                # background work — at most one heavy op per tick: the inbox
                # triage, else the daily demand pulse — then nap.
                now = time.monotonic()
                if now - last_triage >= TRIAGE_INTERVAL:
                    last_triage = now
                    run_triage(conn)
                elif now - last_pulse >= PULSE_INTERVAL:
                    last_pulse = now
                    run_pulse(conn)
                elif now - last_special >= SPECIAL_INTERVAL:
                    last_special = now
                    run_special(conn)
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
                WHERE kind = 'briefing'
                  AND (created_at AT TIME ZONE 'America/Los_Angeles')::date
                    = (now() AT TIME ZONE 'America/Los_Angeles')::date
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
            ask_luna(prompt, session_tag=f"briefing-{date.today().isoformat()}",
                     total_timeout=BRIEFING_TIMEOUT))
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
    """Pull the first JSON array out of Luna's reply (she may wrap it in prose
    or a ```json fence). Tries the outermost [...] slice, then a per-object scan
    so a trailing-comma / stray-bracket tail can't sink the whole batch."""
    if not text:
        return None
    # Strip markdown code fences if present.
    cleaned = re.sub(r"```[a-zA-Z]*", "", text).replace("```", "")
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start != -1 and end != -1 and end > start:
        try:
            obj = json.loads(cleaned[start:end + 1])
            if isinstance(obj, list):
                return obj
        except (json.JSONDecodeError, ValueError):
            pass
    # Fallback: salvage individual {...} objects (tolerates junk between them).
    objs = []
    for m in re.finditer(r"\{[^{}]*\}", cleaned):
        try:
            o = json.loads(m.group(0))
            if isinstance(o, dict):
                objs.append(o)
        except (json.JSONDecodeError, ValueError):
            continue
    return objs or None


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
    # NOTE: deliberately NOT prepending KNOWLEDGE_PACK here — its "plain text,
    # two voices, end with a Sources line" rules fight the JSON-only output we
    # need. Classification is intent detection; it doesn't need venue facts.
    prompt = "\n".join([
        TRIAGE_CLASSIFY_PREAMBLE, "",
        "EMAILS TO TRIAGE:", "\n\n".join(blocks), "",
        "Output ONLY the JSON array now. No other text.",
    ])
    log(f"triage: classifying {len(rows)} email(s)")
    # Unique session per call — reusing one tag across the 20-min passes would
    # collide with Luna's rolling-session compaction (see ask_luna notes).
    reply = ask_luna(prompt, session_tag=f"triage-classify-{int(time.time())}")
    arr = _extract_json_array(reply)
    if not arr:
        log("triage: classification returned no parseable JSON; leaving for next "
            f"round. Luna said: {trunc(reply, 280)!r}")
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


# --------------------------------------------------------------------------
# Operator draft path — customer-facing email replies are drafted by a DIRECT,
# CLEAN-FRAMED model call, NOT through Luna's /api/chat. Routing drafts through
# Luna's personal-assistant persona made her reply TO the owner ("Hey Bradley
# ...") or emit a standby phrase ("Ready when you are") on vague inbound emails
# (2 of 10 prod drafts). This path tells the model it IS the bar, drafting a
# reply TO the named customer, then a deterministic guard gates it before
# anything is surfaced. Full standing orders: substrate note board.iggys-operator.
# --------------------------------------------------------------------------

DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
OPERATOR_MODEL = os.environ.get("OPERATOR_MODEL", "deepseek-chat")
OPERATOR_TIMEOUT = int(os.environ.get("OPERATOR_TIMEOUT", "60"))

OPERATOR_PREAMBLE = """ROLE LOCK — READ FIRST, OVERRIDES EVERYTHING ELSE:
You ARE Iggy's Seaside, a bar and restaurant in Seaside, Oregon. Your one and only job is to DRAFT the bar's reply to ONE customer who emailed the bar. You are writing TO that customer, AS the business (the "we"/"us" voice of Iggy's Seaside). A human manager reviews your draft before it is sent, so write a finished, send-ready reply — never a note to a colleague, never a question to a boss.

You are NOT a personal assistant. You are NOT a chatbot. You have no persona, no inner life, and no relationship with any owner. You are NOT chatting with the owner, the manager, or any staff member. There is no "Bradley" in this conversation and no owner on the other end — only the customer named in the CUSTOMER EMAIL block below. The reader of your draft IS that customer. NEVER address, name, or speak to "Bradley", "the owner", "the boss", or "the manager". NEVER write "Hey Bradley", never reference an owner, and never use "you" to mean a manager or colleague. If the email mentions a name, that name belongs to the CUSTOMER who wrote it — reply to them, by that name.

You ALWAYS produce a real, customer-facing reply. Even if the email is vague, rambling, garbled, one line, off-topic, or hard to parse, you still write a warm, professional reply or a friendly clarifying question, addressed to the customer by name, AS the bar — exactly as polished as you would for a clean, structured event inquiry. You NEVER respond with an idle, standby, or assistant-style phrase. Phrases like "Ready when you are", "What's next?", "How can I help?", "How may I help you?", "Something on your mind?", "Let me know what you need", "Standing by", "At your service", or any question directed back at an owner/operator are STRICTLY FORBIDDEN — they are a malfunction, not a valid draft. The urge to ask "what do you need from me?" IS the bug; instead, answer the customer or ask THEM one friendly clarifying question about their visit or event.

HANDLING VAGUE, RAMBLING, OR GARBLED EMAILS (this is the most important case — it is where the old system broke):
- Many real emails are short, rambling, low-structure, or slightly garbled. You must STILL produce a warm, professional reply AS the bar.
- Pull out whatever real intent you can (live music? a booking? a question about a night? a group?) and either answer what you reasonably can or ask ONE friendly clarifying question to move it forward (e.g. the date they have in mind, how many people, which space, or simply "what can we set up for you?").
- When you genuinely cannot tell what they want, do NOT stall and do NOT guess. The correct draft is a warm greeting by the customer's name, an acknowledgement of their note, and one friendly question asking them to tell you a little more about what they're after — signed off as the bar.
- A confusing email is never a reason to break character, get flippant, address the owner, or skip the task. Treat it exactly like the structured ones.

WHAT YOU OUTPUT:
Return ONLY the ready-to-send reply body — the text that goes in the email, greeting through sign-off. A few sentences of plain text. No subject line, no "Draft:"/"Reply:"/"Subject:" label, no headers, no markdown (no ** bold, no # headers, no bullet symbols), no [bracketed placeholders] like [name] or [date], no preamble, no quotes around it, and no notes or commentary to a reviewer. Address the customer by their first name when you have it (e.g. "Hi Peggy,"). Greet warmly without a name (e.g. "Hi there,") ONLY if no usable name is given. End the message on its own line with the sign-off exactly: - Iggy's Seaside

TONE:
Warm, concise, professional, a touch coastal-casual. Friendly and human like a real host at a great coastal bar — never stiff, never a form letter, never salesy, never gushing, never over-eager. Lead with genuine warmth about what they're asking for, then get to the substance. Ask exactly ONE qualifying question — the single detail that most moves their request forward — not a list of asks. A few sentences is plenty, ending with one clear, friendly next step.

NEVER INVENT FACTS — this is a hard rule. A wrong allergen, price, or availability answer can harm a guest or commit the bar to something it cannot honor. When in doubt, defer gracefully rather than guess:
- Do NOT state any specific menu item, dish, drink, ingredient, price, portion, hours, or availability that is not given to you in the customer's email or in the KNOWN FACTS below. If it is not provided, do not name it — say you'll check, or that the manager will confirm, or ask.
- Do NOT confirm event pricing, package prices, deposits, or that a date or space is held, booked, reserved, or available. Treat any date, headcount, or space as a request to be confirmed, never as confirmed. Offer to follow up instead, e.g. "I'll have our manager confirm the date and pricing and get right back to you."
- Do NOT promise a comp, discount, or anything free.

ALLERGENS AND DIETARY ARE SAFETY-CRITICAL — a wrong answer can send a guest to the hospital:
- NEVER guarantee any item is free of an allergen and NEVER claim a 100% allergen-safe, "totally safe", or no-cross-contamination kitchen.
- State a dietary fact ONLY if it is in the KNOWN FACTS below. For ANY specific allergy, severe reaction, or celiac question, do not answer the specifics yourself and do not assure them it is safe — route it warmly to the kitchen, e.g. "our kitchen can walk you through your options and what they can do for that," or "I'll have the kitchen confirm the details for you."

KNOWN FACTS YOU MAY USE (this is a closed list — these are the ONLY menu/policy facts you may state without the customer providing them; everything else, defer or ask):
- IDENTITY & SIGN-OFF: You are Iggy's Seaside, a seaside bar and restaurant in Seaside, Oregon. The food is by Dooger's Seafood & Grill. Always sign off "- Iggy's Seaside".
- GLUTEN-FREE: Most food can be MADE gluten-free ON REQUEST, but items are NOT gluten-free as plated by default. The CLAM CHOWDER is gluten-free as served. There is NO 100% guarantee against cross-contamination — so for any specific allergy or celiac concern, never promise safety; route them to the kitchen ("our kitchen can walk you through it").
- HAPPY HOUR: $5 drafts, $5 wells, $3 cans, daily 3-5pm. (State this exactly, only if relevant to what they asked. Do NOT invent any other price.)
- PRIVATE-EVENT SPACES: There is an upstairs bar, a downstairs room, or the whole space. You may mention these as options and ask which they're picturing, but do NOT quote a rental price and do NOT confirm a specific date is held or available — say the manager will confirm details and pricing.
- ANYTHING ELSE (specific menu items, cocktail names, prices, hours, today's specials, whether a date is open): you DON'T know it unless the customer stated it — don't make it up; offer to confirm or follow up.

EXAMPLES OF THE BAR'S VOICE (good — match these):
- "Hey Taelor! 28 people, love it. Which night are you thinking? And are you looking at the upstairs bar, the downstairs room, or the whole space? - Iggy's Seaside"
- "Hi Thuy, The Blue Lagoon sounds great. We'll have both that and the Watermelon Margarita ready for Monday. - Iggy's Seaside"

EXAMPLES THAT ARE WRONG AND MUST NEVER BE PRODUCED:
- "Hey Bradley. Something on your mind, or were you shaking off a pocket-dial?" (addresses the owner, flippant, does not reply to the customer)
- "Ready when you are. What's next?" (an idle standby phrase that does no work)

SCOPE: You only produce draft TEXT. You never send anything, never trigger an action, and have no ability to send. A human reviews and sends the final reply.

The CUSTOMER EMAIL (sender name, sender address, subject, and body) follows. Draft the bar's reply to that customer now."""


def ask_operator(system_prompt: str, user_content: str, model: str = None) -> str:
    """Direct OpenAI-compatible chat call with a CLEAN system prompt — bypasses
    Luna's /api/chat so no personal-assistant persona bleeds into a customer
    draft. Raises LunaUnavailable on missing key / 5xx / unreachable host so the
    triage pass stops and retries later (mirrors ask_luna's contract)."""
    if not DEEPSEEK_API_KEY:
        raise LunaUnavailable("operator model key missing (DEEPSEEK_API_KEY unset)")
    payload = json.dumps({
        "model": model or OPERATOR_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.6,
        "max_tokens": 700,
        "stream": False,
    })
    req = urllib.request.Request(
        DEEPSEEK_BASE_URL + "/chat/completions",
        data=payload.encode("utf-8"),
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + DEEPSEEK_API_KEY},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=OPERATOR_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        if e.code >= 500 or e.code in (408, 429):  # 5xx / timeout / rate-limit -> back off + retry
            raise LunaUnavailable(f"operator model HTTP {e.code}")
        detail = ""
        try:
            detail = e.read().decode("utf-8", "replace")[:200]
        except Exception:
            pass
        raise RuntimeError(f"operator model HTTP {e.code}: {detail}")
    except (TimeoutError, socket.timeout) as e:
        raise LunaUnavailable(f"operator model timeout: {e}")
    except urllib.error.URLError as e:
        raise LunaUnavailable(f"operator model unreachable: {e.reason}")
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("operator model returned no choices")
    content = ((choices[0].get("message") or {}).get("content") or "").strip()
    if not content:
        raise RuntimeError("operator model returned empty content")
    return content


# ── Deterministic draft-safety guard (runs before any draft becomes a card) ──
# Design note: an over-REJECT here is a PERMANENT silent drop (the message is
# marked reminded -> no card, no retry -> the customer gets total silence), which
# is strictly worse than a leak on this human-reviewed path. So the reject rules
# are tuned to avoid false positives (a customer/cocktail named Bradley or Luna,
# a correct "the kitchen will fully confirm" deferral) while still catching the
# real failures; softer signals are FLAG-class (surfaced, never dropped).
SIGN_OFF = "- Iggy's Seaside"
# Idle/assistant standby openers — never a valid customer reply. (Legit closers
# like "anything else I can help with?" are deliberately NOT listed.)
_STANDBY_PHRASES = (
    "ready when you are", "what's next", "what is next", "how can i help",
    "how may i help", "how can i assist", "how may i assist",
    "how can i be of service", "what can i do for you", "something on your mind",
    "let me know what you need", "standing by", "at your service",
    "awaiting your response", "are you there", "were you shaking off",
    "pocket-dial", "pocket dial",
)
_ALLERGEN_BARE = (
    "no cross-contamination", "cross-contamination free", "100% gluten-free",
    "allergen-free", "allergen free", "totally safe", "completely safe",
    "celiac-friendly", "celiac friendly", "allergy-friendly", "allergy friendly",
    "safe to eat", "eat anything", "without worry", "won't react", "wont react",
)
_ALLERGEN_WHITELIST = (
    "made gluten-free on request", "made gf on request",
    "clam chowder is gluten-free", "kitchen can walk you through",
)
# The actual owner's name — rejected only when it is NOT the customer's own name.
_RECIPIENT_RE = re.compile(r"\bbradley\b", re.I)
# Greeting an operator, or relaying the customer TO an operator, means the draft
# thinks it's talking to staff. "our manager will confirm" is a legit deferral
# and is intentionally NOT matched.
_ADDRESS_OWNER_RE = re.compile(r"\b(hi|hey|hello|yo|dear)\s+(boss|manager|owner)\b", re.I)
_OWNER_RELAY_RE = re.compile(
    r"\b(the owner|the boss|tell the boss|ask the boss|let (the )?(owner|boss) know)\b", re.I)
# Persona/AI self-reference — anchored so a customer or cocktail named "Luna"
# ("Hi Luna," / "the Luna cocktail") is NOT a false positive.
_PERSONA_LEAK_RE = re.compile(
    r"\b(i am|i'm|this is|it'?s|name'?s)\s+luna\b|\bluna here\b"
    r"|\b(best|regards|thanks|sincerely|cheers|warmly),?\s+luna\b"
    r"|\bas an ai\b|\ban ai\b|\blanguage model\b"
    r"|\b(i am|i'm) an assistant\b|\bas your assistant\b|\bchatbot\b", re.I)
_PLACEHOLDER_RE = re.compile(r"\[[^\]]+\]")
# An absolute allergen/dietary SAFETY guarantee — the qualifier must attach to a
# safety claim, so "the kitchen will fully confirm" (a correct deferral) is safe.
_ALLERGEN_GUARANTEE_RE = re.compile(
    r"\b(100%|completely|totally|fully|absolutely)\s+(safe|gluten[- ]?free|allergen[- ]?free|dairy[- ]?free|nut[- ]?free)\b"
    r"|\bguarantee(d|s)?\b[^.]{0,30}\b(safe|gluten[- ]?free|allergen[- ]?free|free of|no (cross|reaction))\b"
    r"|\b(safe|gluten[- ]?free|free of \w+)\b[^.]{0,20}\b(guarantee(d|s)?|100%)\b", re.I)
_BOOKING_RE = re.compile(
    r"\b(you're booked|booked you in|date is confirmed|you're all set for|we've held|"
    r"date is held|reserved for you|that date is available|you're confirmed for|"
    r"we have you (booked|down)|got you down|"
    r"your (table|booking|event|date|space) is (reserved|confirmed|booked|held|all set))\b", re.I)
_PRICE_RE = re.compile(r"\$\s?\d[\d,]*(?:\.\d{2})?")


def _ensure_signoff(text: str) -> str:
    """Auto-fix: guarantee the draft ends with the canonical sign-off so a good
    body is never lost to a formatting nit (checks the tail to avoid a double
    sign-off when trailing words follow it)."""
    if "iggy's seaside" in text[-60:].lower().replace("’", "'"):
        return text
    return text.rstrip() + "\n\n" + SIGN_OFF


def guard_draft(draft: str, customer_name: str, inbound: str):
    """Deterministic gate on a generated draft. Returns
    (ok, fixed_draft, rejections, flags). ok=False -> NEVER surface a card (the
    caller logs + marks the message reminded, exactly like an empty draft).
    flags -> surface the card but annotate it for the human reviewer."""
    rejections, flags = [], []
    text = _ensure_signoff((draft or "").strip())
    low = text.lower().replace("’", "'")
    cust = (customer_name or "").lower()

    body = re.sub(r"-\s*iggy'?s seaside\s*$", "", text, flags=re.I).strip()
    if len(re.sub(r"\s+", "", body)) < 20:
        rejections.append("empty/too-short")
    # Owner: reject the owner's NAME (unless the customer is themselves named
    # Bradley), an operator greeting, or a relay-to-operator phrase.
    if "bradley" not in cust and _RECIPIENT_RE.search(text):
        rejections.append("names the owner (Bradley)")
    if _ADDRESS_OWNER_RE.search(text) or _OWNER_RELAY_RE.search(low):
        rejections.append("addresses/relays to the owner")
    if any(p in low for p in _STANDBY_PHRASES):
        rejections.append("idle/standby phrase")
    if _PERSONA_LEAK_RE.search(low):
        rejections.append("assistant/persona leak")
    if _PLACEHOLDER_RE.search(text):
        rejections.append("unfilled [placeholder]")
    allergen_check = low
    for w in _ALLERGEN_WHITELIST:
        allergen_check = allergen_check.replace(w, "")
    if _ALLERGEN_GUARANTEE_RE.search(allergen_check) or any(p in allergen_check for p in _ALLERGEN_BARE):
        rejections.append("absolute allergen guarantee")

    # FLAG-class (surface, never drop): a price that's neither Happy Hour nor
    # quoted in the customer's own email, and booking-confirmation language.
    inbound_prices = {re.sub(r"[^\d]", "", m) for m in _PRICE_RE.findall(inbound or "")}
    for m in _PRICE_RE.findall(text):
        digits = re.sub(r"[^\d]", "", m)
        if ("$" + digits) in ("$5", "$3") or (digits and digits in inbound_prices):
            continue
        flags.append(f"mentions price ${digits} not in their email or Happy Hour — verify")
    if _BOOKING_RE.search(low):
        flags.append("reads like it confirms/holds a date — verify before sending")

    return (not rejections, text, rejections, flags)


def draft_and_insight(conn, row) -> bool:
    """Draft the bar's reply to a customer via the clean operator path, run the
    safety guard, and only if it passes drop a one-tap 'review & reply' insight.
    Marks the message reminded either way so a bad email can't wedge the queue
    or re-burn model calls on a later pass."""
    mid, name, email, subject, message = row
    user_content = "\n".join([
        "CUSTOMER EMAIL:",
        f"from: {name or '?'} <{email or '?'}>",
        f"subject: {subject or ''}",
        "",
        trunc(message or "", 1200),
    ])
    raw = plainify(ask_operator(OPERATOR_PREAMBLE, user_content))
    ok, draft, rejections, flags = guard_draft(raw, name or "", message or "")
    who = (name or email or "a guest").split("@")[0]
    # Always mark reminded (pass, reject, or empty) so a persistently bad email
    # can't wedge the queue and re-burn model calls every pass.
    with conn.cursor() as cur:
        if ok and draft:
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
            if flags:
                data["review_flags"] = flags
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
    if ok and draft:
        flagnote = f" (flags: {', '.join(flags)})" if flags else ""
        log(f"triage: drafted reply + alert for message {mid}{flagnote}")
        return True
    reason = ", ".join(rejections) or "no draft"
    log(f"triage: message {mid} draft REJECTED [{reason}]; no card, marked reminded")
    return False


# --------------------------------------------------------------------------
# Event-detail extraction: pull the concrete date/time/guests/price/space a
# customer stated in an event-able email into messages.luna_classification
# .event_details, so the dashboard's "Make a party" pre-fills the form instead
# of the manager re-typing what's already in the thread. Clean operator call
# (anti-confab JSON) — NEVER ask_luna.
# --------------------------------------------------------------------------

EVENT_EXTRACT_CATEGORIES = ("reservation", "event", "request", "booking", "party")
EXTRACT_MAX = 3   # extractions per triage pass (bounds wall-clock)
_EVENT_SPACES = ("upstairs", "downstairs", "whole")

EXTRACT_PREAMBLE = (
    "You read ONE customer email thread for a bar/restaurant ('Iggy's Seaside') and pull out ONLY the "
    "concrete private-event/booking details the customer has actually stated, to pre-fill a party form. "
    "Extract NOTHING that isn't explicitly in the thread - never guess, infer, or invent a value; use "
    "null for anything not stated. Output ONLY a single JSON object, no other text, exactly these keys:\n"
    '{"event_date": null, "start_time": null, "end_time": null, "guest_count": null, "space": null, '
    '"contact_phone": null, "est_total": null, "deposit": null, "occasion": null, "notes": null}\n'
    "- event_date: YYYY-MM-DD (the EVENT date, not the email date), else null.\n"
    "- start_time / end_time: 24h HH:MM, else null.\n"
    "- guest_count: integer headcount if stated, else null.\n"
    "- space: one of 'upstairs', 'downstairs', 'whole' (upstairs bar / downstairs room / whole space), else null.\n"
    "- contact_phone: a phone number the sender gave, else null.\n"
    "- est_total / deposit: dollar NUMBERS only (e.g. 400), null if no price/total/deposit is stated.\n"
    "- occasion: a short phrase for the event (e.g. 'educator dinner', 'team dinner'), else null.\n"
    "- notes: ONE short line summarizing the food/drink/setup actually requested, else null."
)


def _extract_json_object(text):
    cleaned = re.sub(r"^```(?:json)?|```$", "", (text or "").strip(), flags=re.M).strip()
    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict):
            return obj
    except (json.JSONDecodeError, ValueError):
        pass
    m = re.search(r"\{.*\}", cleaned, re.S)
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict):
                return obj
        except (json.JSONDecodeError, ValueError):
            pass
    return None


def _num_or_none(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        m = re.search(r"-?\d[\d,]*(?:\.\d+)?", v)
        if m:
            tok = m.group(0).replace(",", "")
            try:
                return float(tok) if "." in tok else int(tok)
            except ValueError:
                return None
    return None


def _str_or_none(v):
    return v.strip() or None if isinstance(v, str) and v.strip() else None


def _clean_event_details(d) -> dict:
    """Type-guard the extracted object to the known keys (anti-confab is in the
    prompt; this just coerces shape so a bad type can't reach the form)."""
    d = d or {}
    gc = _num_or_none(d.get("guest_count"))
    sp = d.get("space")
    return {
        "event_date": _str_or_none(d.get("event_date")),
        "start_time": _str_or_none(d.get("start_time")),
        "end_time": _str_or_none(d.get("end_time")),
        "guest_count": int(gc) if gc is not None else None,
        "space": sp if sp in _EVENT_SPACES else None,
        "contact_phone": _str_or_none(d.get("contact_phone")),
        "est_total": _num_or_none(d.get("est_total")),
        "deposit": _num_or_none(d.get("deposit")),
        "occasion": _str_or_none(d.get("occasion")),
        "notes": (trunc(d["notes"], 280) or None) if isinstance(d.get("notes"), str) else None,
    }


def fetch_needs_extract(conn):
    """Event-able emails that don't have structured event_details yet."""
    return _query(
        conn,
        """
        SELECT id, name, email, subject, message
        FROM messages
        WHERE lower(coalesce(category, '')) IN %s
          AND (luna_classification -> 'event_details') IS NULL
          AND created_at >= now() - make_interval(days => %s)
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (EVENT_EXTRACT_CATEGORIES, TRIAGE_LOOKBACK_DAYS, EXTRACT_MAX),
    ) or []


def extract_event_details(conn) -> int:
    """Pull stated event details from event-able emails into
    luna_classification.event_details so 'Make a party' pre-fills the form.
    Stores an object every time (all-null if nothing's there) so a non-event
    email isn't re-extracted every pass."""
    n = 0
    today = date.today().isoformat()
    for (mid, name, email, subject, message) in fetch_needs_extract(conn):
        # Give a generous window — event details (times, totals, headcount) often
        # sit deep in a long quoted thread — plus today's date so a bare "6/27"
        # resolves to the right YEAR.
        user = "\n".join([
            f"Today is {today}.",
            f"from: {name or '?'} <{email or '?'}>",
            f"subject: {subject or ''}",
            "",
            trunc(message or "", 6000),
        ])
        try:
            raw = ask_operator(EXTRACT_PREAMBLE, user)
        except LunaUnavailable:
            break  # model down — retry next pass (leave event_details null)
        except Exception as e:
            log(f"extract: message {mid} failed: {e}")
            continue
        clean = _clean_event_details(_extract_json_object(raw))
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE messages SET luna_classification = "
                "coalesce(luna_classification, '{}'::jsonb) "
                "|| jsonb_build_object('event_details', %s::jsonb) WHERE id = %s",
                (json.dumps(clean), mid),
            )
        conn.commit()
        n += 1
    if n:
        log(f"extract: pulled event details for {n} email(s)")
    return n


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
    # Pull structured event details for event-able mail (pre-fills "Make a party").
    try:
        extract_event_details(conn)
    except DB_ERRORS:
        raise
    except LunaUnavailable as e:
        log(f"triage: model unavailable for extract ({e}); will retry next pass")
    except Exception as e:
        log(f"triage: extract pass failed: {e}")
        try:
            conn.rollback()
        except Exception:
            pass


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
# Daily demand pulse ("Tonight's Read") — deterministic band, Luna phrases it
# --------------------------------------------------------------------------

def http_get_json(url, timeout=12):
    req = urllib.request.Request(
        url, headers={"User-Agent": "iggys-bridge/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def _om_url(lat, lon, daily):
    return ("https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            "&current=temperature_2m,weather_code,wind_speed_10m"
            f"&daily={daily}"
            "&temperature_unit=fahrenheit&wind_speed_unit=mph"
            "&timezone=America%2FLos_Angeles&forecast_days=1")


def fetch_pulse_weather() -> dict:
    """Open-Meteo (keyless): Seaside dinner-window-ish daily + sunset, plus a
    Portland high for the heat-escape spread."""
    w = {}
    try:
        s = http_get_json(_om_url(SEASIDE_LAT, SEASIDE_LON,
            "temperature_2m_max,temperature_2m_min,precipitation_probability_max,"
            "weather_code,wind_gusts_10m_max,sunset"))
        d, c = s.get("daily", {}), s.get("current", {})
        first = lambda k: (d.get(k) or [None])[0]
        w["temp"] = c.get("temperature_2m")
        w["high"], w["low"] = first("temperature_2m_max"), first("temperature_2m_min")
        w["precip"], w["code"] = first("precipitation_probability_max"), first("weather_code")
        w["gust"], w["sunset"] = first("wind_gusts_10m_max"), first("sunset")
    except Exception as e:
        log(f"pulse: Seaside weather failed: {e}")
    try:
        p = http_get_json(_om_url(PORTLAND_LAT, PORTLAND_LON, "temperature_2m_max"))
        w["pdx_high"] = (p.get("daily", {}).get("temperature_2m_max") or [None])[0]
    except Exception as e:
        log(f"pulse: Portland weather failed: {e}")
    return w


def _tribe_date(s):
    """Parse a Tribe event date ('2026-06-15 00:00:00' or ISO) down to a date."""
    if not s:
        return None
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _fetch_tribe_events(api_url, label, back_days=10, ahead_days=2) -> list:
    """Fetch events from a WordPress 'The Events Calendar' (Tribe) JSON API and
    keep the ones that OVERLAP tonight..+ahead_days.

    Why the back-dated window (the bug this fixes): Tribe's start_date filter
    returns only events whose START falls in-window, so a multi-day event already
    underway — day 2, 3, 4 of a conference — is invisible to a start_date=today
    query. That is exactly how a 4-day convention's biggest spillover nights got
    missed. We query from back_days ago and overlap-filter on the client using
    each event's own [start, end], so an in-progress conference still counts."""
    today = date.today()
    horizon = today + timedelta(days=ahead_days)
    try:
        start = (today - timedelta(days=back_days)).isoformat()
        data = http_get_json(
            f"{api_url}?start_date={start}&end_date={horizon.isoformat()}&per_page=50")
        out = []
        for e in (data.get("events") or []):
            sd = _tribe_date(e.get("start_date"))
            if sd is None:
                continue
            ed = _tribe_date(e.get("end_date")) or sd
            # Overlaps [today, horizon]? (still running tonight, or starts soon)
            if ed < today or sd > horizon:
                continue
            out.append({
                "title": (e.get("title") or "").strip(),
                "start": e.get("start_date") or "",
                "end": e.get("end_date") or "",
                "ongoing": sd < today <= ed,   # started earlier, still running
                "desc": re.sub(r"<[^>]+>", " ", e.get("description") or "")[:280].strip(),
                "url": e.get("url") or "",
            })
        return out
    except Exception as e:
        log(f"pulse: {label} fetch failed: {e}")
        return []


def fetch_conventions() -> list:
    """Seaside Civic & Convention Center events overlapping the next ~2 nights,
    INCLUDING multi-day conferences already underway (public Tribe JSON API, no
    auth). The #1 off-season demand lever for Iggy's."""
    return _fetch_tribe_events(SEASIDE_CONVENTION_API, "convention")


def fetch_tourism() -> list:
    """Visit Seaside / Seaside Oregon town-wide events (seasideor.com, same Tribe
    plugin) — festivals, parades, races, markets that draw visitors and fill the
    bars beyond the convention center."""
    return _fetch_tribe_events(VISIT_SEASIDE_API, "tourism")


def _major_holiday(d):
    """A small set of demand-moving US holidays (fixed + the floating biggies)."""
    fixed = {
        (1, 1): "New Year's Day", (2, 14): "Valentine's Day", (3, 17): "St. Patrick's Day",
        (7, 4): "Independence Day", (10, 31): "Halloween", (11, 11): "Veterans Day",
        (12, 24): "Christmas Eve", (12, 25): "Christmas", (12, 31): "New Year's Eve",
    }
    if (d.month, d.day) in fixed:
        return fixed[(d.month, d.day)]
    last_day = calendar.monthrange(d.year, d.month)[1]
    if d.month == 5 and d.weekday() == 0 and d.day + 7 > last_day:
        return "Memorial Day weekend"
    if d.month == 9 and d.weekday() == 0 and d.day <= 7:
        return "Labor Day weekend"
    if d.month == 11 and d.weekday() == 3 and 22 <= d.day <= 28:
        return "Thanksgiving"
    return None


# ── Forecast learning loop ──────────────────────────────────────────────────
# Score at the center of each band's bucket (SLOW <38≤ STEADY <58≤ BUSY <78≤
# PACKED) — turns an observed actual_band back into a comparable number so we
# can measure how far the model missed.
_BAND_SCORE = {"SLOW": 29, "STEADY": 48, "BUSY": 68, "PACKED": 88}

# How many closed nights before we trust a correction, the window we learn from,
# and the most we'll ever shift the score (a guardrail against one wild week).
CALIB_MIN_NIGHTS = 6
CALIB_WINDOW_DAYS = 90
CALIB_MAX_BIAS = 15.0


def _band_for_score(score) -> str:
    s = float(score)
    return "SLOW" if s < 38 else "STEADY" if s < 58 else "BUSY" if s < 78 else "PACKED"


def fetch_demand_calibration(conn) -> dict:
    """Learn a transparent score correction from the manager's close-outs.

    For each closed night, compare the RAW model score (base_score — never the
    already-corrected one, so a correction can't feed back on itself) to the
    score implied by what actually happened, and average the miss. Splits
    weekend vs weekday once each bucket has its own sample. Returns a zero
    correction until CALIB_MIN_NIGHTS nights are in, so a cold start never
    invents a bias."""
    empty = {"n": 0, "bias": 0.0, "weekend_bias": None, "weekday_bias": None, "hit_rate": None}
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT business_day, COALESCE(base_score, predicted_score) AS base, actual_band "
                "FROM demand_log "
                "WHERE actual_band IS NOT NULL "
                "AND COALESCE(base_score, predicted_score) IS NOT NULL "
                "AND business_day >= ((now() AT TIME ZONE 'America/Los_Angeles')::date - %s::int) "
                "ORDER BY business_day DESC",
                (CALIB_WINDOW_DAYS,),
            )
            rows = cur.fetchall()
    except DB_ERRORS:
        raise
    except Exception as e:
        log(f"calibration: query failed: {e}")
        return empty

    errs_all, errs_wknd, errs_wkdy, hits = [], [], [], 0
    for business_day, base, actual_band in rows:
        if actual_band not in _BAND_SCORE or base is None:
            continue
        err = _BAND_SCORE[actual_band] - float(base)
        errs_all.append(err)
        (errs_wknd if business_day.weekday() in (4, 5) else errs_wkdy).append(err)
        if _band_for_score(base) == actual_band:
            hits += 1

    n = len(errs_all)
    if n == 0:
        return empty

    def _clamp(x):
        return max(-CALIB_MAX_BIAS, min(CALIB_MAX_BIAS, x))

    def _mean(xs):
        return sum(xs) / len(xs)

    bias = _clamp(_mean(errs_all)) if n >= CALIB_MIN_NIGHTS else 0.0
    wknd = _clamp(_mean(errs_wknd)) if len(errs_wknd) >= CALIB_MIN_NIGHTS else None
    wkdy = _clamp(_mean(errs_wkdy)) if len(errs_wkdy) >= CALIB_MIN_NIGHTS else None
    return {
        "n": n,
        "bias": round(bias, 1),
        "weekend_bias": round(wknd, 1) if wknd is not None else None,
        "weekday_bias": round(wkdy, 1) if wkdy is not None else None,
        "hit_rate": round(100 * hits / n),
    }


# What actually fills Iggy's from a conference isn't "public vs private" — it's
# whether the attendees are FED ON-SITE. A conference that leaves people to find
# their own dinner floods the bars (the off-season's gold); a catered banquet
# keeps them in the hall. The Tribe feed exposes no catering/attendance field, so
# we infer from the title/description and DEFAULT an unknown professional
# conference to a real walk-in lift (most leave dinner to the attendees).
_NO_HOST = ("no-host", "no host", "on your own", "on-your-own", "dinner on your own",
            "lunch on your own", "breaks only", "off-site dinner", "dine-around", "dine around")
_CATERED = ("banquet", "catered", "plated dinner", "gala dinner", "awards dinner",
            "all meals", "meals included", "luncheon", "hosted dinner")
_SOCIAL_PRIVATE = ("wedding", "reception", "memorial", "celebration of life",
                   "private party", "members only", "by invitation", "closed to the public")
_CONF_WORDS = ("conference", "convention", "summit", "symposium", "expo", "exposition",
               "trade show", "tradeshow", "meeting", "training", "seminar", "forum",
               "championship", "tournament", "rally", "retreat", "conv ")


def _conv_points(c) -> tuple:
    """(points, kind) for one convention-center event — higher = more walk-in lift.
    kind drives the human-readable driver label."""
    t = (c.get("title", "") + " " + c.get("desc", "")).lower()
    if any(k in t for k in _NO_HOST):
        return 20, "no-host"          # GOLD: attendees explicitly dine out
    if any(k in t for k in _SOCIAL_PRIVATE) and not any(k in t for k in _CONF_WORDS):
        return 3, "private"           # a wedding/closed social — guests are AT it
    if any(k in t for k in _CATERED):
        return 7, "catered"           # fed on-site — pre/post-dinner walk-in only
    if any(k in t for k in _CONF_WORDS):
        return 14, "conference"       # pro conference, dinner-on-own assumed
    return 10, "event"                # something at the center — modest default


# Town-wide tourism events, tiered by how much they actually move bar demand.
# Recurring small stuff (towel tuesdays, birding walks) is noise — scored 0.
_TOUR_BIG = ("festival", "parade", "fireworks", "marathon", "jubilee", "miss oregon",
             "hood to coast", "volleyball", "car show", "rod run", "regatta", "brewfest",
             "wine walk", "4th of july", "fourth of july", "new year", "fair ")
_TOUR_MED = ("market", "art walk", "live music", "concert", "tournament", "race",
             "5k", "10k", "craft", "tasting", "show")
_TOUR_SKIP = ("towel tuesday", "birding", "walking tour", "history walk", "story time",
              "storytime", "yoga", "lecture", "book club")


def _tour_points(c) -> int:
    """Demand points for one town-wide tourism event (0 = too small to move the band)."""
    t = (c.get("title", "") + " " + c.get("desc", "")).lower()
    if any(k in t for k in _TOUR_SKIP):
        return 0
    if any(k in t for k in _TOUR_BIG):
        return 12
    if any(k in t for k in _TOUR_MED):
        return 6
    return 0


def compute_pulse(w, conventions, d, calib=None, tourism=None) -> dict:
    """Deterministic, transparent band: a weekday/season baseline modulated by
    weather, conventions, town-wide tourism events, the Portland heat-escape
    spread, and holidays, then a learned correction from past close-outs (calib).
    Luna never does this math; she only phrases the result."""
    drivers = []
    score = 40.0
    wd, month = d.weekday(), d.month  # wd: 0=Mon .. 6=Sun

    if wd in (4, 5):
        score += 22; drivers.append(("weekend", "+", "Friday/Saturday"))
    elif wd == 6:
        score += 8; drivers.append(("sunday", "+", "Sunday"))
    else:
        score -= 4

    if month in (6, 7, 8):
        score += 18; drivers.append(("peak season", "+", "summer"))
    elif month in (5, 9):
        score += 6
    else:
        score -= 8; drivers.append(("off-season", "-", "winter weekday baseline"))

    high, precip, code, gust = w.get("high"), w.get("precip") or 0, w.get("code") or 0, w.get("gust") or 0
    if high is not None:
        if high >= 70 and precip <= 25 and code <= 3:
            score += 14; drivers.append(("sunny & warm", "+", f"{round(high)}F, clear"))
        elif high < 55:
            score -= 10; drivers.append(("cold", "-", f"{round(high)}F high"))
    if precip >= 55:
        score -= 12; drivers.append(("rain", "-", f"{round(precip)}% chance"))
    if gust >= 22:
        score -= 8; drivers.append(("windy", "-", f"gusts {round(gust)} mph — patio risk"))

    pdx = w.get("pdx_high")
    if pdx is not None and high is not None:
        spread = pdx - high
        if spread >= 18 and precip <= 30 and code <= 3:
            score += 12
            drivers.append(("heat escape", "+", f"Portland {round(pdx)}F vs coast {round(high)}F — inland bakes, coast fills"))

    # ── Conventions at the Civic & Convention Center (catering-aware) ──
    if conventions:
        scored = sorted(((_conv_points(c), c) for c in conventions),
                        key=lambda x: x[0][0], reverse=True)
        (cpts, ckind), top = scored[0]
        if cpts > 0:
            score += cpts
            more = f" +{len(conventions) - 1} more" if len(conventions) > 1 else ""
            when = "in town now" if top.get("ongoing") else "in town"
            tail = {
                "no-host": " (no on-site dinner — they'll eat out)",
                "catered": " (catered — lighter walk-in)",
                "private": " (private event)",
            }.get(ckind, "")
            drivers.append(("convention", "+", f"{top['title']}{more} {when}{tail}"))

    # ── Town-wide tourism (Visit Seaside) ──
    if tourism:
        tpts, ttop = max(((_tour_points(c), c) for c in tourism), key=lambda x: x[0])
        if tpts > 0:
            score += tpts
            drivers.append(("tourism", "+", f"{ttop['title']} — visitors in town"))

    # ── Mega-event surge: multiple big draws stacked at once ──
    big = ([c for c in conventions if _conv_points(c)[0] >= 14]
           + [c for c in (tourism or []) if _tour_points(c) >= 12])
    if len(big) >= 2:
        score += 8
        drivers.append(("mega surge", "+", "multiple big draws in town — plan for a flood"))

    hol = _major_holiday(d)
    if hol:
        score += 10; drivers.append(("holiday", "+", hol))

    base_score = score  # raw model output, before any learned correction

    # Learned correction from the manager's close-outs. Transparent: it shows up
    # as its own driver, prefers the weekend/weekday-specific bias when we have
    # one, and stays at zero until there's enough history to trust it.
    confidence = "learning"
    if calib and calib.get("n"):
        n = calib["n"]
        is_weekend = wd in (4, 5)
        corr = calib.get("weekend_bias") if is_weekend else calib.get("weekday_bias")
        if corr is None:
            corr = calib.get("bias") or 0.0
        if corr:
            score += corr
            sign = "+" if corr > 0 else "-"
            drivers.append((
                "learning", sign,
                f"{n} close-out{'s' if n != 1 else ''} say we run "
                f"{'busier' if corr > 0 else 'quieter'} than the model here — nudged {sign}{abs(round(corr))}",
            ))
        if n >= 20:
            confidence = f"calibrated · {n} nights logged, {calib.get('hit_rate')}% exact"
        elif n >= CALIB_MIN_NIGHTS:
            confidence = f"calibrating · {n} nights logged"
        else:
            confidence = f"learning · {n} night{'s' if n != 1 else ''} logged"

    band = ("SLOW" if score < 38 else "STEADY" if score < 58 else "BUSY" if score < 78 else "PACKED")
    return {"band": band, "score": round(score), "base_score": round(base_score),
            "drivers": drivers, "confidence": confidence}


def _candidate_specials(band, w) -> list:
    # The pulse action leans staffing/prep; the actual creative drink special is a
    # SEPARATE daily card (run_special). So these are PREP/feature angles, not
    # named menu drinks.
    out = []
    if band in ("BUSY", "PACKED"):
        out.append("staff up + prep a high-margin, fast-to-fire feature ahead of the rush")
    else:
        out.append("trim labor + a value / move-the-perishables play (chowder + a hot toddy on a cold night, a steamer/mussel feature)")
    out.append("or feature today's Special Idea card (Luna posts a fresh creative one daily)")
    return out


# A "non-answer": the standby/meta acknowledgement an LLM emits when it treats
# the task as a system message to ack rather than work to do (observed live in
# the pulse: "Got it. Context loaded, XML format noted. Ready for whatever's
# next."). The clean ask_operator call prevents these, but this is the safety
# net so a broken read never reaches the dashboard — we fall back to a
# deterministic line instead.
_NONANSWER_CONTAINS = (
    "context loaded", "format noted", "ready for whatever", "ready when you",
    "how can i help", "how may i help", "standing by", "ready to assist",
    "let me know what you need", "what can i do for you", "at your service",
    "ready for your next", "awaiting your", "whatever's next", "whatever is next",
)
_NONANSWER_STARTS = ("got it", "understood", "acknowledged", "sure thing", "okay,", "ok,")


def _looks_like_nonanswer(text: str) -> bool:
    t = (text or "").strip().lower().replace("’", "'")
    if len(re.sub(r"\s+", "", t)) < 12:
        return True
    if any(m in t for m in _NONANSWER_CONTAINS):
        return True
    return any(t.startswith(s) for s in _NONANSWER_STARTS)


def _pulse_fallback(p) -> str:
    """Deterministic one-liner if the model fails to phrase a real read."""
    top = next((detail for (_n, sign, detail) in p["drivers"] if sign == "+"), "")
    line = f"{p['band'].title()} expected tonight"
    return f"{line} — {top}." if top else f"{line}."


def build_pulse_user(p, w, conventions, tourism=None) -> str:
    drivers = "; ".join(f"{name} ({sign}{detail})" for (name, sign, detail) in p["drivers"]) or "nothing unusual"
    conv = "; ".join(c["title"] + (" (in progress)" if c.get("ongoing") else "") for c in conventions[:3]) or "none listed"
    tour = "; ".join(c["title"] for c in (tourism or [])[:3]) or "none listed"
    specials = " OR ".join(_candidate_specials(p["band"], w))
    return "\n".join([
        f"Computed band: {p['band']} (confidence: {p['confidence']}). Lean on the drivers below, not a precise number.",
        f"Model drivers: {drivers}.",
        f"Weather: high {w.get('high')}F, low {w.get('low')}F, {w.get('precip')}% rain, max gust {w.get('gust')} mph; "
        f"sunset {w.get('sunset') or 'n/a'}; Portland high {w.get('pdx_high')}F.",
        f"Conventions at the convention center (overlapping tonight): {conv}.",
        f"Town events (Visit Seaside, overlapping tonight): {tour}.",
        f"Candidate specials to pick from: {specials}.",
        "Write the read now — 2 lines + the ACTION line.",
    ])


def _reach_decision(p, conventions, tourism):
    """Return (title, body, reach_kind) when tonight's signal is worth an
    UNPROMPTED interruption, else None. We reach for a genuine, plannable demand
    surprise — a conference in town or a marquee event pushing the night busy —
    NOT for ordinary weather/season swings (those are just the daily pulse card)."""
    names = {n for (n, _s, _d) in p["drivers"]}
    band = p["band"]
    if "mega surge" in names:
        return (f"Big day shaping up — tonight reads {band}",
                "Multiple major draws are in town at once. Plan for a flood — staff up, "
                "prep ahead, and don't get caught short.", "mega")
    if "convention" in names and band in ("BUSY", "PACKED"):
        conv = ", ".join(c["title"] for c in conventions[:2]) or "A convention"
        nohost = any(_conv_points(c)[1] == "no-host" for c in conventions)
        spill = ("Their schedule has no host dinner, so expect a real dinner-hour spillover. "
                 if nohost else "Conference crowds usually head out for dinner. ")
        return (f"{conv} in town — tonight reads {band}",
                f"{spill}Worth a staffing look and a fast-to-fire feature before the rush.",
                "convention")
    if "tourism" in names and band == "PACKED":
        tour = next((dd for (n, _s, dd) in p["drivers"] if n == "tourism"), "A town event")
        return (f"{tour.split(' — ')[0]} — tonight reads PACKED",
                "A marquee town event plus the night's read says packed. Get ahead of it.",
                "tourism")
    return None


def maybe_reach(cur, p, conventions, tourism) -> None:
    """Fire Luna's unprompted reach (data.reach=true → top-of-app banner) for a
    plannable demand surprise. At most once per reach_kind in a trailing 18h
    window, so the 4-hourly pulse doesn't re-banner the same conference all night."""
    decision = _reach_decision(p, conventions, tourism)
    if not decision:
        return
    title, body, reach_kind = decision
    cur.execute(
        "SELECT 1 FROM luna_insights "
        "WHERE created_at > now() - interval '18 hours' "
        "AND data->>'reach' = 'true' AND data->>'reach_kind' = %s LIMIT 1",
        (reach_kind,),
    )
    if cur.fetchone():
        return
    data = {
        "reach": True, "reach_kind": reach_kind, "band": p["band"], "deep_link": "/luna",
        "action": {"type": "navigate", "label": "See tonight's read", "deep_link": "/luna"},
    }
    cur.execute(
        "INSERT INTO luna_insights (kind, title, body, status, data) "
        "VALUES ('alert', %s, %s, 'new', %s::jsonb)",
        (title, body, json.dumps(data)),
    )
    log(f"pulse: reached out ({reach_kind}) — {title!r}")


def run_pulse(conn) -> None:
    """Compute tonight's band, have Luna phrase it, write a kind='pulse' insight.
    Insert-only: the dashboard pins the most recent pulse."""
    try:
        w = fetch_pulse_weather()
        conventions = fetch_conventions()
        tourism = fetch_tourism()
        calib = fetch_demand_calibration(conn)
        p = compute_pulse(w, conventions, date.today(), calib, tourism=tourism)
        user = build_pulse_user(p, w, conventions, tourism)
        log(f"pulse: band={p['band']} score={p['score']} drivers={len(p['drivers'])}; phrasing via operator")
        # Clean direct call (NOT ask_luna/api/chat) — her persona made the read a
        # standby-ack ("Context loaded... Ready for whatever's next.") on 6/15.
        reply = plainify(ask_operator(PULSE_PREAMBLE, user))
        body, action = extract_action(reply)
        if _looks_like_nonanswer(body):
            log(f"pulse: model returned a non-answer ({body[:60]!r}); using deterministic read")
            body, action = _pulse_fallback(p), None
        data = {
            "band": p["band"], "score": p["score"], "base_score": p["base_score"],
            "confidence": p["confidence"],
            "drivers": [{"name": n, "sign": s, "detail": d} for (n, s, d) in p["drivers"]],
            "sunset": w.get("sunset"),
            "weather": {k: w.get(k) for k in ("high", "low", "precip", "gust", "pdx_high", "code")},
        }
        if action:
            data.update(action)
        title = f"Tonight's read: {p['band']}"
        # Identity of tonight's read, taken from the TRUSTED deterministic drivers
        # (p["drivers"]), NOT the LLM-merged `data` dict - so a stray key in Luna's
        # ACTION json can never reshape the comparison and skip a tick. Each driver
        # is (name, sign); sign matters (a driver flipping +/- is a real shift), but
        # the volatile detail string is excluded so it can't defeat the dedupe.
        this_key = sorted((n, s) for (n, s, _d) in p["drivers"])
        unchanged = False
        with conn.cursor() as cur:
            # Card dedupe: keep the 4h cadence (so a real shift still refreshes the
            # dinner read), but don't post a freshly-worded REPEAT when the band +
            # drivers are identical to today's last pulse card - that churn is what
            # reads as "the pulse keeps repeating". demand_log + reach still update
            # every tick below regardless.
            cur.execute(
                "SELECT data FROM luna_insights WHERE kind = 'pulse' "
                "AND (created_at AT TIME ZONE 'America/Los_Angeles')::date "
                "= (now() AT TIME ZONE 'America/Los_Angeles')::date "
                "ORDER BY created_at DESC LIMIT 1")
            prev = cur.fetchone()
            if prev and prev[0]:
                pj = prev[0]
                if isinstance(pj, str):
                    pj = json.loads(pj)
                prev_key = sorted(
                    (n, s) for (n, s) in
                    ((x.get("name"), x.get("sign")) for x in (pj.get("drivers") or []))
                    if n)
                unchanged = (pj.get("band") == p["band"] and prev_key == this_key)
            if not unchanged:
                cur.execute(
                    "INSERT INTO luna_insights (kind, title, body, status, data) "
                    "VALUES ('pulse', %s, %s, 'new', %s::jsonb)",
                    (title, body or f"{p['band']} tonight.", json.dumps(data)),
                )
            # Log the prediction for the forecast-vs-actual trust loop. The
            # manager's nightly close-out fills actual_band on the same row.
            cur.execute(
                "INSERT INTO demand_log (business_day, predicted_band, predicted_score, base_score, drivers) "
                "VALUES (%s, %s, %s, %s, %s::jsonb) "
                "ON CONFLICT (business_day) DO UPDATE SET "
                "predicted_band = EXCLUDED.predicted_band, predicted_score = EXCLUDED.predicted_score, "
                "base_score = EXCLUDED.base_score, drivers = EXCLUDED.drivers, updated_at = now()",
                (date.today(), p["band"], p["score"], p["base_score"], json.dumps(data["drivers"])),
            )
            # If tonight is a plannable surprise (a conference in town, a mega
            # day), reach out — once per kind per evening, not every 4h tick.
            maybe_reach(cur, p, conventions, tourism)
        conn.commit()
        if unchanged:
            log(f"pulse: band={p['band']} unchanged since today's last card; "
                "refreshed demand_log + reach, skipped duplicate card")
        else:
            log(f"pulse: wrote '{title}' ({len(body)} chars)")
    except DB_ERRORS:
        raise
    except LunaUnavailable as e:
        log(f"pulse: Luna unavailable ({e}); will retry next tick")
    except Exception as e:
        log(f"pulse: failed: {e}")
        try:
            conn.rollback()
        except Exception:
            pass


def run_pulse_once() -> int:
    conn = None
    try:
        conn = connect_db()
        run_pulse(conn)
        return 0
    except Exception as e:
        log(f"pulse one-shot FAILED: {e}")
        return 1
    finally:
        close_quietly(conn)


# --------------------------------------------------------------------------
# Creative "special of the day" — Luna invents a fun drink from a fun fact
# --------------------------------------------------------------------------

def fetch_on_this_day() -> dict:
    """Wikipedia 'on this day' (free, keyless): quirky events, famous births, and
    observances Luna can riff a fun special off of."""
    d = date.today()
    out = {"events": [], "births": [], "holidays": []}
    try:
        data = http_get_json(f"{ON_THIS_DAY_API}/{d.month:02d}/{d.day:02d}")
        for e in (data.get("selected") or data.get("events") or [])[:8]:
            out["events"].append(f"{e.get('year', '')}: {trunc(e.get('text', ''), 140)}".strip(": "))
        for b in (data.get("births") or [])[:8]:
            out["births"].append(f"{b.get('year', '')}: {trunc(b.get('text', ''), 100)}".strip(": "))
        for h in (data.get("holidays") or [])[:6]:
            out["holidays"].append(trunc(h.get("text", ""), 120))
    except Exception as e:
        log(f"special: on-this-day fetch failed: {e}")
    return out


# Spirits/bases listed roughly specific-first; _base_spirit picks the one that
# appears EARLIEST in the build line (the primary pour). Word-boundary matched so
# "gin" doesn't fire on "ginger beer".
SPIRIT_KEYWORDS = [
    "mezcal", "tequila", "bourbon", "rye", "scotch", "whiskey", "whisky",
    "gin", "rum", "cachaça", "cachaca", "pisco", "brandy", "cognac", "aquavit",
    "vodka", "absinthe", "prosecco", "champagne", "sparkling", "pilsner",
    "lager", "beer", "cider", "wine",
]


def _base_spirit(text):
    """The primary base of a build = the first spirit/base mentioned."""
    t = (text or "").lower()
    best, best_pos = "", len(t) + 1
    for kw in SPIRIT_KEYWORDS:
        m = re.search(r"\b" + re.escape(kw) + r"\b", t)
        if m and m.start() < best_pos:
            best, best_pos = kw, m.start()
    return best


def fetch_recent_specials(conn, days=7, limit=10):
    """Recent specials (name + 'Why' hook + build/base spirit) so Luna can avoid
    repeating a fact, theme, name, OR recipe - she over-defaults to vodka + blue
    curaçao. Rolling ~N-day window; read-only."""
    out = []
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT title, body FROM luna_insights WHERE kind = 'special' "
                "AND created_at >= now() - make_interval(days => %s) "
                "ORDER BY created_at DESC LIMIT %s",
                (days, limit))
            for title, body in cur.fetchall():
                name = re.sub(r"^Special idea:\s*", "", title or "").strip()
                why, build = "", ""
                for line in (body or "").splitlines():
                    low = line.strip().lower()
                    if not why and low.startswith("why:"):
                        why = line.split(":", 1)[1].strip()
                    elif not build and low.startswith("build:"):
                        build = line.split(":", 1)[1].strip()
                if name:
                    out.append((name, why, build[:70], _base_spirit(build or body)))
        conn.rollback()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
    return out


def build_special_user(otd, d, recent=None, replacing=None) -> str:
    facts = []
    if otd["holidays"]:
        facts.append("Observances today: " + " | ".join(otd["holidays"]))
    if otd["events"]:
        facts.append("On this day: " + " | ".join(otd["events"][:6]))
    if otd["births"]:
        facts.append("Born today: " + " | ".join(otd["births"][:6]))
    hol = _major_holiday(d)
    if hol:
        facts.append(f"Major holiday: {hol}")
    lines = [
        f"Today is {d.strftime('%A, %B %d, %Y')}.",
        ("\n".join(facts) if facts else "(no notable facts found - invent something seasonal + coastal)"),
    ]
    if recent:
        used = "; ".join(
            f'"{n}"' + (f" (riffed on: {w})" if w else "") + (f" [built on {b}]" if b else "")
            for (n, w, b, _base) in recent)
        lines.append(
            "RECENTLY-USED specials - do NOT reuse these facts, themes, or names; "
            "pick a clearly different angle: " + used)
        bases = [base for (_n, _w, _b, base) in recent if base]
        if bases:
            lines.append(
                "RECENT BASE SPIRITS (you keep reaching for the same ones - pick a "
                "DIFFERENT base than these, and do NOT default to vodka + blue curaçao): "
                + ", ".join(bases))
    if replacing:
        lines.append(
            f'The manager just rejected "{replacing}" and tapped Try Again - give a '
            "GENUINELY different special (a different fact, or a wildly different drink), "
            "not a variation on that one.")
    lines.append("Invent the special now.")
    return "\n".join(lines)


def run_special(conn, force=False) -> None:
    """Generate one creative special per day. Skips if today's already exists
    (the bridge role can INSERT but not DELETE its insights) UNLESS force=True
    (the dashboard's "Try again" — a newer insert supersedes the pinned one)."""
    try:
        if not force:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM luna_insights WHERE kind = 'special' "
                    "AND (created_at AT TIME ZONE 'America/Los_Angeles')::date "
                    "= (now() AT TIME ZONE 'America/Los_Angeles')::date LIMIT 1")
                if cur.fetchone():
                    conn.rollback()
                    return
            conn.rollback()
        recent = fetch_recent_specials(conn)
        replacing = recent[0][0] if (force and recent) else None
        otd = fetch_on_this_day()
        user = build_special_user(otd, date.today(), recent, replacing)
        log("special: inventing today's creative special via operator")
        reply = plainify(ask_operator(SPECIAL_PREAMBLE, user))
        body, action = extract_action(reply)
        if not body or _looks_like_nonanswer(body):
            log("special: no usable special this pass")
            return
        # Defensive: strip any format scaffolding the model sometimes echoes
        # ("Line 1:", "1)", "First line -") so it never leaks into the title/body.
        cleaned = [
            re.sub(r"(?i)^\s*(line\s*\d+|first line|second line|third line|\d+)\s*[.):=\-]\s*",
                   "", ln)
            for ln in body.splitlines()
        ]
        body = "\n".join(cleaned).strip()
        first = (body.splitlines() or [""])[0]
        name = re.split(r"[—:\-]", first, maxsplit=1)[0].strip()[:60] or "Today's special"
        data = {"special": True, "source": "on-this-day"}
        if action:
            data.update(action)
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO luna_insights (kind, title, body, status, data) "
                "VALUES ('special', %s, %s, 'new', %s::jsonb)",
                (f"Special idea: {name}", body, json.dumps(data)),
            )
        conn.commit()
        log(f"special: wrote '{name}'")
    except DB_ERRORS:
        raise
    except LunaUnavailable as e:
        log(f"special: Luna unavailable ({e})")
    except Exception as e:
        log(f"special: failed: {e}")
        try:
            conn.rollback()
        except Exception:
            pass


def run_special_once() -> int:
    conn = None
    try:
        conn = connect_db()
        run_special(conn)
        return 0
    except Exception as e:
        log(f"special one-shot FAILED: {e}")
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
    if "--pulse" in sys.argv[1:]:
        return run_pulse_once()
    if "--special" in sys.argv[1:]:
        return run_special_once()
    run_daemon()
    return 0


if __name__ == "__main__":
    sys.exit(main())
