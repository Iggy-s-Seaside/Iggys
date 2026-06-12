# Iggy's — Website + Dashboard Additions (Owner Meeting)

_Prepared 2026-05-28 · branch: `v2-react` (production)_

## TL;DR
3 of the 4 requests are **already partly built**. And 3 of the 4 need a small **server layer we don't have yet** (Stripe checkout, true calendar sync, social auto-posting). The one big decision that unlocks everything: **do we add a thin backend (Supabase Edge Functions)?** Yes → all three are doable. No → we're limited to the manual / fast-path versions.

---

## 1. Group packages listed — NET-NEW (easy if "listed" = display)
- Nothing exists today (no package / party / booking data or UI).
- **Decision for owner:** just *show* the packages, or also *book / inquire* online? Listing ≈ 1–2 days; booking is a much bigger feature.
- Needs a new `group_packages` table — grant/RLS template already added at `manager-app/scripts/new-table-template.sql`.

## 2. Online calendar sync — PARTIAL, and ambiguous
- Exists: `manager-app/src/utils/calendarSync.ts` makes "add to *your* calendar" links + `.ics` for a single event. That's not real "sync."
- **Decision for owner — which do they actually mean?**
  - **Subscribe feed** — one always-updated calendar of all events. *Fast path: publish a Google Calendar and embed it (near-zero build).*
  - **Pull** — owner edits in Google Calendar, site auto-shows it.
  - **Push** — dashboard events publish out to a public Google Calendar.

## 3. Online sales: merch / packages — MOSTLY BUILT, blocked on payments
- Built: Shop page, cart, `CartDrawer`, products in `src/data/merch.ts`; `@stripe/stripe-js` already installed.
- **Blocker:** checkout is a stub — `CartDrawer.tsx` does `alert('Stripe checkout coming soon!')`. Real Stripe needs a server (the secret key can't live in the browser).
  - **Fast path (days):** Stripe Payment Links, or hosted Checkout via one Supabase Edge Function.
- **Decisions for owner:** Is the Stripe account ready? Ship merch or pickup-only? Who fulfills orders? Sell the group packages here too?

## 4. Auto-posting social media — DESIGNER BUILT, true auto-post is the big lift
- Built: a full canvas post designer (`manager-app/src/pages/SpecialEditor.tsx`) with a "Share to Instagram" toggle — but it opens the phone's **share sheet (manual)**, it does not auto-publish.
- True scheduled auto-posting needs: an Instagram **Business** account + linked Facebook Page + **Meta app review** + a server/scheduler. This is the heaviest of the four.
- **Decision for owner:** Is the IG a Business account? Is the current one-tap manual share good enough, or do we want scheduled hands-off posting?

---

## Cross-cutting
- **Backend:** items 2, 3, and 4 all need a thin serverless layer. Cleanest fit = **Supabase Edge Functions** (we're already on Supabase). One "yes" unlocks all three.
- **Supabase change (NOT urgent, just a heads-up):** after Oct 30, 2026, brand-new tables in `public` won't auto-expose to the API — so the new packages/merch tables must ship with explicit GRANTs (template added). The existing site is unaffected; nothing breaks now.

## Suggested sequencing
1. **Group packages — listing** (quick win, low risk)
2. **Merch online sales** via Stripe Payment Links (revenue, mostly built)
3. **Calendar** — embed a public Google Calendar (cheap)
4. **Auto-posting** (biggest lift; needs Meta approval — start that process early if they want it)

## Questions to bring to the owner
- **Packages:** display-only, or bookable online?
- **Calendar:** who is it for (customers subscribing vs. staff), and which direction (pull / push / subscribe)?
- **Merch:** Stripe account ready? Shipping vs. pickup? Who fulfills?
- **Social:** Is the IG a Business account? Scheduled auto-post, or keep the current manual share?
- **Backend:** OK to add Supabase Edge Functions to enable checkout / calendar / posting?
