I have everything I need to synthesize this. The research is rich and consistent across all eight digests — I'll write the brief directly.

# Iggy's Booking Flow — Decision-Ready Brief

## 1. The big idea

The estimator-to-booking flow should feel like **one continuous conversation, not two forms stacked on top of each other**. By the time a visitor reaches the bottom of the estimator, they've already built "their party" — guests, hours, packages, a live price they own. The form's job is to make that work feel *kept, not wasted*: tapping one warm button ("Happy with the price? Let's set a date") should slide them into a short, pre-filled form where the only genuinely new ask is a date and how to reach you. The whole thing should read as *confirm-and-finish*, never *start-over*.

## 2. Top 10 changes, ranked (best-first)

| # | Change | Impact | Effort | Where |
|---|--------|--------|--------|-------|
| 1 | **Lift estimator state up** — move `selected`/`guests`/`hours` out of `PackageEstimator.tsx` local state into `BookEvent.tsx` (or a shared hook/context) so there's ONE source of truth. Prerequisite for everything else. | 5 | M | `PackageEstimator.tsx` → controlled props; `BookEvent.tsx` owns state (lines ~31–42, 159–161) |
| 2 | **Add the bridge CTA** at the bottom of the estimate card: "Happy with the price? Let's set a date →". On tap: pre-fill `guest_count`, `selectedPkgs`, hours + estimate; smooth-scroll to the form. The thing Bradley asked for, single highest ROI. | 5 | M (S once #1 done) | Bottom of "Your estimate" card in `PackageEstimator.tsx`; handler in `BookEvent.tsx` |
| 3 | **Remove the duplicate "Add packages" grid** from the form (lines ~397–425) — the estimator already IS the package picker. Replace with an editable summary. Kills the most jarring redundancy. | 4 | S | `BookEvent.tsx` packages block |
| 4 | **Editable "Your selections" summary chip-row** at the top of the form: `30 guests · 3 hrs · Taco Bar, Open Bar · ~$1,240+ · Edit`. Makes the pre-fill visible; reframes re-entry as confirmation. | 4 | S | Top of `<form>`, above "About you" (~line 196) |
| 5 | **Capture + send `hours` and the estimate.** Today hours and the computed price evaporate on submit — staff get a lead with no idea what number the guest saw. Add `hours`, `estimate_total`, `estimate_unpriced_count` to the `submit-booking-request` payload. | 4 | S | `BookEvent.tsx` form state + `handleSubmit` payload (~lines 122–142) + edge fn/DB |
| 6 | **Add `autocomplete` attributes** to all four contact inputs (`name`, `email`, `tel`, `organization`) — currently missing, which silently kills native mobile autofill. Pure attribute additions. | 4 | S | `BookEvent.tsx` contact inputs (~lines 202, 206, 210, 214) |
| 7 | **Collapse optional details** (occasion chips, notes, preferred time) behind one "Add details (optional)" toggle, so the default form is just contact + date + request. | 3 | S | `BookEvent.tsx` "About your event" + "Notes" sections |
| 8 | **Continuity copy on the submit button + confirmation** — "Send my request — 30 guests, ~$X" and a confirmation that restates date/guests/price. Reinforces that the inquiry equals the thing they priced. | 3 | S | Submit button (~442) + `done` block (~152–168) |
| 9 | **Sticky mobile CTA bar** — once an estimate exists, pin a slim bottom bar (`From $X+` · "Request this date") so the action is always one tap away on the long scroll. Mobile-only. | 3 | M | New fixed-bottom element in `BookEvent.tsx`, `sm:` breakpoints |
| 10 | **Lightweight funnel: 4 events + Clarity.** `estimator_engaged` → `estimator_cta_clicked` → `form_started` → submitted. One owned `funnel_events` table + `track-event` edge fn modeled on the existing `submit-feedback`. | 2 | M | New edge fn + `src/lib/track.ts`; fire points in both components |

## 3. The estimator-to-form bridge — implementation spec

**The button.** Render at the bottom of the live-estimate card, only when `hasSelection` (an estimate exists).
- Priced: **"Happy with the price? Let's set a date →"** (optionally embed the number: "Happy with $1,240? Let's set a date →")
- All-custom / on-request: **"Sounds good — let's talk dates →"**
- Subline directly under it: *"Takes about 2 minutes — just a date and how to reach you. No deposit, no commitment."*

**State that carries over (1:1, no mapping needed — same `packages` table, same numeric IDs):**

| From estimator | → To form | Field |
|---|---|---|
| `selected: Set<number>` | `setSelectedPkgs(new Set(estimatorSelected))` | package selection |
| `guests: number` | `form.guest_count = String(guests)` | guest count |
| `hours: number` | `form.hours = hours` | **new field** (currently dropped) |
| `estimate.grandTotal` + unpriced count | `estimate_total`, `estimate_unpriced_count` | carried for display + payload |

**How the form reflects it.** At the top of the form, above "About you", render the editable summary block from §2.4:

> **Your event so far** — `~30 guests · 3 hrs · Taco Bar, Open Bar · starting from $1,240+` · **Edit**
> *We kept your selections — just add a date and your contact info.*

Guests and packages are editable **in place** (chips toggle, guest count is a single pre-filled number field). "Edit" scrolls back to the estimator; because state is shared, nothing is lost either direction. Never read-only — pre-fill must always mean editable-on-confirm.

**The scroll/transition.** On tap, `scrollIntoView({ behavior: 'smooth' })` to the **form heading** (not into a field — don't pop the keyboard over content). Do **not** auto-focus the date picker aggressively on mobile; land on the heading and let the user tap in. Flash a one-line confirmation toast/inline note: *"Carried over: 30 guests · 3 hrs · 2 packages · ~$1,240 — tweak anything below."* No modal, no viewport hijack, no auto-submit.

**Prefilled + editable fields after the bridge:**
- ✅ Pre-filled & editable: guest count, packages, hours
- ⬜ Empty by design (must be answered, accuracy matters): **event date**, **email or phone**, **name**
- The estimate rides along as a visible anchor chip; it is display-only context, not an input.

**Reassurance microcopy** (see §5 Copy kit for exact strings) sits at the bridge, at the summary, and at submit — same voice all three times so it reads as one trustworthy promise, not three hedges.

## 4. Form redesign — short and non-redundant

**Chunking (visual, not multi-step).** Keep the single scrollable page; group into three glass-cards: **Your selections** (carried, editable summary) → **About you** (name + email/phone) → **Your date** (calendar + optional time). The estimator *is* the felt "first step" — no wizard, no router, no progress bar.

**The required core is three fields:** name + (email OR phone) + date. That already matches `canSubmit`. Everything else is pre-filled or optional.

**Progressive disclosure.** Collapse occasion chips, notes, and (general-mode) preferred time behind one **"Add details (optional)"** toggle that expands in place. Default visible form = contact + date + request button.

**Smart defaults.** Carry guests/hours/packages from the estimator (their own choices only — never pre-check upsells). Leave date and contact **empty** — a sticky-wrong default there produces bad bookings.

**Mobile input types** (mostly already right — add the missing layer):
- `name` → `type="text" autoComplete="name" autoCapitalize="words"`
- `email` → `type="email" inputMode="email" autoComplete="email" autoCapitalize="off" autoCorrect="off"`
- `phone` → `type="tel" inputMode="tel" autoComplete="tel"` — **accept any format, normalize server-side** (don't reject formatting; 89% ignore format hints)
- guests → carry the stepper value; don't force a retype
- **Keep the custom `AvailabilityCalendar`** — it shows real taken/busy days a native picker can't. 44px cells, leave it alone.

**Optional/required clarity.** Append "(optional)" text to every non-required label; add one helper near the top: *"Only your name, a date, and an email or phone are required — everything else is optional."*

**Recap before submit.** Just above the button, a read-only "Your event so far" recap (date · guests · hours · package names · from $X) + the "almost done" cue. Adds zero new fields, confirms the configured event at the moment of commitment.

**Resilience.** Persist form + estimator state to `sessionStorage` on change, rehydrate on mount, clear on successful submit — protects a half-filled inquiry from a mis-tap. No accounts, no email-to-resume gate.

## 5. Copy kit (ready to paste)

**Bridge button**
- Priced: `Happy with the price? Let's set a date →` (or `Happy with $1,240? Let's set a date →`)
- Custom/on-request: `Sounds good — let's talk dates →`
- Secondary path (for estimator-skippers): `Just send an inquiry`

**Bridge subline**
`Takes about 2 minutes — just a date and how to reach you. No deposit, no commitment.`

**Carried-over confirmation (toast/inline)**
`Carried over: 30 guests · 3 hrs · 2 packages · ~$1,240. Tweak anything below.`

**Summary block header + reassurance**
`Your event so far` · `We kept your selections — just add a date and your contact info.`

**Section headers**
`Your selections` · `About you` · `Your date` · `Add details (optional)`

**Contact "why we ask"**
`We use this only to send your quote and confirm details — never shared, never spammed.`
Phone field note: `Optional — handy if you'd rather we text.`

**Required helper**
`Only your name, a date, and an email or phone are required — everything else is optional.`

**Almost-done cue (above submit)**
`That's everything — tap below and a real person will reply within a day.`

**Submit button**
- Default: `Send my request →`
- With date + estimate: `Send my request — Sat, June 21 · ~$1,240 →`
- In-flight: `Sending…`

**Submit reassurance line**
`No deposit, no commitment — a real person from Iggy's (not a bot) will email or text you within one business day.`

**Post-submit confirmation**
`You're on our radar! We've got your request for [date] — ~30 guests, 3 hours, starting around $1,240. A real person will email or text you within one business day to confirm the final quote. Questions in the meantime? Call us at [phone].`
(Onward ramp, optional: "Add to your calendar" · "See our menu".)

## 6. Measure — events + funnel

Four fire-and-forget events into an owned `funnel_events` table (id, event, session_id, props jsonb, created_at) via a `track-event` edge function modeled on the existing `submit-feedback`. Per-page-load `session_id` in `sessionStorage`. Never block submit on a tracking call.

1. **`estimator_engaged`** — first package toggle or stepper move (one-shot ref). Top of funnel.
2. **`estimator_cta_clicked`** — bridge button tap; props `{guests, hours, packageIds, estimateTotal, unpriced}`. The key estimator→form boundary.
3. **`form_started`** — first focus/change on any "About you" field (one-shot ref).
4. **Submitted** — the existing `parties` insert (`source:'website'`) already is stage 4; optionally mirror a `form_submitted` event so all four live in one table.

**The funnel (one dashboard card):**
`estimator_engaged → estimator_cta_clicked → form_started → submitted`

**Three numbers that matter:**
- **Estimator → submit rate** (headline)
- **Form-start → submit rate** (the redundancy/friction signal — should jump after this ships)
- **Submissions / week** (business outcome)

Bolt on **Microsoft Clarity** (one script tag) for free mobile heatmaps + session replay — **mask the contact fields**, IP anonymization on. Watch ~15 mobile replays right after launch for friction the numbers can't explain. No PostHog/Amplitude, no A/B infra — traffic doesn't support it.

## 7. Don't (dark patterns / overkill for one bar)

- **No multi-step wizard / "Step 2 of 4" / progress bar.** The required core is ~3 fields; the estimator is already the felt first step. A wizard adds state-machine bugs, back-button edge cases, and hides the date picker.
- **No fake progress** ("15% complete" on first click). Endowed progress here = showing what they actually picked, not a fabricated bar.
- **No gating the estimate behind an email** ("enter your email to see your price"). The open, instant ballpark is the page's best asset and the whole engine of intent.
- **No fake urgency/scarcity** — no countdowns, "3 dates left", "price expires in 10:00", "X people viewing". Real availability (`taken`/`busyDays`) is the only honest urgency lever.
- **No read-only / locked carried fields.** Pre-fill must always be one tap to change, or it's a trap.
- **No pre-checked upsells** to inflate the estimate (sneak-into-basket). Carry only what they chose; default is zero packages, build up.
- **No phone-required**, no second contact field, no address/budget/"how did you hear" up front. Keep the email-OR-phone rule. Carrying state should *reduce* the ask, not license new fields.
- **No upsell/cross-sell inside the form** ("also add bottle service?") — measured ~11% abandonment cause and off-brand.
- **No exit-intent popups, modals, or aggressive auto-scroll/keyboard-hijack** on mobile — pushy for a friendly local venue and Google penalizes intrusive mobile interstitials.
- **No auto-submit / silent lead capture / pre-checked marketing opt-in** on the bridge tap. Scroll and pre-fill; let the human review and submit deliberately — the estimator promised "no commitment."
- **No trust-badge theater** (SSL seals, "Norton Secured") and **no confetti spam** on every tap. One celebratory flourish on the success screen, `prefers-reduced-motion` respected, is plenty.