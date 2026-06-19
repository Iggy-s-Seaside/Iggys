# Iggy's — Google Ads Plan (Seaside, OR)

A practical, opinionated starting plan for a single seaside bar + restaurant with private-event spaces. Built to drive the two things that actually make money: **private-event bookings** (high value) and **foot traffic / covers** (volume). Designed to plug into the conversion tracking the app already emits.

> The single highest-ROI free move first: make sure the **Google Business Profile** is claimed, complete, with photos, hours, menu link, and the "Book/Inquire" action pointing at iggysseaside.com/book. Most "near me" intent is captured by the free Map pack, not ads. Do this before spending a dollar.

---

## 1. Account structure (keep it simple)
Three campaigns, each with a clear job:

| Campaign | Type | Job | Starting budget |
|---|---|---|---|
| **Private Events – Search** | Search | Capture high-intent "venue / private party / rehearsal dinner Seaside" queries | $15–25/day |
| **Brand + Discovery – Search** | Search | Own your own name + "bars/restaurants in Seaside" | $5–10/day |
| **Performance Max – Local** | PMax (or a Local-focused Search + Maps) | Drive visits/covers from the broader coastal travel audience | $10–15/day |

Start with **Private Events – Search only** for the first 2–3 weeks (highest ROI, easiest to measure), then add the others once a conversion is firing.

---

## 2. Geo + schedule
- **Radius:** Seaside core + a wider ring for the events campaign. Private-event shoppers travel — target **Seaside, Astoria, Cannon Beach, Gearhart, Warrenton + a 40-mi radius**, and add **Portland metro** for the events campaign only (people book coastal venues from the city). Foot-traffic campaign stays tight (~15 mi) + tourists physically in the area.
- **Presence, not interest:** set location to "people in or regularly in" your targets (not "interested in") so you don't pay for someone in Florida googling Oregon.
- **Schedule:** events/brand can run all day; the foot-traffic campaign can weight **Thu–Sun, 11am–10pm** (when a click can become a same-day visit). Bump happy-hour hours.
- **Seasonality:** coastal summer + holiday-party season (Oct–Dec) are the spend-up windows; trim Jan–Feb.

---

## 3. Keywords (Private Events campaign — the money maker)
Tight ad groups, **phrase + exact** match (avoid broad until you have conversion data), with negatives.

- **Venue intent:** "private event space seaside or", "rehearsal dinner venue oregon coast", "birthday party venue seaside", "celebration of life venue seaside", "private party room restaurant seaside", "corporate event space oregon coast"
- **Occasion intent:** "wedding rehearsal dinner cannon beach", "graduation party venue astoria", "holiday party venue seaside oregon"
- **Brand:** "iggy's seaside", "iggys bar seaside" (cheap, defends against competitors bidding your name)
- **Foot traffic (separate campaign):** "bars in seaside", "happy hour seaside", "restaurants near me" (location-tight), "live music seaside or"

**Core negatives (add immediately):** jobs, hiring, free, wholesale, rent (apartment), "movie", "tickets", DIY, recipe, definition, Florida/other states. Build the negative list weekly from the Search Terms report — this is where you save the most money.

---

## 4. Ad copy (responsive search ads — give Google 10+ headlines, 4 descriptions)
**Private Events** — headlines:
- Seaside's Private Event Space
- Host Your Party at Iggy's
- Oregon Coast Venue, Upstairs & Down
- Rehearsal Dinners & Birthdays
- Get a Same-Day Quote
- Book Your Date Online
Descriptions: "Upstairs & downstairs private spaces steps from the Seaside beach. Packages, bar service, and a fast online estimate — get your date set in minutes." / "Tell us your guest count and we'll send a quote. Family-run, on the Oregon Coast."
- **Sitelinks:** Get a Quote · Packages · See the Space (photos) · Menu
- **Callout:** Beachfront · Upstairs + Downstairs · Custom Packages · Family-Owned
- **Lead form / call ext:** phone (503) 738-0672 + the /book flow.

**Foot traffic** — lean on Happy Hour, live music nights, the view; sitelink Menu + Events.

---

## 5. Landing pages (don't send clicks to the homepage)
- Events ads → **iggysseaside.com/book** (the configurator + estimator + "let's set a date" CTA you already built — this is a genuinely strong landing page; it converts).
- Brand/foot-traffic → homepage or /food + /happy-hour.
- Make sure every events ad lands on the **estimator**, which already fires `estimator_engaged → cta_clicked → form_started → booking_submitted` funnel events.

---

## 6. Conversion tracking (this is what makes the spend smart — already 80% built)
The app emits first-party funnel events via `src/lib/track.ts` (funnel_events table + track-event edge fn) and supports Microsoft Clarity (env-gated).
1. Create a **Google Ads conversion action** for **"Booking submitted"** (primary, the one to optimize toward) and a secondary **"Newsletter signup"** (built this sprint).
2. Send me the `AW-XXXXXXXXX/label` → I add **gtag.js** (env-guarded, same pattern as Clarity) in `src/main.tsx` and fire `gtag('event','conversion', {send_to})` on those exact high-intent events. Now Smart Bidding optimizes toward real bookings, not clicks.
3. Set `VITE_CLARITY_ID` → session replay + heatmaps of the booking funnel (drop-off diagnosis).
4. Later: **Enhanced Conversions** via the track-event fn (hashed email) for accuracy past cookie loss, and import GBP "calls/directions" as secondary conversions.

**Bidding:** start **Maximize Clicks** with a max CPC cap (~$2–3) for the first ~15–20 conversions to gather data, then switch the events campaign to **Maximize Conversions / Target CPA**. Don't start on tCPA with zero conversion history.

---

## 7. Budget ramp + what "good" looks like
- **Weeks 1–3:** ~$15–25/day, Private Events only. Goal: first 10–15 booking-form conversions, build negatives.
- **Month 2:** add Brand + Foot-traffic; total ~$30–50/day. Switch events to Target CPA once data allows.
- **Benchmarks (rough, local services):** events search CTR 5–10%, CPC $1.50–4, landing→form-start 15–30%, a booked private event worth hundreds–thousands ⇒ even a $30–80 cost-per-booking is a strong ROI. The foot-traffic campaign is judged on Store Visits / GBP actions, not direct revenue.

---

## 8. Launch checklist
- [ ] Claim/complete Google Business Profile (photos, hours, menu, book action) — do first, it's free.
- [ ] Create Google Ads account; set up the **Booking submitted** conversion → send me `AW-…/label`.
- [ ] Send me `VITE_CLARITY_ID`.
- [ ] I wire gtag + conversion events (1 small PR, env-guarded).
- [ ] Build the 3 campaigns above; start Private Events first.
- [ ] Add the negative keyword starter list.
- [ ] Check the Search Terms report weekly for the first month; prune + add negatives.
- [ ] After ~15 conversions, switch events bidding to Target CPA.

*This is a starting framework, not a one-time setup — Google Ads rewards weekly pruning. The biggest wins in month one are almost always the free GBP optimization + ruthless negative-keyword cleanup, not the ad copy.*
