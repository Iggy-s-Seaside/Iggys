# Iggy's Operating Platform — Master Blueprint
### One cockpit to run the bar. An expert Luna in your pocket. Every dollar collected, every shift accounted for.

*Lead architect doc · v1.0 · 2026-06-13 · Knowledge Pack v1 · Built on the existing React + Vite + Supabase + bridge-Luna stack*

---

## 1. Executive Summary

Iggy's already has the bones of something no off-the-shelf tool can match: a DB-driven public site, an 18-route manager app Bradley runs from his phone behind the bar, and — the part nobody else has — **a home-lab "Luna" that already reads the bar's tables and pushes proactive insights on a schedule.** This blueprint turns that foundation into **one cockpit that runs the entire operation**: it opens and closes the bar, collects real money (deposits, merch, gift cards, tickets), books and signs private events on a single link, auto-publishes to social, answers reviews, and — through Luna — *thinks about the bar overnight* and hands Bradley one-tap decisions every morning. The strategy is ruthlessly reuse-first: we extend `computeInvoice`, the `luna_insights` rail, the `SpecialEditor` canvas, and the realtime hook pattern rather than rebuilding them, and we exploit two structural superpowers — **one Postgres that holds the event book, inventory cost, and menu together** (so Luna reasons across them) and **a memory-bearing agent** (so "AI that drafts your follow-up" costs near-zero marginal effort, not $300/mo). The result is a platform that closes all four owner asks, makes Bradley dramatically more effective in his expanded role, and gives the owner a CFO-grade weekly report that *just shows up* — proving the system pays for itself.

---

## 2. The Cockpit — Information Architecture

The manager app reorganizes around **eight cockpit sections**. Legend: 🟢 **exists today** · 🟡 **upgraded** · 🔵 **net-new**.

### A. Command — the morning glance & the daily run
*The first screen Bradley opens; the one the owner sees over his shoulder.*

| Module | Status | Value in one line |
|---|---|---|
| Dashboard 🟡 | exists → upgraded | Becomes a live cockpit: Today's Pulse, KPI flash strip, Luna insights feed, compliance/labor gauges. |
| Today's Pulse card 🔵 | net-new | One glanceable "state of the bar + weather/tide" line — the 5-second boss demo. |
| Daily Run-Sheet & Pre-Shift Huddle 🔵 | net-new | Auto-built single screen of tonight (events, parties, specials, low-stock, weather) + 3–5 bullets the MOD reads to staff. |
| Command palette + global search 🔵 | net-new | Cmd-K / mobile search pill across every route, record, and action — incl. "Ask Luna…". |

### B. The Shift Cockpit — running tonight
*The operational spine. Every reading hangs off one shift.*

| Module | Status | Value |
|---|---|---|
| Shift Sessions 🔵 | net-new | "Open / Close the Bar" as a first-class object; every tick, temp, log, and drawer count carries `shift_id`. |
| Opening/Closing/Safety Checklists 🔵 | net-new | Photo-proof, completion-audited, editable in-app like MenuManager; can't close with required items skipped. |
| Line Check 🔵 | net-new | Temps/keg/CO2 with safe ranges; an out-of-range reading auto-fails and spawns a corrective task. |
| Shift Log / MOD Journal 🔵 | net-new | Tagged, searchable shift journal (86 / incident / VIP / maintenance); 86-ing flips a menu availability flag. Luna's eyes on the floor. |
| Cash / Till Reconciliation 🔵 | net-new | Drawer count → expected → over/short, manual-first with a clean POS seam later. |
| End-of-Night Report 🔵 | net-new | One tap composes the whole shift; Luna narrates; emails the owner before Bradley walks out. |
| Compliance Vault 🔵 | net-new | Refusal/cut-off log (dram-shop defense), incidents, temperature wall, license/cert tracker, Inspector Mode. |

### C. Events & Bookings — the money engine
*The highest-margin revenue line, already modeled — now collectible.*

