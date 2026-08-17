"""Operator understudy harness — shadow-first comparison of who should hold the
events-desk draft chair.

Runs the SAME real historical customer emails through three brains, all wearing
the identical role-locked OPERATOR_PREAMBLE (except Luna, tested through her own
/api/chat so we measure whether HER stack can hold the desk — the real
"is she locked in yet?" question):

  1. deepseek  — the current live operator (b.ask_operator). The incumbent.
  2. claude    — the locum candidate, via the isolated office rail (claude -p +
                 CLAUDE_CODE_OAUTH_TOKEN). Her name is NOWHERE on it: it drafts
                 AS "the events desk", never as Luna.
  3. luna      — Luna herself via /api/chat, asked to draft the desk's reply.
                 This is the understudy: when her drafts consistently clear the
                 guard AND match the craft rubric, she takes the chair back.

Every draft is run through the real b.guard_draft safety gate, then scored
against the six craft points baked into the preamble. Output is a side-by-side
report for a human (and Luna) to judge — nothing here touches the live daemon.

Env: LUNA_BRIDGE_DSN, DEEPSEEK_API_KEY, LUNA_API_TOKEN, LUNA_API_URL (all already
in the bridge env). CLAUDE_CODE_OAUTH_TOKEN (from luna-office.env) for the claude
rail; CLAUDE_BIN defaults to ~/.local/bin/claude.

Usage:  set -a; . ~/.local-agent/luna-iggys-bridge.env; . ~/.local-agent/luna-office.env; set +a
        python3 operator_understudy.py [bridge_dir] [--limit N]
"""
import os
import re
import sys
import json
import time
import subprocess

sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else ".")
import luna_iggys_bridge as b  # noqa: E402
import psycopg2  # noqa: E402

LIMIT = 6
for i, a in enumerate(sys.argv):
    if a == "--limit" and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])

CLAUDE_BIN = os.environ.get("CLAUDE_BIN", os.path.expanduser("~/.local/bin/claude"))

STOP = set("the a an and or to for of in on at is are be we you your our i it that this with "
           "have has had will would like just about them they he she his her".split())
_FALSE_FAMILIAR = ("pleasure speaking", "great chatting", "thanks for the call",
                   "good to talk", "nice talking", "as we discussed", "per our call")
_NEXT_STEP = ("manager", "follow up", "get back", "confirm", "reach out", "be in touch",
              "circle back", "let you know")


