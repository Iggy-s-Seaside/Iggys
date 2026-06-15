"""Regression harness: re-run the 10 real historical customer emails through the
NEW clean operator draft path + guard, and dump old-vs-new for judging.
Needs LUNA_BRIDGE_DSN (DB) + DEEPSEEK_API_KEY (model) in env."""
import os
import sys
import json
import psycopg2

sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
import luna_iggys_bridge as b  # noqa: E402

conn = psycopg2.connect(os.environ["LUNA_BRIDGE_DSN"])
with conn.cursor() as cur:
    cur.execute(
        """
        select (i.data->'action'->'payload'->>'messageId')::int, m.name, m.email,
               m.subject, m.message, i.data->'action'->>'draft'
        from luna_insights i
        join messages m on m.id = (i.data->'action'->'payload'->>'messageId')::int
        where i.data->'action'->>'type' = 'draft_reply'
        order by i.created_at desc
        """
    )
    rows = cur.fetchall()
conn.close()

out = []
for mid, name, email, subject, message, old in rows:
    user = "\n".join([
        "CUSTOMER EMAIL:",
        f"from: {name or '?'} <{email or '?'}>",
        f"subject: {subject or ''}",
        "",
        b.trunc(message or "", 1200),
    ])
    try:
        raw = b.plainify(b.ask_operator(b.OPERATOR_PREAMBLE, user))
        ok, fixed, rej, fl = b.guard_draft(raw, name or "", message or "")
    except Exception as e:
        fixed = f"<ERROR: {e}>"
        ok, rej, fl = False, ["error: " + str(e)], []
    out.append({"customer": name, "old": old, "new": fixed, "guard_ok": ok, "rejections": rej, "flags": fl})
    print("=" * 72)
    print(f"CUSTOMER: {name}   guard_ok={ok}  rejections={rej}  flags={fl}")
    print(f"  OLD: {(old or '').strip()[:240]}")
    print(f"  NEW: {fixed.strip()[:400]}")

with open("/tmp/iggys-regression.json", "w") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"\nWROTE /tmp/iggys-regression.json ({len(out)} drafts)")
