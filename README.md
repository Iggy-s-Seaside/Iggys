# Iggy's Seaside

The software a bar and restaurant in Seaside, Oregon actually runs on: a public site and a
back-of-house operations platform, two React 19 + TypeScript front ends over one Postgres
database, plus a Python service that feeds it.

Live at **[iggysseaside.com](https://iggysseaside.com)**.

This is a working business's repository, not a portfolio piece. The public site has been the
bar's production site since 2023 and reads its content live from Postgres — edit the row and
the site follows, no redeploy. The operations platform behind it is feature-complete and in
final testing ahead of staff rollout.

---

## Layout

| Path | What it is |
|---|---|
| `src/` | Public site — 17 routes plus a 404, content read live from 16 Postgres tables |
| `manager-app/` | Operations platform — 42 routes, role-gated, PWA, offline-capable |
| `manager-app/supabase/functions/` | 31 Deno edge functions (~6,700 lines) — the HTTP API, integrations, and scheduled jobs |
| `manager-app/scripts/` | 42 idempotent SQL migration scripts |
| `manager-app/bridge/` | A Python daemon (~4,500 lines) running under systemd — external-source ingestion and demand forecasting |

Both front ends deploy from this branch on Netlify. The build command is `tsc -b && vite build`,
so a type error cannot reach production; the manager app builds from the `manager-app/` base
directory. 148 successful deploys to date.

## Stack

React 19 · TypeScript 5.9 · Vite · Tailwind · React Router 7 · Supabase / Postgres ·
Deno edge functions · Python (psycopg2, systemd) · Stripe · Netlify · Vitest

## Architecture

**One database, two front ends.** 85 tables, 724 columns, 26 foreign keys, 204 indexes.
Row-level security is on for all 85 tables across 282 policies, and eight financial/PII tables
sit behind a `SECURITY DEFINER has_role()` helper — because authentication is not authorization.

**Edge functions are the API.** Anything needing a secret, a third-party call, or a trust
boundary lives in `manager-app/supabase/functions/` rather than the browser: Stripe checkout,
webhooks and refunds, PIN login, user management, transactional email, web push, calendar sync,
and the analytics ingest path.

**The database drives services, it doesn't just store rows.** A `pg_cron` job fires every 30
seconds and calls an edge function over `pg_net` behind a shared secret. A trigger on `messages`
calls the auto-reply function on insert. Work is claimed from a queue with
`FOR UPDATE SKIP LOCKED` under a worker-liveness heartbeat, and a sweeper requeues stale leases.

**Ingestion, not just CRUD.** `gmail-sync` pulls the Gmail API into a messages table deduped on
Gmail's own message id and is invokable by `pg_cron` behind a shared secret. The Python bridge
pulls hourly person-detection counts from the building's cameras across a 21-hour service
window, two WordPress event-calendar APIs, and weather forecasts for two cities.

## Worth actually reading

- **`manager-app/src/hooks/useOrderScanner.ts`** — photograph a supplier pick sheet, and an edge
  function runs it through Cloud Vision OCR, then a three-tier regex cascade parses the text into
  `{quantity, sku, description, size}` line items. Each line is matched against inventory by
  Jaccard token similarity, accepted at a 0.4 threshold with the confidence recorded, and
  anything below it is flagged `new` or `unreadable` for a human rather than guessed at. Every
  match passes through a review modal before it writes.
- **`manager-app/bridge/`** — the demand forecaster scores a night from weekday, season,
  temperature, precipitation, wind, a Portland-vs-coast heat-escape spread, and nearby
  conventions. It calibrates against 62 nights of ground truth, and it learns its bias from the
  *raw* pre-correction score, never from the corrected one, because learning from your own
  correction oscillates. 60 of those 62 labels are machine-derived from camera counts; the
  labeller returns nothing rather than a guess when there's no signal.
- **`src/components/events/EventsJsonLd.tsx`** — Google won't surface a bare recurrence rule, so
  this materializes weekly events into concrete dated schema.org nodes over a 60-day horizon,
  computing DST-correct Pacific offsets from `Intl.DateTimeFormat` with no date library, and
  handling events that run past midnight.
- **`src/hooks/usePublicCalendar.ts`** — booking availability resolving per-space conflicts
  across a 120-day window, folding confirmed private parties in as busy time.
- **`src/lib/track.ts`** — funnel instrumentation posted with `keepalive: true` so the event
  survives the navigation away on submit.

## Tests

```bash
cd manager-app && npm test    # Vitest — 28 files, 276 tests, ~1.8s
```

Coverage is on the parts where being wrong costs money: invoice math, tip allocation, COGS,
business-day boundaries, calendar sync (ICS and Google Calendar), and CSV export escaping. There
is a second Python test layer for the forecaster that runs without a database by stubbing
`psycopg2` and injecting a fake cursor.

Honest scope: this is a unit and component suite. There is no browser/e2e layer, and the tests
are not wired into CI — the deploy gate is the typecheck.

## Status

The operations platform is in final testing ahead of staff rollout. Stripe Checkout, webhooks,
and refunds are integrated and verified end to end in **test mode**;
live mode is pending the owner's business account activation. Five of the 31 edge functions
(`reviews-sync`, `send-campaign`, `send-sms`, `sms-webhook`, `social-publish`) are deliberate,
labelled stubs awaiting third-party credentials — they are wired and inert, not broken.

## Running it

```bash
npm install && npm run dev                       # public site
cd manager-app && npm install && npm run dev     # manager app
```

Both need a `.env` with Supabase credentials. There is no seed fixture — the database belongs to
a running business.

---

Designed, built, and operated by one engineer — [Bradley Bird](https://github.com/Bradley-Bird) —
who also works the bar, which is why the feedback loop is short.