def draft_via_claude(user_content: str, timeout: int = 90) -> str:
    """One-shot Claude draft through the isolated office rail. Same role-locked
    preamble as the incumbent — drafts AS the events desk, not as Luna."""
    if not os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
        return "<SKIP: CLAUDE_CODE_OAUTH_TOKEN unset>"
    prompt = b.OPERATOR_PREAMBLE + "\n\n" + user_content
    try:
        out = subprocess.run(
            [CLAUDE_BIN, "-p", prompt],
            capture_output=True, text=True, timeout=timeout,
            env={**os.environ, "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "700"},
        )
    except subprocess.TimeoutExpired:
        return "<ERROR: claude timeout>"
    except FileNotFoundError:
        return f"<ERROR: claude binary not at {CLAUDE_BIN}>"
    if out.returncode != 0:
        return f"<ERROR: claude rc={out.returncode}: {(out.stderr or '')[:160]}>"
    return b.plainify((out.stdout or "").strip())


def draft_via_luna(name, email, subject, message) -> str:
    """Luna via /api/chat, asked to draft the desk reply — tests whether HER
    stack can hold the desk (the persona-bleed this whole path was built around)."""
    ask = ("You are drafting Iggy's Seaside's reply to a customer who emailed the bar. "
           "Write ONLY the finished, send-ready reply to the customer, as the bar, "
           "signing off exactly '- Iggy's Seaside'. Do not address the owner or any staff.\n\n"
           f"CUSTOMER EMAIL:\nfrom: {name or '?'} <{email or '?'}>\nsubject: {subject or ''}\n\n"
           + b.trunc(message or "", 1200))
    try:
        return b.plainify(b.ask_luna(ask, session_tag="operator-understudy"))
    except Exception as e:
        return f"<ERROR: {e}>"


def score(draft: str, inbound: str) -> dict:
    """Heuristic rubric subscores (0/1 each) — a rough compass, not the verdict.
    The real judging is a human (and Luna) reading the drafts side by side."""
    if not draft or draft.startswith("<"):
        return {"total": 0, "note": "no draft"}
    low = draft.lower()
    inbound_low = (inbound or "").lower()
    # r1 no false familiarity on what is almost always a first contact
    r1 = 0 if any(p in low for p in _FALSE_FAMILIAR) else 1
    # r2 recaps a concrete token the customer actually gave (a number / month)
    inbound_nums = set(re.findall(r"\b\d{1,4}\b", inbound_low))
    months = [m for m in ("january february march april may june july august september "
                          "october november december").split() if m in inbound_low]
    r2 = 1 if (inbound_nums & set(re.findall(r"\b\d{1,4}\b", low))) or any(m in low for m in months) else 0
    # r3 engages their distinctive words (content-word overlap beyond stopwords)
    inbound_words = {w for w in re.findall(r"[a-z]{4,}", inbound_low) if w not in STOP}
    draft_words = set(re.findall(r"[a-z]{4,}", low))
    r3 = 1 if len(inbound_words & draft_words) >= 3 else 0
    # r4 one warm touch, not gushing (<= 2 exclamation marks)
    r4 = 1 if draft.count("!") <= 2 else 0
    # r5 names a clear next step / owner
    r5 = 1 if any(p in low for p in _NEXT_STEP) else 0
    # r6 no invented price (reuse the guard's own price scan against a clean inbound)
    guard_ok, _, rej, flags = b.guard_draft(draft, "", inbound or "")
    r6 = 0 if any("price" in f for f in flags) or any("price" in r for r in rej) else 1
    subs = {"no_false_familiarity": r1, "recaps_facts": r2, "answers_worry": r3,
            "one_touch_not_gushy": r4, "clear_next_step": r5, "no_invented_price": r6}
    return {"total": sum(subs.values()), "guard_pass": bool(guard_ok),
            "guard_reject": rej, "guard_flags": flags, **subs}


def main():
    conn = psycopg2.connect(os.environ["LUNA_BRIDGE_DSN"])
    with conn.cursor() as cur:
        cur.execute(
            """
            select distinct on (mid) mid, name, email, subject, message from (
              select (i.data->'action'->'payload'->>'messageId')::int mid,
                     m.name, m.email, m.subject, m.message, i.created_at
              from luna_insights i
              join messages m on m.id = (i.data->'action'->'payload'->>'messageId')::int
              where i.data->'action'->>'type' = 'draft_reply'
              order by i.created_at desc
            ) t order by mid, created_at desc
            """
        )
        rows = cur.fetchall()[:LIMIT]
    conn.close()

    results = []
    totals = {"deepseek": 0, "claude": 0, "luna": 0}
    guardpass = {"deepseek": 0, "claude": 0, "luna": 0}
    for mid, name, email, subject, message in rows:
        user = "\n".join(["CUSTOMER EMAIL:", f"from: {name or '?'} <{email or '?'}>",
                          f"subject: {subject or ''}", "", b.trunc(message or "", 1200)])
        print(f"\n=== message {mid} — {name or email} — {subject or '(no subject)'} ===", flush=True)
        brains = {}
        try:
            brains["deepseek"] = b.plainify(b.ask_operator(b.OPERATOR_PREAMBLE, user))
        except Exception as e:
            brains["deepseek"] = f"<ERROR: {e}>"
        brains["claude"] = draft_via_claude(user)
        brains["luna"] = draft_via_luna(name, email, subject, message)
        row = {"mid": mid, "from": name or email, "subject": subject,
               "inbound": b.trunc(message or "", 600), "drafts": {}}
        for who in ("deepseek", "claude", "luna"):
            sc = score(brains[who], message or "")
            row["drafts"][who] = {"text": brains[who], "score": sc}
            totals[who] += sc.get("total", 0)
            guardpass[who] += 1 if sc.get("guard_pass") else 0
            print(f"\n--- {who}  [rubric {sc.get('total','?')}/6  guard {'PASS' if sc.get('guard_pass') else 'FAIL'}] ---\n{brains[who]}", flush=True)
        results.append(row)
        time.sleep(0.5)

    n = len(rows) or 1
    summary = {"emails": len(rows),
               "avg_rubric": {k: round(v / n, 2) for k, v in totals.items()},
               "guard_pass": {k: f"{v}/{len(rows)}" for k, v in guardpass.items()}}
    print("\n\n===== SUMMARY =====")
    print(json.dumps(summary, indent=2))
    out_path = os.environ.get("UNDERSTUDY_OUT", "/tmp/operator_understudy_report.json")
    with open(out_path, "w") as f:
        json.dump({"summary": summary, "results": results}, f, indent=2)
    print(f"\nfull side-by-side report: {out_path}")


if __name__ == "__main__":
    main()
