# Luna wake-cycle architecture — per-purpose work sessions

_Design + first-phase build, 2026-06-15. Origin: Bradley flagged an alarming
"drafted by Luna" customer reply; diagnosis + this design followed._

## 1. The bug that started it

A customer (Peggy) sent a warm, rambling email. Luna's **drafted reply** read:

> "Hey Bradley. Something on your mind, or were you shaking off a pocket-dial?"

She addressed the **owner**, not the customer, and answered conversationally
instead of drafting the bar's reply. A second case (Steve, a garbled live-music
question) drafted "Ready when you are. What's next?" — an idle standby phrase.

**Root cause (verified, not assumed):** the brain is already **DeepSeek-v4-flash**
(cloud), not the local Qwen — so this was never a model-capability problem. The
draft path sent each customer email through Luna's **personal `/api/chat`**, the
same endpoint as her assistant self, which loads her persona, her memory, and
the baked-in assumption that *she is talking to Bradley*. On vague/low-structure
emails the persona won and she "replied to Bradley." Structured event inquiries
drafted fine — **8 of 10** prod drafts were good; the 2 failures both correlated
with rambling input.

## 2. The principle (Bradley's idea, sharpened)

> Different scheduled **sessions** for different jobs. Each wakes, reads a
> **substrate briefing note** that tells it what it is and what to do, works its
> queue until done, then reschedules itself. Nothing goes stale; nothing is left
> behind.

This is the right shape, and it **also fixes the draft bug**: a session that is
*framed as work* ("you are the bar, drafting a reply to this customer") never
carries the talking-to-Bradley persona, so even an ambiguous email lands as a
real reply. The wake-cycle idea and the draft fix are the same fix.

**One load-bearing correction to the idea:** the "have I already done this?"
guarantee must live in **deterministic state (a DB flag), not Luna's recall.**
Her recall is the *same probabilistic system* that produced the 2 broken drafts
(~80% reliable) — gating control flow on it would redo or silently skip work
~1 in 5 times. So:

- **Control flow is deterministic code** — find the queue (SQL), mark work done
  (a hard flag), schedule the next wake, bound the loop.
- **Luna does the cognition** — drafting, phrasing, deciding — inside a clean,
  work-framed context.
- **Memory is the enrichment layer**, a *backstop* ("I researched this band last
  week, here's what I found"), never the idempotency guarantee.

This is the principle already baked into the bridge: *the bridge is
deterministic; Luna phrases.* The wake-cycle design is that, leveled up.

## 3. What shipped now (Phase 1 — the customer-reply work session)

The customer-reply draft path is the first realization of the work-framed
session. It no longer touches `/api/chat`.

- **`ask_operator()`** — a direct OpenAI-compatible call (DeepSeek `deepseek-chat`)
  with a clean, role-locked **`OPERATOR_PREAMBLE`**: the model *is* the bar,
  drafting a reply *to the named customer*. No personal persona. The preamble
  carries a **closed list of menu facts** (Dooger's food; GF made-on-request,
  chowder GF, no cross-contamination guarantee → route allergies to the kitchen;
  Happy Hour $5/$5/$3 3-5pm; event spaces, never quote a price or hold a date) so
  "never invent facts" has teeth, and names the two prod failures as explicit
  malfunctions so they can't recur.
- **`guard_draft()`** — a deterministic gate before any draft becomes a card:
  - **REJECT** (owner-addressed/relayed, idle/standby phrase, assistant-persona
    leak, unfilled `[placeholder]`, absolute allergen guarantee, empty) → **no
    card**, log the reason, and mark the message `reminded=true` (reusing the
    daemon's existing idempotency contract so a reject never wedges the queue or
    re-burns model calls). An over-reject is a *permanent silent drop*, so the
    reject rules are tuned to avoid false positives — a customer/cocktail named
    Bradley or Luna, or a correct "the kitchen will fully confirm" deferral, must
    **not** be dropped.
  - **FLAG** (off-policy price, booking-confirmation language) → the card is
    surfaced but annotated for the human reviewer (`data.review_flags`).
  - Sign-off and markdown are auto-fixed so a good body is never lost to a nit.
- **Idempotency / dedup** is the existing `luna_classification.reminded=true`
  flag on `messages` — set on pass *and* reject *and* empty. The runtime queue is
  the `fetch_needs_draft` SQL (high-importance, unanswered, not reminded, recent,
  capped at 2/pass). To intentionally re-draft, clear the flag.
- **Scope:** only the customer-reply draft path moved. Luna's interactive Q&A,
  the daily briefing, the demand pulse, the drink special, and email
  classification all still run on Luna (`ask_luna`) by design.

### How it was verified
- A **design panel** produced the role-locked prompt.
- A **judge panel** scored all 10 historical drafts re-run through the new path:
  **10/10 good, both broken cases fixed, anti-confabulation holding** (Steve now
  defers the lineup to the manager instead of inventing it; Peggy gets a warm
  reply that forwards the suggestion and offers a party).
- **Two adversarial code reviewers** caught **4 HIGH guard false-positives**
  before deploy (the "permanent silent drop" risks above); all fixed.
- **`test_guard.py`** (24 cases) + **`regression_drafts.py`** (10 real emails)
  both green; deployed to PC1, `DEEPSEEK_API_KEY` wired into the bridge env,
  daemon healthy.

## 4. Next phase (Phase 2 — generalize to self-scheduling work sessions)

The operator path proves the pattern for one job. To realize the full wake-cycle:

1. **Lift the work-frame into a reusable session shape**: a wake handler reads its
   **standing-orders briefing from substrate** (role + where the live queue is +
   the dedup contract), works the queue until empty or a token/time budget, then
   schedules its own next wake.
2. **Per-purpose sessions, each with its own briefing**: customer-reply drafting,
   the demand pulse, the daily special, follow-up reminders — each a distinct
   wake with a distinct frame, so persona never bleeds across jobs.
3. **Keep the briefing dynamic, not static**: the note defines the role and where
   to *find* live work; the actual task list is computed from DB state each wake,
   so it never staleifies.
4. **Bound every loop** (queue-empty or budget) — a self-scheduling worker, not an
   unbounded resident process.
5. **Deterministic idempotency everywhere** (hard flags), with Luna's recall as
   the enrichment backstop — never the guarantee.

Where this is most valuable next: an **owner-digest** wake (assemble the day's
money + pipeline + needs-reply into one card) and a **follow-up** wake (chase
unanswered proposals/parties), both deterministic-queue + Luna-phrased.

## 5. Files

- `manager-app/bridge/luna_iggys_bridge.py` — `OPERATOR_PREAMBLE`, `ask_operator`,
  `guard_draft`, `_ensure_signoff`, rewritten `draft_and_insight`. Old
  `TRIAGE_DRAFT_PREAMBLE` removed.
- `manager-app/bridge/test_guard.py` — 24-case guard regression.
- `manager-app/bridge/regression_drafts.py` — replays the 10 real emails through
  the new path for judging.
- PC1: deployed at `~/projects/iggys-bridge/luna_iggys_bridge.py`; service
  `luna-iggys-bridge`; env `~/.local-agent/luna-iggys-bridge.env`
  (`DEEPSEEK_API_KEY` + `OPERATOR_MODEL=deepseek-chat`).
