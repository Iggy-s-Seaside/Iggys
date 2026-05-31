# Iggy's Events — Streamline & Hand‑Hold Plan (Phase 2)

> Goal: make the events system the **only place** the owner needs to go, so effortless a non‑technical person can run it one‑handed, mid‑conversation, on a phone. Built mobile‑first, with notifications, a single communication hub, and a public front door — and architected so a "Luna" automation/learning layer can plug in later.

## North star
**Minimize what he must do and decide on any one screen.** Every design choice below serves that. Visibility over navigation: he should *see* what needs attention, never hunt for it.

---

## Design principles (evidence‑based — from the deep‑research pass)
These are verified, sourced findings we'll hold ourselves to:

- **Fewer fields beats fewer steps.** Field count drives abandonment more than step count; introduce fields only as the user progresses (progressive disclosure, "one thing per screen"). — [NN/g](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/), [Baymard](https://baymard.com/research/checkout-usability)
- **Big, forgiving touch targets.** 1cm minimum; **44–48px is the practical target** for an older audience (24px is only the WCAG floor). — [NN/g](https://www.nngroup.com/articles/touch-target-size/), [USWDS](https://designsystem.digital.gov/components/date-picker/accessibility-tests/)
- **Permanent labels above every field — never placeholder‑only.** Placeholders vanish on typing and wreck error recovery. — [Baymard](https://baymard.com/blog/mobile-forms-avoid-inline-labels)
- **Teaching empty states, never blank screens.** Every empty list says what it's for + the one next action ("No requests yet — share your booking link"). — [NN/g](https://www.nngroup.com/articles/empty-state-interface-design/)
- **Just‑in‑time "pull" help, not front‑loaded tours.** Tutorials don't improve task success; show help at the moment of need, beside each step. — [NN/g](https://www.nngroup.com/articles/onboarding-tutorials/)
- **A unified inbox feels unified when context sits *beside* the conversation** (event history, party status, deposit, totals) — not on a separate screen. — [Intercom](https://www.intercom.com/blog/shared-inbox)
- **Slot picker = clear available/unavailable hierarchy.** Best‑performing booking pattern, and it doubles as the privacy guarantee (showing free/taken reveals nothing about *who*). Use an accessible, keyboard‑operable date picker. — [Baymard](https://baymard.com/ecommerce-design-examples/time-booking-interface), [USWDS](https://designsystem.digital.gov/components/date-picker/accessibility-tests/)
- **iOS push reality:** web push needs the app **added to the Home Screen** + an explicit tap to opt in (no auto‑prompt, no in‑tab push). No Apple Developer account needed (standard VAPID). — [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

---

## Intake & source of truth (refined 2026‑05‑31)
- **The database is the system of record — the Google Calendar is just a downstream mirror.** The calendar is written only when an event is **confirmed**, can be toggled off per event, and is never the place tentative bookings live. This keeps the owner in control and removes the "calendar is the only/fragile place to edit" problem.
- **Tentative = the "Requests" holding area.** Inquiries live in the Parties list, fully searchable, **off the calendar**, until the owner decides. Nothing tentative ever touches Google Calendar or the public availability view.
- **The public form is the *primary* intake.** It POSTs structured data straight into the database via a small public edge function (`submit-booking-request`): find‑or‑create the contact, create an `inquiry` party (with package/deal selections + details), notify the owner. No Gmail parsing — clean, listable, searchable data from the first second. (RLS stays closed; the function inserts with the service role.)
- **Email / phone / in‑person stay as secondary, manual paths.** An inbound email becomes a party in one tap; phone/handshake deals get logged via Quick‑Add. Once a conversation starts, email happens **from inside the party profile**, so the request, the person, and the chat all live in one place.
- **Same‑date conflicts are expected and surfaced, not blocked.** Multiple tentative requests for one date are allowed and shown together, ordered by **who asked first**; the owner confirms one at their discretion. Confirming warns if the date already holds a confirmed event. Only a **confirmed** event marks a date "taken" on the public availability view — tentatives never leak or block publicly.
- Add a `source` field to parties (`website` / `email` / `phone` / `in_person`) so we can see where bookings come from.

## Phased roadmap (quick wins → bigger bets)

### Phase 1 — Make the cockpit effortless *(quick wins, no new infrastructure)*
The biggest felt improvement, lowest risk.
- **Mobile‑first shell:** bottom tab bar with thumb‑reachable primary actions; 44–48px targets; bigger type; a persistent **"＋ Quick Add"** button on every screen.
- **Quick‑Add capture:** one screen, two fields — *name + date* → Save. Everything else is enriched later from the profile. Never blocks him on a call.
- **Smart templates & defaults:** pick a party type ("Birthday upstairs," "Corporate," "Celebration of life") and the profile pre‑fills space, room rate/hours, gratuity, and a package preset — he only edits what's different.
- **"Today / This week" home:** today's events, follow‑ups due, new inquiries — surfaced, not searched.
- **Teaching empty states + labels‑above + inline validation** across Parties, Calendar, To‑Do, Invoices.

### Phase 2 — Never miss it *(notifications, reminders, digest)*
- **Make it an installable PWA** (manifest + service worker) with a friendly **"Add to Home Screen"** coaching step — required for iOS push.
- **Push notifications** (VAPID web push via a new edge function): new inquiry, follow‑up due, event today/tomorrow. Opt‑in via a "Turn on alerts" tap *after* he's seen value (not on first load).
- **Daily email digest** ("Here's your day") reusing the existing Gmail sender — a reliable backstop he already trusts.
- **Reminder engine:** `follow_up_date` + event lead‑times → scheduled checks (Supabase `pg_cron` + edge function).

### Phase 3 — One inbox *(unified communication)*
- **Per‑contact timeline:** every touchpoint (emails, texts, call notes, DMs) in one chronological thread, with the **context panel beside it** (event history, status, deposit, total spend).
- **Start with what we have:** Gmail in/out already works → add fast **"Log a call"** notes (what was said + outcome + next step).
- **SMS via Twilio** (two‑way): customer texts land in the same timeline; he replies from the app.
- **Instagram / Facebook DMs:** Meta API — hardest and most limited; last/optional.
- **Identity matching:** link incoming messages to a contact by email/phone.
- *Design flag:* research didn't confirm a single "right" way to merge channels into one timeline — we'll model a normalized `messages`/timeline table keyed to a contact and iterate.

### Phase 4 — The public front door *(the website)*
- **Booking‑request form (primary intake):** minimal first (name, date, headcount, contact), progressive disclosure for the rest; **package/deal pickers that pre‑answer the common questions.** Submissions POST to the `submit-booking-request` edge function → land in the Parties pipeline as **tentative inquiries** (the DB, not email, is the source of truth) + ping the owner.
- **⚠️ Privacy‑safe availability (explicitly requested):** the public calendar shows each date/slot as **available or taken (grayed out) with NO names or event details** — same visual‑hierarchy pattern that tests best *and* satisfies privacy. Reads from the same Supabase availability the manager app writes.
- **Packages/deals showcase + local SEO** (Google Business Profile, reviews, local schema, NAP) so Iggy's is "the first thing people see."

---

## Luna seam (future‑proofing, build *nothing* now)
Leave a clean boundary so a Luna harness can later read the full picture and lighten the load:
- An **activity/event log** (every inquiry, message, status change, outcome) as the substrate Luna can learn from.
- A thin **"assistant actions" service interface** (draft a reply, suggest a follow‑up, pre‑fill a profile, flag a hot lead) — all actions **logged and reversible**.
- Keep data normalized and outcome‑labeled (won/lost/spend) so "what converts at Iggy's" is learnable later.

## Honest gaps to validate (don't over‑invest on faith)
Research could **not** confirm these — treat as hypotheses and measure: exact omnichannel‑merge mechanics; ideal reminder cadence / fatigue thresholds; local‑SEO and packaged‑deal conversion lift; conversion impact of privacy‑masked availability specifically for venues. Also: re‑verify iOS push behavior at build time (fast‑moving).

## Accessibility & trust (throughout)
44–48px targets, keyboard‑operable pickers, labels above fields, strong contrast; the availability view leaks nothing about who booked.

---

## Recommended starting point
**Phase 1.** It's the biggest day‑one difference for the owner, needs no new services or cost, and de‑risks everything after it. Then Phase 2 (push + reminders) so it becomes the place he can't miss.