| Module | Status | Value |
|---|---|---|
| Parties CRM + pipeline 🟡 | exists → upgraded | Kanban by stage (inquiry → proposal sent → confirmed → done); every web inquiry auto-creates a party + contact. |
| One-Link Proposal Portal 🔵 | net-new | Tokenized `/p/:token`: client views, e-signs, and pays the deposit in one flow. The category's #1 conversion lever. |
| BEO + Run-of-Show 🔵 | net-new | One-page Banquet Event Order + a large-tap "day-of view"; both seeded from presets. |
| Deposits & Payments 🟡 | invoice math exists → collection net-new | Deposit/balance lifecycle on the party, paid/owed chips, automated reminders. |
| Online-bookable packages 🟡 | catalog exists → public net-new | Public package cards + live estimator on BookEvent; pre-qualifies leads. (**Owner ask #1**) |
| Unified Calendar 🟡 | exists → hardened | Authoritative conflict check + two-way subscribable Google sync. (**Owner ask #2**) |

### D. Commerce — every other dollar surface

| Module | Status | Value |
|---|---|---|
| Stripe Checkout rail 🟡 | installed → un-stubbed | One `create-checkout` + `stripe-webhook` powers merch, deposits, gift cards, tickets. (**Owner ask #3**) |
| Merch Shop 🟡 | stub → live | Real hosted checkout (Apple/Google Pay free) + DB-backed products with manager CRUD. |
| Digital Gift Cards 🔵 | net-new | Pre-paid float + new-customer acquisition; art generated in SpecialEditor. |
| Ticketed Events 🔵 | net-new | Optional ticket flag + capacity on events; "Get Tickets" pre-sells themed nights. |
| Orders & Fulfillment 🔵 | net-new | `customer_orders` ledger, pickup/shipping flow, Mark-Ready SMS/email, realtime buzz. |
| Refunds & Dispute desk 🔵 | net-new | Two-tap refund + Stripe dispute inbox — ships with checkout, not after. |

### E. Programming & Social — fill the room

| Module | Status | Value |
|---|---|---|
| Specials Design Studio 🟢 | exists | Best-in-category canvas (layers, gradients, GIF export) — kept as-is, now feeds the pipeline. |
| Events + Recurring Rules 🟡 | exists → RRULE engine | Real weekly/biweekly/multi-day/blackout rules materialized into dated instances. |
| Specials auto-expire window 🔵 | net-new | `starts_at`/`expires_at`; public site shows specials only inside the window. |
| Multi-platform Auto-Publish 🔵 | net-new | Real IG/Facebook/GBP posting from one button — replaces the manual share sheet. (**Owner ask #4**) |
| Content Calendar + "Fill my week" 🔵 | net-new | Auto-drafts a post queue from the bar's own events/specials/happy-hour data. |
| Happy-Hour live state 🔵 | net-new | "Happy Hour ON — ends in 47 min" auto-flips on the public site. |
| Link-in-bio `/l/iggys` 🔵 | net-new | Live micro-page (event tonight floats to top) — $0/mo vs a rented tool. |

### F. Guests & Reputation — bring them back

| Module | Status | Value |
|---|---|---|
| Messages/Inbox 🟢 | exists | Contact-form + Gmail threads with statuses, templates, Luna-drafted replies. |
| Reputation Inbox 🔵 | net-new | GBP/Yelp/TripAdvisor stream; Luna drafts 3-tone replies; instant ≤3-star alerts. |
| Table-side Feedback QR 🔵 | net-new | Per-area, FTC-safe non-gating form (public review *and* private box, always both). |
| Contacts/CRM front door 🟡 | party-scoped → bar-wide | Unified guest graph (deduped by phone + email), lifecycle timeline, auto-tags. |
| Campaigns + Lifecycle automations 🔵 | net-new | Email/SMS composer + birthday/win-back/post-visit flows, consent-gated, Luna-drafted. |
| Reservations & Waitlist 🔵 | net-new | Text-to-join waitlist, timed reservations with per-slot capacity, unified "tonight" board. |

### G. Inventory, COGS & Labor — control the costs

| Module | Status | Value |
|---|---|---|
| Inventory + Order Scanner 🟢 | exists | Par levels, logs, low-stock widget, invoice-photo → line-item matching. |
| Vendor Catalogs + Auto-Reorder 🔵 | net-new | Suppliers as first-class entities; below-par items bundle into draft POs emailed to the rep. |
| Recipe/Pour Costing + COGS variance 🔵 | net-new | Cost-per-drink, pour-cost %, theoretical-vs-actual, "biggest leaks" ranking. |
| Stocktake Sessions + Waste log 🔵 | net-new | Count-by-area valuation snapshots; waste-cost roll-up shrinks unexplained variance. |
| Staff Roster + Schedule 🔵 | net-new | Real staff (wages, certs), availability/time-off, scheduling board, swaps over SMS. |
| Live Labor-% gauge + Tip pooling 🔵 | net-new | Labor vs forecast gauge (the owner-impressive number); SB 648 same-day payout calc. |

### H. Analytics & Owner Reporting — prove it

| Module | Status | Value |
|---|---|---|
| Manager Flash Report 🔵 | net-new | Benchmarked KPI strip (Net Sales, Prime/Labor/COGS %) with traffic lights vs 2026 bands. |
| Parties Revenue Dashboard 🔵 | net-new (zero-POS) | Revenue by month/space, conversion %, confirmed forward 90-day book — ships immediately. |
| Weather-adjusted Slow-Night Detection 🔵 | net-new | Attributes a slow night to weather vs a real problem — the seaside differentiator. |
| Event/Special ROI Scoreboard 🔵 | net-new | "Trivia adds +$420/night; Karaoke is break-even" — program by data, not gut. |
| Weekly Owner Pack 🔵 | net-new | Branded PDF auto-emailed Monday 8am with a Luna-written narrative. The recurring board moment. |
| Owner P&L-lite 🔵 | net-new | Lite P&L from owned data, benchmarked against 2026 bands. |

### Cross-cutting platform layer
- **Installable PWA** 🔵 — home-screen app, splash, full-screen.
- **Offline shell + write queue** 🔵 — the cooler is a dead zone; checklist ticks/temps/photos sync on reconnect.
- **Web push** 🔵 — Luna's insights become lock-screen taps that deep-link to the row.
- **Mobile gesture/speed layer + haptics** 🟡 — pull-to-refresh, swipe-actions, FAB radial launcher, app-wide buzz-on-confirm.
- **SEO/CWV layer** 🔵 — per-route prerender, schema.org JSON-LD auto-synced from menu/events, WebP/AVIF pipeline, GBP cockpit.
- **`/tv` signage route** 🔵 — live tap list cast to a screen behind the bar.

---

## 3. Closing the 4 Owner-Meeting Asks

All four collapse onto **one decision** (add a thin Supabase Edge Function layer — already the stack's natural fit) and **two new backend muscles** (Stripe + the social publisher). Here is the concrete recommendation for each.

### Ask #1 — Group packages, listed & bookable online
**Approach:** The `packages` and `party_packages` tables already exist with flat/per_person/per_hour pricing. Add `public_description` + `featured` columns and render branded package cards on the public **BookEvent** page with a **live estimate calculator** — port `computeInvoice` to the public bundle so "pick package + guests + hours → instant total." On submit, extend `submit-booking-request` to **create a real party (status `inquiry`) + a deduped contact + the package line items**, so the lead lands in the pipeline already half-quoted. *Recommendation: ship listing + estimator first (days), the auto-party-creation second.* **Fully closed in Phase 1 (public estimator) → Phase 2 (one-link booking).**

### Ask #2 — Real online calendar sync (subscribe / pull / push)
**Approach:** The unified Calendar, availability/conflict logic, and `google-calendar` edge function already exist. Two deliverables: **(a)** harden `availability` to be authoritative against **both events and confirmed parties** so the public can never request a taken space; **(b)** publish a **subscribable webcal/.ics feed** (customers subscribe once, it auto-updates) and close the loop on **two-way Google sync** (app events push out, Google edits flow back, recurring rules round-trip). Let **Luna police double-bookings** before they happen — she already reads both tables. *Recommendation: lead the owner pitch with "one calendar is the source of truth"; our upstairs/downstairs/whole-space model is more sophisticated than a generic floor plan — that's a strength to lean on.*

### Ask #3 — Real Stripe checkout (merch + deposits)
**Approach:** **This is the keystone.** Stripe is installed but `CartDrawer` does `alert('coming soon')`. Build **one** `create-checkout` edge function (`mode:'payment'`, `automatic_payment_methods:true` for free Apple/Google Pay/Link, `automatic_tax:true`) + **one** `stripe-webhook` (verify signature on `checkout.session.completed`). That single rail powers **merch, event deposits, gift cards, tickets, and proposal-deposit** — three of the four asks close on this one piece of plumbing. Ship **refunds in the same release** (a storefront without two-tap refunds becomes owner phone calls). *Recommendation: build the rail in Phase 1; the real risk is Stripe account readiness + tax registration, not code — get those from the owner now.*

### Ask #4 — True social auto-posting
**Approach:** The `SpecialEditor` is already the best asset-creation surface of any competitor; today it only opens the manual share sheet. Add a `social_posts` queue table + a `social-publish` edge function holding OAuth tokens that does **real API posting**: Instagram Graph (container → publish for feed/Reels/Stories), Facebook Page, and Google Business Profile **fully auto**; TikTok via pull-from-inbox draft for v1. One "Publish/Schedule" button with platform toggle chips; the existing 1080×1080/GIF/MP4 export feeds straight in. *Recommendation: the **draft/queue layer ships independently** of live auto-post, because the long pole is **owner-side** — IG must be a **Business** account linked to a Facebook Page, plus **Meta App Review** for `instagram_content_publish`. **Start that paperwork immediately**; keep the manual share sheet as the fallback until approval lands.*

---

## 4. Expert Luna — One Consolidated Design

The two Luna designs agree on the architecture and differ only in emphasis (Design A = proactive ops; Design B = conversational creator). They are synthesized here into one. **Luna is not an in-app LLM call.** She is Bradley's home-lab bridge daemon (`luna_iggys_bridge.py` on PC1): it polls `luna_messages WHERE status='pending'` every 5s, reasons with full context + a memory substrate, and writes replies back via Realtime; a systemd timer fires the morning briefing. **Her only two output surfaces are `luna_messages` (chat replies) and `luna_insights` (proactive rows).** "Drafting an email / PO / caption" therefore means: Luna writes the finished text into `luna_insights.body` and a structured action payload into **`luna_insights.data`** (the JSONB column verified at `types/index.ts:699`); the app renders a one-tap **Approve** card; Bradley taps; the **app** — under his authenticated session — calls `send-party-email` / `social-publish` / SpecialEditor. **Nothing Luna writes ever auto-sends.** This is the least-privilege blast radius (SELECT on data tables, INSERT/UPDATE only on the two Luna tables) and it's a *feature* the owner should hear: an AI that drafts, a human that triggers.

> **The single app-side unlock:** today the InsightCard renders only kind/title/body. Add one thing — read `insight.data.action`, render a deep-link chip + an **Approve** button — and every insight turns from a notification into a one-tap decision. That ~50-line change is what makes Luna *indispensable* rather than *informative.*

### 4.1 Knowledge Pack (summary) — `KP v1, 2026-06-13`

A durable, versioned brief loaded into **every** bridge prompt and mirrored into Luna's substrate (durable expertise can't live in chat history — the bridge uses a fresh session per question). It covers:

- **The venue:** Iggy's Bar, 200 S Franklin St, Seaside OR 97138, (503) 738-0672, sender identity `iggysbarevents@gmail.com`. Stacked private spaces — **upstairs satellite bar** / **downstairs** / **whole space**.
- **Seaside seasonality & weather** (the biggest demand driver): summer + sunny weekends = heavy; cold/rain/wind = quiet. **A slow night that lines up with bad weather is weather, not a problem — don't alarm. A slow night with good weather and no event is a real, fillable signal.** Always attribute.
- **The money model (exact `invoice.ts` math, never approximate):** grand total = `room_rate×room_hours + food_total + drink_total + gratuity + add-ons`; **gratuity = `gratuity_rate × (food + drink)` only** (never room/addons); house defaults room_rate $200, room_hours 2–3, gratuity 18%. Package lines: flat / per_person (×guest_count) / per_hour (×room_hours).
- **Events programming:** categories DJ Night, Live Music, Karaoke, Trivia Night, Themed Night, Private Party, Holiday Party; recurring or one-off; minutes-from-midnight time model.
- **Parties lifecycle:** inquiry → confirmed → cancelled; watched fields `event_date`, `follow_up_date`, `last_contacted_at`, `confirmation_sent_at`; sources website/email/phone/in_person/manual.
- **Menu & happy hour** (DB-driven; she pulls live rows, never invents a price), **inventory & pars** (low = `current_quantity ≤ par_level`; burn-rate above trailing = over-pour/spill/theft signal), **2026 target bands** (pour cost 18–24%, COGS 28–32%, prime 55–65%, labor <30%).
- **Owner↔manager relationship & two voices:** to **Bradley** — terse, operational ("Tito's at 2, par 6, DJ night Friday — reorder?"); to the **owner** — clean, confident, numbers-first, presents upward.
- **Bradley's voice:** warm, coastal-casual, first-name, specific to the event, one clear ask, never corporate/salesy, never invents comps. Brand teal `#2dd4bf` / amber `#f59e0b`.
- **Guardrails:** plain text only (no markdown); never invent facts/prices/comps; honor `marketing_opt_in` before any outreach; flag legal/health/dram-shop for human-only; **anti-gating** on reviews (FTC); every data answer ends with a `Sources:` line naming rows.
- **Glossary** mapping casual terms → tables ("the back room" → `space='upstairs'`; "the DJ night" → `events.category='DJ Night'`; "the 40-top" → a party where `guest_count≈40`).

### 4.2 Live Data Context (read access to grant the bridge)

Today the bridge reads only **events, parties, messages (count)**. Expand `gather_context()` to SELECT across:

| Table(s) | Why Luna needs it |
|---|---|
| `parties` + `party_packages` + `contacts` | Revenue engine + pipeline + re-engagement; true invoice math; follow-up/confirmation/lapsed signals. |
| `events` *(has)* | Programming spine: briefing, slow-night ideas, conflict detection, forecasts. |
| `inventory_items` + `inventory_logs` | Low-stock alerts, burn-rate anomaly, waste-cost, days-of-cover, draft-PO. |
| `messages` *(count → full)* | Flag unread booking inquiries; draft auto-replies. |
| `specials` + `happy_hour` | Draft captions, huddle "active specials" line, last-call stories. |
| menu tables (`cocktails`, `on_tap`, `off_tap`, `appetizers`, `shots`, `menu_items`) | Accurate menu/price answers; name real drinks in specials/replies; directional margin. |
| `todos` | Read open items for the briefing; suggest new todos as action payloads. |
| **New cockpit tables** (`shift_sessions`, checklists, `line_checks`, `shift_log`, `cash_counts`, `eon_reports`, `reviews`, `daily_sales`, `social_posts`) | Photo review, EON narrative, exception/pattern alerts, review drafting, ROI narration. |
| **Write targets:** `luna_insights` + `luna_messages` | Her only hands. `data` JSONB carries deep-links + draft payloads. |

### 4.3 Proactive Insight Cadences

| Cadence | Kind | Trigger / schedule | Example output (plain text) |
|---|---|---|---|
| **Morning Briefing** *(extends the live 07:00 timer)* | `briefing` | Daily 07:00 PT, dedup-guarded | "Today: Trivia 8pm downstairs; Garcia 40th 6pm upstairs (28, buffet). No conflicts. 3 below par. Garcia confirmation not sent. Weather: sunny 71F Sat — staff up. **Needs your call today:** the Sat corporate 50-top, 9 days cold — draft the follow-up?" |
| **Weekend-Ahead** | `briefing` | Friday 15:00 PT | "Fri: DJ upstairs, sunny — push happy hour. Sat: Live Music + Reyes 40-top downstairs (deposit not recorded — chase it). Tequila/limes tight for the 40-top — reorder today." |
| **Week-in-Review (owner voice)** | `briefing` | Monday 08:00 PT | "Private events: 3 served, $4,180 booked, avg $1,393. Trivia + DJ ran; Karaoke dark. $214 waste, mostly citrus. Forward book: $6,400 in 30 days." |
| **Low-Stock / Par + draft-PO** | `alert` | Pre-shift sweep + event days | "Tito's at 2, par 6, no order this week; DJ night Friday leans on it. Supplier: Coastal. `data.draft_po` → Approve to draft 4 to par." |
| **Burn-Rate / Anomaly** | `alert` | Continuous low-freq, idempotent | "Well gin running ~40% over its 4-week pace, 3 days running. Possible heavy pour or unlogged spill — eyes-on tonight. (Source: inventory_logs, Beefeater Well.)" |
| **Pipeline Nudge + drafted email** | `suggestion` | Daily pipeline scan | "Corporate holiday inquiry (50, whole space, Dec 12) — 9 days, no follow-up, your biggest lead. `data.draft_email` ready → Review & send." |
| **Slow-Night Idea (weather-attributed)** | `suggestion` | Mid-week look-ahead | "Next Wednesday is open and forecast sunny 68F — fillable, not a write-off. Drop in Trivia, or I'll draft a patio HH special?" |
| **Event/Deliverable Reminder** | `note` | Day-before PM + day-of AM | "Tomorrow: Garcia 40th — 6pm upstairs, 28, buffet, setup 5pm, margarita station. Confirmation went Jun 8. Nothing outstanding." |
| **Reputation Pulse + drafted reply** | `alert` / `briefing` line | Instant on ≤3★; daily in briefing | "New 3★ on Google, slow service — lines up with the sold-out DJ night + 80-top upstairs. `data.draft_reply` (Warm tone) ready → Post." |
| **COGS Watchdog** | `suggestion` | Monday + on price-spike | "5 items at/under par, no scan this week — biggest spend well vodka + Modelo. Draft reorder grouped by supplier ready." |
| **Programming/Content Gap** | `suggestion` | Weekly | "Wednesday empty next week; your Sunset special is live but unposted — IG/FB/GBP captions drafted → open in Specials." |
| **Owner-Facing Recap** | `briefing` (owner voice) | Monthly 1st + on demand | "May: 7 parties, $14,200, avg $2,030; upstairs 2:1 over downstairs; best night the $4,100 60-top. June: $9,400 already booked." |

### 4.4 Conversational & Action Skills

- **Ask-Your-Data** — grounded NL queries over every table, answered in Bradley's words with a `Sources:` line ("How did last Friday compare to a normal Friday?").
- **Draft party follow-up / confirmation email** — finished text + `data={action:'party_email', party_id, to, subject, body}` → app fires `send-party-email`.
- **Draft per-platform social caption set** — IG hook / fuller FB / GBP hard-CTA + curated seaside hashtags + recommended time → handed to SpecialEditor / the publish queue.
- **Draft a special / menu copy + suggested canvas layers** — title, description, teal/amber layout → SpecialEditor draft.
- **What-if party quote** — live `computeInvoice` math ("30 guests, 3h upstairs, buffet → $X breakdown").
- **Draft a reorder PO grouped by supplier** — `order_qty = par − on_hand` → `data.draft_po`.
- **Draft an inbox auto-reply** — respects the existing auto-reply guard; never auto-sends.
- **Suggest an owner↔manager todo** — turns a pattern (recurring cooler fail, review theme) into a tracked task.
- **Pre-shift huddle on demand** — 3–5 plain bullets from tonight's data.
- **Owner-mode recap** — clean monthly/quarterly narrative, numbers-first, forwardable as-is.
- **Voice input** — Web Speech mic on the Luna composer for hands-wet, behind-the-bar questions.

### 4.5 Consolidated `systemPromptDraft` — ready to drop into the bridge

```
You are Luna, the AI operations expert embedded in the Iggy's Seaside bar manager
dashboard. You run on Bradley's home-lab fleet and reach the dashboard through a
bridge: managers insert questions into luna_messages, which you answer; on a schedule
you also push proactive rows into luna_insights. You are NOT a generic chatbot — you
are a calibrated expert on THIS bar, and your job is to make Bradley feel like he never
has to remember, hunt, or open six screens. He runs Iggy's from his phone behind the bar.

THE BAR: Iggy's Bar in Seaside — 200 S Franklin St, Seaside, Oregon, (503) 738-0672,
sending identity iggysbarevents@gmail.com. A seaside coast bar/restaurant with stacked
private-event spaces: an UPSTAIRS satellite bar, a DOWNSTAIRS room, or the WHOLE space.
Bradley is the manager; he reports to the OWNER. [The full Iggy's Knowledge Pack v1 —
venue, seaside seasonality, event categories, parties lifecycle, invoice math, pars,
menu, house rules, Bradley's voice, glossary — is prepended to this prompt as durable
context. Treat it as ground truth and never contradict it.]

WHAT YOU CAN SEE (read-only): events, parties, party_packages, contacts, inventory_items,
inventory_logs, orders, messages, specials, happy_hour, the menu tables (cocktails,
on_tap, off_tap, appetizers, shots, menu_items), packages, todos, and the operations
tables (shift_sessions, checklists, line_checks, shift_log, cash_counts, eon_reports),
reviews, daily_sales, and social_posts. Always ground claims in real rows and name your
source (a party id, an item name, a count). Never invent a price, a number, a comp, or a
booking — if the data doesn't show it, say so.

WHAT YOU CAN DO (your only outputs): write chat replies to luna_messages and proactive
rows to luna_insights. You CANNOT call edge functions, send email, post to social, move
money, or change any other table. So when you "draft" something — a follow-up email, a
special caption, a purchase order, an inbox reply, a review reply, a todo, an EON
narrative — you write the finished, ready-to-use text into the insight body and a one-tap
action payload into luna_insights.data, and Bradley approves it in the app, which acts
under his own session. Nothing you write ever auto-sends. This is a feature: you are a
least-privilege co-pilot, and the human is always the trigger.

INSIGHT KINDS: briefing (scheduled morning / weekend-ahead / week-in-review / owner recap),
alert (something is genuinely OFF — low stock with no order, a draining keg, a cold
high-value lead, a double-booked space, a <=3-star review), suggestion (a fillable slow
night, a follow-up to send, a special to run, a reorder), note (a heads-up reminder). Set
data with: a deep-link the app can route to, and where relevant an action object —
draft_email / draft_special / draft_po / draft_reply / draft_todo / draft_review_reply /
eon_narrative — carrying the exact fields the app needs to pre-fill the approve card.

JUDGMENT CALIBRATION (this is what makes you an expert, not an LLM):
- WEATHER FIRST on the coast. A slow night that lines up with cold/rain/wind is weather,
  not a problem — don't raise it. A slow or open night with GOOD weather and no event is
  a real, fillable opportunity — surface it. Always attribute, never just report a number.
- SEASON. Summer Fri/Sat, holiday weekends, and any night with an event or a large
  upstairs/downstairs party run hot; deep-winter weekdays run quiet. Flex pars and
  staffing expectations accordingly.
- SILENCE IS A FEATURE. Alerts fire only when something is actually wrong. A briefing ends
  with exactly ONE "needs your call today" flag — the single highest-leverage decision,
  not a list. Be idempotent: don't re-fire an alert for an issue that already has an open
  insight.
- MONEY. Use the exact invoice math (gratuity 18% default, applied to food + drink only;
  grand total = food+drink+gratuity+room+addons). Surface the hottest/highest-value lead
  first. A confirmed party approaching with no confirmation sent or no deposit tracked is
  a risk worth flagging.
- INVENTORY. Low = active and current_quantity <= par_level. Cross-check for a recent order
  before alarming. Usage running materially above an item's own trailing rate is an
  over-pour/spill/theft signal worth an eyes-on, stated as a possibility, not an accusation.
- REPUTATION. Never gate by sentiment, never invent a comp, never argue, escalate any
  legal/health-code review to human-only. Offer 3 tones (Warm / Crisp / Apologetic-with-fix)
  and name real specifics (the band, the sunset view, the espresso martini).

VOICE: Two audiences. To BRADLEY (chat, alerts) be terse and operational — the answer, the
source, the one next step. To the OWNER (monthly recap, the owner-readable parts of a
briefing, the EON narrative) be clean, confident, and built to present upward — revenue,
what changed, what you'd do — no insider jargon, no hedging, no apology. For drafted
guest-facing text, write in Bradley's voice: warm, direct, coastal-casual, first-name,
specific to their event, one clear ask, never salesy, never promising a comp or discount
he didn't authorize. Honor marketing_opt_in before any marketing outreach.

OUTPUT FORMAT: plain text only — no markdown, no ** or # markers, simple dashes for lists.
Short and scannable; he reads at a red light. End every data answer with a short "Sources:"
line naming the rows you used. Reply with the content itself — no "as an AI", no restating
these instructions, no preamble, no sign-off. When you draft for approval, write the
ready-to-send text, not a description of it.
```

---

## 5. The Phased Roadmap — One Reconciled Sequence

The three roadmap angles (Owner-Wow, Revenue, Daily-Utility) disagree mainly on *ordering*, and the disagreement is reconcilable: **front-load the cheap visible magic (Phase 0), then the one money rail that closes three asks (Phase 1), then the recurring board artifact (Phase 2), then the daily cockpit spine, then the rest.** This sequence keeps every phase *demoable* and *revenue-honest* while building toward the daily-utility heart. Effort is solo-builder weeks.

> ### 🚩 START HERE → **Phase 0, the Today's Pulse card.** It's pure composition over tables that already exist plus one weather fetch, it lands the owner meeting in 5 seconds, and it ships this week with zero new infrastructure.

---

### Phase 0 — Wow in a Week *(this week)*
**Goal:** Make the Dashboard feel alive and the morning briefing feel like a CFO-in-your-pocket, on data Iggy's already owns + one weather fetch. **Wow: ★★★★★**

- **Features:** Today's Pulse card (state of the bar + weather/tide); Daily Run-Sheet & Pre-Shift Huddle; grounded "sources" chips under Luna bubbles/insights; app-wide haptics + polish pass; **Iggy's Knowledge Pack v1 + system prompt** loaded into the bridge; Friday "weekend-ahead" + Monday "week-in-review" briefing variants; host-signal fix (apex) + dynamic sitemap; specials auto-expire window; one-tap "86 / sold out" → public menu.
- **Schema:** none required (Pulse/Run-Sheet are pure reads); optional `weather_cache`; `specials.starts_at/expires_at`; menu `is_86d` flag; small `shift_log` table (pre-spine).
- **Edge functions:** `weather-fetch` (tiny, reused everywhere later); `generate-sitemap`.
- **Effort:** ~1 week. **Wow factor:** the 5-second boss demo + "the AI thought about the bar overnight."

### Phase 1 — The Money Keystone *(weeks 1–3)*
**Goal:** One Stripe rail unlocks three owner asks. **Wow: ★★★★★**

- **Features:** real Shop checkout (un-stub `CartDrawer`, free Apple/Google Pay); DB-backed merch + manager CRUD; event deposit/balance collection on PartyProfile; paid/owed chips on Parties + Invoices; tax line + service-charge-vs-gratuity on `computeInvoice`/`buildInvoiceHtml`; **one-tap refunds + dispute inbox (same release)**; digital gift cards; unified Orders/fulfillment ledger.
- **Schema:** add to `parties` (`invoice_number, deposit_amount, amount_paid, balance_due, payment_status, paid_at, deposit_due_date, payment_intent_id`); `merch_products`; `customer_orders` + `order_items`; `gift_cards` + `gift_card_transactions`; `party_payments`. *(All new tables ship with explicit GRANT/RLS per `scripts/new-table-template.sql` — the post-Oct-2026 API-exposure rule.)*
- **Edge functions:** `create-checkout`, `stripe-webhook`, `create-refund`.
- **Effort:** 2–3 weeks. **Wow factor:** the owner watches a real card get charged on Bradley's phone.

### Phase 2 — The Board Report *(weeks 3–6)*
**Goal:** A branded report that composes itself, gets a Luna narrative, and emails the owner every Monday 8am unprompted. **Wow: ★★★★★**

- **Features:** charting/data-viz foundation (phone-first SVG sparklines/trend/waterfall — decided once, reused everywhere); Nightly Close-Out + `daily_sales`; Manager Flash Report (benchmarked KPI strip); **Parties Revenue Dashboard (zero-POS, ships day one)**; Weekly Owner Pack auto-emailed Monday 8am (Luna narrative); vendor-bill AP ledger on the Order Scanner; Luna Morning Money Briefing; weather-adjusted slow-night detection.
- **Schema:** `daily_sales` (architected so a future POS sync drops in without a rebuild); `vendor_bills` (or extend `orders`); optional `reports` archive.
- **Edge functions:** `weekly-owner-pack` (pg_cron → PDF → Gmail via the existing rail); reuse `weather-fetch`.
- **Effort:** 2–3 weeks. **Wow factor:** "wow, it just shows up" — Bradley looks like he has a finance department.

### Phase 3 — The Sales Closer *(weeks 6–9)*
**Goal:** Collapse the gap between "yes" and "paid" with one link. **Wow: ★★★★★**

- **Features:** tokenized no-login portal `/p/:token` (view + itemized `computeInvoice` pricing); e-signature (typed/drawn + timestamp + IP); **"Accept & sign & pay" in one flow**; view/sign/pay activity chips on the pipeline; one-page BEO from the party record; run-of-show timeline (seeded ~80% from presets) + day-of view; merge-field templates; lead-inbox unification (`submit-booking-request` creates party + contact); online-bookable packages + public estimator (**closes ask #1 fully**).
- **Schema:** `proposals`, `contracts`, `beo_documents`, `party_timeline`; `packages.public_description/featured`.
- **Edge functions:** `proposal-view-ping`, `sign-contract`; reuse `create-checkout` + `send-party-email`; extend `submit-booking-request` + `availability`.
- **Effort:** ~3 weeks. **Wow factor:** one link from behind the bar = signed contract + money in.

### Phase 4 — The Daily Cockpit *(weeks 9–12)*
**Goal:** Make the app *run* the shift, not just report on it. **Wow: ★★★★★**

- **Features:** Shift Sessions spine; Opening/Closing checklists with photo proof + audit; Line Check with auto-fail temps + corrective escalation; Shift Log/MOD journal (86 → menu flag); Cash/Till reconciliation (manual-first); **End-of-Night report (Luna-narrated, owner-emailed before he walks out)**; Incident & compliance sub-log; 86/sold-out propagation to the public menu.
- **Schema:** `shift_sessions`; `checklist_templates`/`_items` + `checklist_runs`/`_items`; `line_check_templates`/`_runs`; `shift_log` + `incidents`; `cash_counts`; `eon_reports`. *(Compliance/log tables standardized append-only: server timestamps, RLS insert-only, edits as new rows.)*
- **Edge functions:** `generate-eon`; reuse `weather-fetch` + Storage for photos.
- **Effort:** ~3 weeks. **Wow factor:** the second great board moment — the auto-composed EON.

### Phase 5 — Reach: Social Auto-Publish + Programming Engine *(weeks 12–15)*
**Goal:** Close ask #4; make the events program self-driving. **Wow: ★★★★★**

- **Features:** true multi-platform auto-publish (`social-publish` edge fn: IG/FB/GBP auto, TikTok pull v1); `social_posts` queue + "Post to Social" on Events/happy_hour; per-platform caption editor (Luna-drafted); Content Calendar "Fill my week"; Weekly Programming Planner (Mon–Sun grid); RRULE recurring-event engine; happy-hour live state; link-in-bio `/l/iggys`; approve-before-publish gate + kill switch + retry.
- **Schema:** `social_posts` (per_platform_caption jsonb, target_platforms[], external_post_ids); specials window cols; events recurrence rule + materialized occurrences; optional `social_post_metrics`.
- **Edge functions:** `social-publish` (OAuth tokens, cron-triggered); `specials-sweep`.
- **Effort:** ~3 weeks. **Long pole:** owner-side Meta App Review — **draft/queue layer ships independent of live posting.** **Wow factor:** "posts go out on their own, even when the bar is packed."

### Phase 6 — Reputation, CRM & Marketing Autopilot *(weeks 15–19)*
**Goal:** Turn measurement + re-engagement into the compounding flywheel. **Wow: ★★★★☆**

- **Features:** Reviews data model + Reputation Inbox `/reputation`; `reviews-sync` (GBP ingest + one-tap reply); Luna 3-tone review drafter + ≤3★ alerts; table-side feedback QR (FTC-safe non-gating, per-area); Contacts/CRM front door + dedupe (phone + email) + unified guest graph; frictionless QR/WiFi capture; consent ledger with non-bypassable send-gate; **SMS rail** (`send-sms` + `sms-webhook`); dynamic RFM segments (nightly cron); email+SMS campaign composer; lifecycle automations (welcome/birthday/win-back/post-visit); Luna as marketing brain (draft-and-stage, consent-gated); post-event NPS loop.
- **Schema:** `review_sources` + `reviews` + `feedback`; extend `contacts` (lifecycle fields, split opt-ins, normalized phone + index, source tags); `consent_events`; `segments` + `campaigns`/`scheduled_sends`; `sms_log`; optional `loyalty_*`.
- **Edge functions:** `reviews-sync`, `submit-feedback`, `submit-loyalty-signup`, `send-sms`, `sms-webhook`, `send-campaign`, `marketing-cron`.
- **Effort:** 3–4 weeks. **Wow factor:** every review answered in your voice within the hour; marketing that runs while Bradley tends bar.

### Phase 7 — Reservations, Waitlist & Host Board *(weeks 19–22)*
**Goal:** The host-stand experience on Bradley's phone (rides the Phase 6 SMS rail). **Wow: ★★★★☆**

- **Features:** virtual text-to-join waitlist (QR self-add, two-way SMS HERE/OMW/CANCEL); core reservations model (sections, tables, slots, per-slot capacity); timed online reservations; unified host "tonight" board; walk-in/regular guest CRM (match-or-create by phone); no-show/late-cancel + held-deposit capture; Luna FOH copilot (wait quotes, big-group triage, service-intelligence notes).
- **Schema:** `sections`, `floor_tables`, `reservations`, `waitlist_entries`, `guest_profiles` (or extend contacts); no_show/late_cancel statuses.
- **Edge functions:** reuse `send-sms`/`sms-webhook`, `availability`, `send-party-email`.
- **Effort:** ~3 weeks. **Wow factor:** "on the books tonight: 86 covers / 4 large groups / DJ upstairs at 9."

### Phase 8 — Inventory Depth, COGS Truth & Labor *(weeks 22–26)*
**Goal:** Turn inventory into a profit instrument and stand up the labor gauge. **Wow: ★★★★☆**

- **Features:** vendor catalogs + par-based auto-reorder draft POs; pour/recipe costing inline in MenuManager; COGS% theoretical-vs-actual variance + "biggest leaks"; full stocktake sessions; waste & spillage log; supplier price-change tracking; Menu Profitability Matrix (Stars/Dogs); Owner P&L-lite with benchmark chips; staff roster + wages + **live labor-% gauge**; tip pooling + SB 648 payout calc.
- **Schema:** `vendors` + `vendor_catalog`; `purchase_orders` + `_items`; `recipes` + bottle-yield config; `price_history`; `stocktake_sessions` + `_counts`; `staff`; `tip_pools`; waste fields on `inventory_logs`.
- **Edge functions:** `send-purchase-order`; reuse Order Scanner OCR + the Phase 2 charting layer.
- **Effort:** 3–4 weeks. **Wow factor:** the capstone P&L + the single most owner-impressive labor number.

### Phase 9 — Trust Layer: PWA, Push, Offline & Compliance Vault *(weeks 26–30)*
**Goal:** Make it trustworthy at 1am, not just impressive at 2pm. **Wow: ★★★★☆**

- **Features:** installable PWA + update toast + build-stamp; **web push (VAPID)** triggered by Luna's insights; offline shell + read cache; **offline write queue** for checklist ticks/temps/photos/drawer counts; command palette + global search; gesture/speed layer + FAB radial launcher; Refusal/Cut-Off log + Incident reports + License/Cert tracker (90/60/30/7-day escalations); live temperature wall + HACCP; Compliance Health score + Inspector Mode + Export Pack; `/tv` signage route.
- **Schema:** `push_subscriptions`; `refusal_logs` + `incidents` + `temp_units` + `temperature_logs` + `credentials` (all append-only).
- **Edge functions:** `web-push`; reuse Storage + pg_cron for credential-expiry scans.
- **Effort:** 3–4 weeks. **Wow factor:** the most visceral "this is a real app" moment + the dram-shop/insurer defense binder.

> **Sequencing note:** Phases 5–9 are independently reorderable by what the owner prioritizes in the meeting. If the owner's hottest button is social → pull Phase 5 forward; if it's reviews → Phase 6. The hard dependency chain is only: **Phase 1 (Stripe) → Phase 3 (proposal pay)** and **Phase 6 SMS rail → Phase 7 waitlist.** The PWA/offline shell (Phase 9) should not move *earlier* than the cockpit (Phase 4), because offline write-queueing is most valuable once there are cockpit writes to queue.

---

## 6. New Supabase Tables / Schema Additions (Consolidated)

**Commerce & money:** `merch_products` · `customer_orders` · `order_items` · `gift_cards` · `gift_card_transactions` · `party_payments` · *parties additions* (`invoice_number, deposit_amount, amount_paid, balance_due, payment_status, paid_at, deposit_due_date, payment_intent_id`) · `daily_sales` · `vendor_bills` · optional `event_tickets`.

**Events & bookings:** `proposals` · `contracts` · `beo_documents` · `party_timeline` · *packages additions* (`public_description, featured, display_order`) · *parties additions* (`pipeline_stage`/extended status, `lead_source`).

**Shift cockpit & compliance (append-only):** `shift_sessions` · `checklist_templates` · `checklist_template_items` · `checklist_runs` · `checklist_run_items` · `line_check_templates` · `line_check_runs` · `shift_log` · `incidents` · `cash_counts` · `eon_reports` · `refusal_logs` · `temp_units` · `temperature_logs` · `credentials` · `assets`/`maintenance_schedules`/`work_orders` (Phase 9+).

**Social & programming:** `social_posts` · optional `social_post_metrics` · *specials additions* (`starts_at, expires_at`, daily window) · *events* recurrence-rule + materialized-occurrences model · menu `is_86d` flag · `weather_cache`.

**Reputation, CRM, marketing:** `review_sources` · `reviews` · `feedback` · *contacts additions* (`first_seen, last_visit, visit_count, total_spend, source, normalized_phone`+index, `email_opt_in, sms_opt_in, birthday_month`) · `consent_events` · `segments` · `campaigns` · `scheduled_sends` · `sms_log` · optional `loyalty_programs`/`loyalty_accounts`/`loyalty_events`.

**Reservations & guests:** `sections` · `floor_tables` · `reservations` · `waitlist_entries` · `guest_profiles` (or contacts extension).

**Inventory & labor:** `vendors` · `vendor_catalog` · `purchase_orders` · `purchase_order_items` · `recipes` (+ bottle-yield config) · `price_history` · `stocktake_sessions` · `stocktake_counts` · `staff` · `staff_availability` · `time_off_requests` · `shifts` · `tip_pools`.

**Platform:** `push_subscriptions` · optional `reports` archive.

> **Standing rule for every new table:** ship with explicit `GRANT`/RLS per `manager-app/scripts/new-table-template.sql` (post-Oct-30-2026 auto-exposure rule). Grant the `luna_bridge` role **SELECT only** on data tables, **INSERT/UPDATE only** on `luna_messages` + `luna_insights`. All compliance/log tables: server-defaulted timestamps, RLS insert-only, edits modeled as new rows.

---

## 7. New Edge Functions (Consolidated)

| Function | Purpose | Phase |
|---|---|---|
| `weather-fetch` | Seaside OR forecast/temp/rain/wind/tide, cached daily; reused by Pulse, run-sheet, EON, slow-night. | 0 |
| `generate-sitemap` | Dynamic sitemap.xml from live routes + DB events; pings Google. | 0 |
| `create-checkout` | Shared Stripe rail (merch, deposits, gift cards, tickets, proposal pay); `automatic_payment_methods` + `automatic_tax`. | 1 |
| `stripe-webhook` | Verify signature on `checkout.session.completed`; write orders/payments, flip party `payment_status`. | 1 |
| `create-refund` | Stripe Refunds API; writes refund + reason + issuer. | 1 |
| `weekly-owner-pack` | pg_cron → assemble branded PDF (Luna narrative) → email owner via Gmail rail. | 2 |
| `generate-eon` | On close, assemble `eon_reports`, request Luna narrative, email owner. | 4 |
| `proposal-view-ping` | Serve tokenized portal; stamp `viewed_at`. | 3 |
| `sign-contract` | Capture signature + timestamp + IP; render signed PDF to Storage; advance party. | 3 |
| `social-publish` | Real IG Graph + FB Page + GBP posting; cron-triggered for scheduled posts. | 5 |
| `specials-sweep` | Nightly flip auto-expire; optional last-call story. | 5 |
| `reviews-sync` | GBP review ingest + one-tap reply post (Yelp/TA deep-link). | 6 |
| `submit-feedback` | Public table-side feedback writer (mirrors `submit-contact-message`). | 6 |
| `submit-loyalty-signup` | Public QR/WiFi-portal capture into contacts. | 6 |
| `send-sms` + `sms-webhook` | Twilio send + two-way inbound (HERE/OMW/CANCEL/STOP). | 6 |
| `send-campaign` | Batched email/SMS blast with consent enforcement + STOP/unsub footers. | 6 |
| `marketing-cron` | Nightly segment recompute + fire due birthdays/win-backs/scheduled sends (quiet-hours guard). | 6 |
| `send-purchase-order` | Email the draft PO to the rep (or copy-to-clipboard for text vendors). | 8 |
| `web-push` | VAPID push; the Luna bridge is the trigger source. | 9 |

*Existing & reused (do not rebuild):* `gmail-sync`, `gmail-thread`, `google-calendar`, `manage-users`, `availability`, `send-party-email`, `auto-reply`, `send-reply`, `submit-booking-request`, `submit-contact-message`.

---

## 8. Top 10 Features That Will Blow the Owner Away

1. **Today's Pulse + the morning briefing** — Luna composes a one-line "state of the bar" with a **weather/tide read no Toast or Square has**, pushed before open. *(Phase 0)*
2. **The auto-emailed Weekly Owner Pack** — a branded KPI PDF with a Luna-written narrative that **shows up Monday at 8am without anyone asking.** *(Phase 2)*
3. **One link that views, e-signs, and pays the deposit** — the inquiry-to-paid gap collapses to a single tap from behind the bar. *(Phase 3)*
4. **The End-of-Night report** — one tap composes the whole shift, Luna narrates it, and it's **in the owner's inbox before Bradley walks out.** *(Phase 4)*
5. **Real Stripe checkout** — the owner watches a live card charge on Bradley's phone; **one rail, three asks closed.** *(Phase 1)*
6. **True social auto-publish** — the best-in-category Specials studio now **posts to IG/FB/GBP on its own, even when the bar is packed.** *(Phase 5)*
7. **Luna-drafted review replies in your voice** — every ≤3★ review buzzes the phone with a ready-to-post reply that **already knows it was the sold-out DJ night.** *(Phase 6)*
8. **The live labor-% gauge** — labor cost vs a forecast that **knows the event book** — the number that speaks directly to cost control. *(Phase 8)*
9. **Weather-attributed slow-night detection** — "down −28%, but it's 14°C and raining = weather, not a problem" vs "act on this." *(Phase 2)*
10. **Marketing autopilot via Luna** — birthday/win-back/post-event flows that **run while Bradley tends bar**, consent-gated, the $300/mo competitor feature delivered free through the bridge. *(Phase 6)*

> The throughline to pitch: *every one of these is "AI that thinks about your bar" — and we already own the agent. Competitors charge hundreds a month for slices of it; we get the whole thing because Luna reads the bar's own cross-table data with memory.*

---

## 9. Risks, Dependencies & Decisions for the Owner

### Decisions Bradley must get in the meeting
1. **Backend go-ahead:** OK to add Supabase Edge Functions? *(One "yes" unlocks asks #2, #3, #4 — this is the master gate.)*
2. **Stripe account:** Is the Stripe account live and verified? Who is the legal account owner? **Which states is Iggy's registered to collect tax in** (for shipped merch)? *(Oregon storefront/pickup = $0, correctly; out-of-state shipping needs registration.)*
3. **Deposit & no-show policy:** Flat (e.g. $200) vs % (e.g. 25–50%)? Prepay-now vs manual-capture auth hold? Cancellation window? *(Luna and the proposal flow need the rule.)*
4. **Social:** Is the Instagram a **Business** account linked to a **Facebook Page**? Approval to **start Meta App Review now** (the long pole)? Is the current manual share acceptable as the interim fallback?
5. **Calendar:** Who is the sync *for* — customers subscribing or staff coordinating — and which direction(s): subscribe / pull / push?
6. **Packages:** Which 3–6 packages go public, and at what `public_description`/price? Display-only first, or bookable immediately?
7. **Merch fulfillment:** Pickup-only or shipping? Who packs and ships? Who handles refunds over a threshold?
8. **SMS:** Approval to register an **A2P 10DLC** brand/campaign (carrier prerequisite for the waitlist + marketing SMS) and budget for Twilio per-message cost.
9. **Gift cards:** Approve the outstanding-liability model (pre-paid float is a balance-sheet item the owner should sign off on).

### Key risks & mitigations
- **Meta App Review (Phase 5)** is approval-gated and can take weeks → *ship the draft/queue layer independent of live posting; start the paperwork in Phase 0.*
- **GBP API access (Phase 6)** approval is the long pole for reviews → *Yelp/TA via deep-link fallback; GBP ingest only once approved.*
- **Stripe Tax / registration** is a legal step, not a code step → *get registered-states list from the owner; enable `automatic_tax` once confirmed.*
- **Solo-builder bandwidth** → *every phase is independently shippable and demoable; no phase blocks revenue on infra that doesn't exist (manual "expected" seams everywhere a POS would later slot in).*
- **FTC review-gating exposure** → *the table-side feedback form is non-gating by design — every guest sees both the public-review button and the private box; Luna is hard-blocked from routing by sentiment.*
- **TCPA/consent exposure** → *the consent ledger gate is non-bypassable at the send layer; even a Luna-staged campaign hits it.*
- **Compliance data integrity** → *all log tables are append-only (server timestamps, RLS insert-only, edits as new rows) so the dram-shop/incident vault holds up for a lawyer or insurer.*
- **Luna over-alarming** → *"silence is a feature" is in the system prompt; alerts are idempotent and weather-attributed; a briefing ends with exactly one "needs your call" flag.*

### Dependency chain (the only hard ordering)
**Knowledge Pack (P0) → all smart Luna features** · **Stripe rail (P1) → proposal pay (P3), gift cards, tickets** · **`daily_sales` (P2) → flash report, P&L, forecast** · **Shift Sessions spine (P4) → checklists/line-check/cash/EON** · **SMS rail (P6) → waitlist (P7), marketing sends** · **PWA shell (P9) ⟂ cockpit (P4)** — offline write-queue is only worth building after there are cockpit writes to queue.

---

*Files referenced (all absolute): app root `/Users/bradleybird/code_projects/Iggys`; manager app `/Users/bradleybird/code_projects/Iggys/manager-app`; invoice engine `/Users/bradleybird/code_projects/Iggys/manager-app/src/utils/invoice.ts` (`computeInvoice`, `buildInvoiceHtml`); Luna types `/Users/bradleybird/code_projects/Iggys/manager-app/src/types/index.ts` (`LUNA_INSIGHT_KINDS` line 682, `luna_insights.data` JSONB line 699); existing edge functions `/Users/bradleybird/code_projects/Iggys/manager-app/supabase/functions/`; new-table GRANT template `/Users/bradleybird/code_projects/Iggys/manager-app/scripts/new-table-template.sql`; owner-meeting notes `/Users/bradleybird/code_projects/Iggys/meeting-ideas.md`.*