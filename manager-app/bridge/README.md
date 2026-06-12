# Luna <-> Iggy's Bridge

A small daemon that runs on PC1 (Arch Linux) and connects the Iggy's Seaside
manager dashboard (Supabase) to Luna, the local AI assistant whose chat API
runs on the same box. Managers type questions into the dashboard; Luna answers
them. Every morning at 07:00 she also drops a briefing into the dashboard's
insights feed.

One Python file, stdlib + `psycopg2` only. No webhooks, no edge functions, no
inbound ports — the daemon polls Postgres and talks to Luna on localhost.

## Data flow

```
  Manager dashboard (browser)
        |  insert question                     ^  show reply / insight
        v                                      |
  Supabase Postgres  (luna_messages, luna_insights;
        ^             read-only: events, parties, messages)
        |  direct Postgres, role 'luna_bridge'
        |  via Supavisor session pooler :5432, sslmode=require
        v
  PC1: luna_iggys_bridge.py
        |  poll luna_messages WHERE status='pending'   (every 5s)
        |  claim row (pending -> processing)
        |  build context (events / parties / new messages)
        v
  Luna chat API  POST http://localhost:3033/api/chat  (SSE)
        |  event: session -> sentence... -> text (full reply) -> done
        v
  bridge writes reply row (role='luna', reply_to=question id)
  + flips question to status='answered'  (one transaction)

  --briefing mode (07:00 timer): context -> Luna -> INSERT luna_insights
  (kind='briefing', status='new'), exit.
```

## Files

| File | What |
|---|---|
| `luna_iggys_bridge.py` | The daemon. No args = poll loop; `--briefing` = oneshot insight. |
| `luna-iggys-bridge.service` | systemd unit for the poll loop (Restart=always). |
| `luna-iggys-briefing.service` | oneshot unit running `--briefing`. |
| `luna-iggys-briefing.timer` | fires the briefing daily at 07:00 box-local time. |
| `luna-bridge.env.example` | env template (placeholders only). |

## Deploy to PC1

From this Mac (`ssh bradley@archlinux`):

```bash
# 1. Ship the files
ssh bradley@archlinux 'mkdir -p /home/bradley/projects/iggys-bridge'
scp luna_iggys_bridge.py bradley@archlinux:/home/bradley/projects/iggys-bridge/

# 2. On PC1: dependency (either works)
sudo pacman -S --needed python-psycopg2
#   ...or: pip install psycopg2-binary

# 3. On PC1: env file (real secrets live ONLY here)
cp luna-bridge.env.example /home/bradley/.local-agent/luna-iggys-bridge.env
chmod 600 /home/bradley/.local-agent/luna-iggys-bridge.env
# Fill in:
#  - LUNA_BRIDGE_DSN: replace CHANGEME with the luna_bridge role password
#  - LUNA_API_TOKEN: copy from the existing Luna API env:
#      grep LUNA_API_TOKEN ~/.local-agent/luna-api.env

# 4. On PC1: system units (not --user units: they must run without an
#    active login session and survive reboots)
sudo cp luna-iggys-bridge.service luna-iggys-briefing.service \
        luna-iggys-briefing.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now luna-iggys-bridge.service
sudo systemctl enable --now luna-iggys-briefing.timer
```

The briefing timer fires at 07:00 in the box's local timezone — confirm with
`timedatectl` that PC1 is on `America/Los_Angeles`.

## Test it

Watch the daemon:

```bash
journalctl -u luna-iggys-bridge -f
```

Insert a pending question (Supabase SQL editor, or any client with insert
rights on `luna_messages`):

```sql
INSERT INTO luna_messages (role, content, status, author_email)
VALUES ('user', 'What''s on the calendar this weekend?', 'pending',
        'bradley@test.local');
```

Within ~5s the journal should show `question N: asking Luna`, then (15–60s
later — Luna reasons before speaking) `question N: answered`. Verify:

```sql
SELECT id, role, status, left(content, 80), reply_to
FROM luna_messages ORDER BY id DESC LIMIT 4;
```

Run the briefing by hand:

```bash
sudo systemctl start luna-iggys-briefing.service
journalctl -u luna-iggys-briefing --no-pager -n 20
# then: SELECT * FROM luna_insights ORDER BY id DESC LIMIT 1;
```

## Behavior notes

- **Serial by design.** One question at a time, so a single Luna sessionId
  (`iggys-dashboard`) never has two in-flight requests. After a timeout the
  one retry uses a fresh session (`iggys-dashboard-r2`) so it can't collide
  with a request still draining on the original session.
- **180s SSE deadline, never shorter.** Luna's first visible token can take
  15–60s of reasoning.
- **Crash-proof loop.** A failing question is marked `status='error'` (with
  the error text) and the loop continues; Postgres drops trigger reconnect
  with exponential backoff (2s → 60s); systemd restarts the whole process if
  anything truly fatal happens.
- **Claim guard.** A row is only worked after `UPDATE ... SET
  status='processing' WHERE id=... AND status='pending' RETURNING id`
  succeeds, so two daemons (or a restart race) can't double-answer.
- **Bounded context.** 14-day event window, ≤10 parties, ≤160 chars/line,
  question capped at 4000 chars. Context queries are individually defensive —
  if one fails, Luna still gets the rest.

## Security

- **Least-privilege DB role.** `luna_bridge` should have only:
  SELECT/INSERT/UPDATE on `luna_messages`, INSERT (+SELECT) on
  `luna_insights`, and SELECT on `events`, `parties`, `messages`. No DDL, no
  DELETE, no access to auth schemas, packages, menus, or anything else. If a
  grant is missing, the daemon logs the error and keeps running.
- **No service-role key, no Supabase API key.** The bridge speaks plain
  Postgres over TLS (`sslmode=require`) through the session pooler.
- **Secrets live only in** `/home/bradley/.local-agent/luna-iggys-bridge.env`
  (chmod 600, owned by bradley). Nothing in this repo contains a real
  credential — placeholders only.
- **Luna API stays on localhost** (`127.0.0.1:3033`), bearer-token protected;
  the bridge never exposes it.
- **Blast radius if PC1 is compromised:** read calendar/party/contact data,
  write chat replies and insights. It cannot touch payments, users, or
  schema.
