# Anton Mode — Friction & Delight Roadmap (2026-06-15)

From a 100-agent "office" (50 on minimal-friction flow/design grounded in the real
screens + 50 on new ideas/angles, then digest → synthesis). 97 agents returned,
**894 findings → 206 strong → this roadmap.**

## The through-line
**"Iggy's already does everything; it just doesn't feel made for anyone yet."**
Fuse three things the app already has but never combines: the **live bar state**, the
**logged-in person** (PIN/RBAC knows who they are), and the **sky outside** (weather/
tides/sunset). Then make every screen open to the **one thing that person needs to act
on right now.** Win staff with friction kills; win the owner with peace-of-mind pushes
and a self-correcting forecast; earn the "wow" with seaside-native loops no chain can build.

## FRICTION KILLS (ship-soon, mostly S/M, high impact — all verified in code)
1. **Purge dev language + auto-start the Service checklists.** The most-opened staff screen literally says "run the add-checklists migration" and forces a "Start" tap before any checkbox shows. `seedDefaults` exists — auto-seed + auto-start. (S)
2. **Greet by name + role-aware Dashboard.** PIN login knows the person + RBAC shipped, yet AuthContext stores only the raw user and Dashboard has ZERO `useRole`/`can()` usage — owner and manager see an identical party-CRM wall. Add `profile.firstName`, greet by name, lead each role with what it can act on. (S)
3. **Auto-fill cash close-out** from float + POS (show the math, tap to override); force a note on large variance that jumps to the owner's report. `expectedDollars` is typed blind today. (S)
4. **Name the blocking checklist item** with tap-to-scroll (`photoBlockers` exists) instead of a greyed-out "check every item" scavenger hunt. (S)
5. **Undo toast on every destructive/bulk action.** `useSupabaseCRUD.remove()` already does optimistic + 5s undo + offline outbox, but only ~2-3 hooks use it; ~20 others do raw `delete().eq`. One `useUndoableDelete` + ~20 swaps. (M)
6. **Stop realtime ticks from blanking lists.** ~24 hooks call `setLoading(true)` at the top of `refresh()` which IS the realtime handler → every teammate edit strobes lists to skeletons + loses scroll. `useMessages` already does it right. (S)
7. **Remember last user on this device** → skip the name picker (straight to PIN pad + "Not you?"); surface `attempts_left`/lockout (pin-login returns it; Login never shows it). (S)
8. **One-tap 86** from a pinned "most-86'd" row + voice/chip capture (wet hands all night). Today it's a 3-4 tap modal with the Reason field above the item list. (M)
9. **Couple pipeline stage moves + invoice-sent to the actual message.** Advancing new→proposal stamps `last_contacted` but sends nothing; "Email invoice" never stamps sent, "Mark sent" never emails — the board lies about money. (M)
10. **Messages/Parties: auto-advance after send + inline call/text/email** (`tel:`/`sms:`/`mailto:` appear nowhere in the party flow). (M)
11. **Per-row Duplicate / "Run it again"** on Events + Specials (80% are reruns; both are Edit/Delete only). (S)

## QUICK WINS (near-zero effort)
Weather+time-aware greeting (useWeather already loaded); visible mobile entry for the command palette (Cmd+K-only today); search box on Menu manager; color-blind-safe busy-level (icon+word+texture, not just R/A/G); `<datalist>` autocomplete on "same-as-last-time" fields; inquiry-age pills on pipeline cards; role+time-aware landing (kills the double-redirect); Specials lifecycle sort + Live/Scheduled/Expired filter; Inventory-count Enter-to-commit + "Match" tap; party-size tap-chips on Waitlist; "Count Stock" button + deep link; a close/open CompletionBurst (haptic + spark + "$X in, Y covers").

## BIG BETS (dedicated builds)
- **Make Dooger's a first-class entity** (it's in ONE templates file) → unlocks catering/COGS/allergen/specials; then a two-house realtime nervous system.
- **Pre-Shift Brief + a forecaster that learns from its actuals** — `demand_log` persists predicted-vs-actual nightly and NOTHING reads it back; feed ~60 nights as a calibration loop.
- **Activate Web Push + nightly close-of-business digest** — the whole push stack (sw.js, push_subscriptions, web-push fn, usePushSubscription, Team toggle) is built and DORMANT; finish VAPID + a trigger so the owner never has to open the app.
- **Demand-aware everything + Coastal Clock** (tides/sunset) feeding par, labor, purchasing — today labor/par multiply a static hardcoded weekday array by a manual slider.
- **The Tide Club / locals loyalty backbone** — phone-first, no app to download; auto-accrues from waitlist + close-out; a regular's ~$685 LTV vs ~$26 one-timer. MarketingContact already carries visit_count/total_spend/birthday_month.
- **Finish gift-cards + storefront + experiences** revenue loop (types exist, create-checkout can't sell one, /shop is hardcoded).
- **Convention + cruise + festival "Town Radar"** → auto-pitched leads + staffing (fetch_conventions already reads the feed; Astoria cruise calls of 2-3.6k pax on published dates).

## WILDCARDS (the "wow" / desire-creating)
- **The Daily Secret** — render Luna's daily creative special to a public `/today` poster; the "Why" fun-fact is a secret password for a discount.
- **Name-the-Special viral loop** — weekly public vote on the name; winner drinks it free + goes on the chalkboard.
- **Public Sunset Index / `/tonight`** — sanitized 0-100 "how alive is Iggy's tonight" widget.
- **The Tonight Engine** — on a high band, Luna bundles 4-5 one-tap actions (special + social post + staffing todo + happy-hour tweak + heat-escape SMS).
- **Heat-Escape Geo-Blast** — the day Portland bakes, one-tap consent-gated blast to locals (compute_pulse already fetches the PDX high and throws it away).
- **Luna remembers what HAPPENED** — a `luna_episodes` table + a `run_recap()` at close so future pulses cite real past nights.
- **"Hey Iggy" voice** manager input — voice queries, voice 86, voice shift-log.

## Recurring themes (the design philosophy)
Made-for-the-person-holding-the-phone · Status must never lie · One mis-tap behind a wet
bar should never be unrecoverable · Seaside-native signals are the moat · Capture-at-
point-of-contact, kill double-entry · Luna as coworker not feature · Peace of mind for the
absent owner · Off-season survival is locals + recognition · Make the emotional beats feel
made-for-you.

Full raw output: the office workflow transcript (894 findings). Built via roundtable + a
108-agent Workflow with two wildcard cohorts.
