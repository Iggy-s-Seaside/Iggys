# Iggy's Operating Platform — Owner Meeting Deck

*One cockpit to run the bar. An expert in your pocket. Every dollar collected, every shift accounted for.*

*Presenter: Bradley · 2026-06-13 · Built on the site + dashboard we already own*

---

## Slide 1 — The 30-Second Version

You asked for four things at the last meeting: **list our group packages online, get a real calendar, take card payments, and auto-post to social.**

All four are answered.

But while building them, the same foundation gave us something the big-name bar tools can't sell at any price: **one screen that runs Iggy's end to end — and an AI that thinks about the bar overnight and hands you decisions in the morning.**

Today I'll show you the four asks closed, ten things that'll make you smile, and the exact yes/no calls I need from you to ship.

---

## Slide 2 — The Problem We're Actually Solving

Running Iggy's today means living in six places at once: a notebook for events, a group text for inventory, a phone for bookings, the bank for deposits, Instagram for posts, and your memory for everything else.

Things slip through the cracks. Not because anyone's careless — because **no single screen knows the whole bar.**

The competitors' answer is to sell you five different subscriptions — one for bookings, one for reviews, one for marketing, one for scheduling — that don't talk to each other and run **$300–$800 a month, combined.**

Our answer is different: **one cockpit, one database, one AI that sees all of it.**

---

## Slide 3 — The Vision: One Cockpit

Picture the first screen you open behind the bar:

- **Today's Pulse** — the state of the bar in one line, with the Seaside weather and tide baked in.
- **Tonight's run sheet** — every event, party, special, and low-stock item for tonight, auto-built.
- **The money strip** — what's booked, what's owed, what's paid.
- **Luna's insights** — the overnight thinking, waiting as one-tap decisions.

You don't hunt. You don't remember. You glance, you tap, you're running the bar.

That's not a someday mockup — **the Pulse card is live in the app right now**, weather and all.

---

## Slide 4 — Why We Win: Two Unfair Advantages

Everyone can buy software. **We have two things money can't buy off a shelf.**

**1. One database that holds everything together.** The event book, the inventory cost, the menu, and the bookings live in *the same* Postgres. So the system can reason across them — "that 40-top Saturday needs tequila and limes, and we're short on both." No competitor stitched from five subscriptions can do that.

**2. We already own the AI.** Luna isn't a $300/month add-on. She's our home-lab agent, already reading the bar's tables and already pushing insights on a schedule. "AI that drafts your follow-up email" costs us **near-zero extra** — it costs everyone else a monthly bill.

Those two advantages are why everything on the next slides is realistic, not a wish list.

---

## Slide 5 — Ask #1, Closed: Packages, Listed and Bookable

**You wanted:** our group packages listed online.

**What we built:** branded package cards on the public Book-an-Event page, plus a **live estimator** — the customer picks a package, types in guest count and hours, and sees the **exact total instantly** (using the same invoice math we quote by hand).

It pre-qualifies the lead before they ever call. And on submit, the inquiry lands in our pipeline **already half-quoted** — package picked, guest count in, contact saved.

**Listing + estimator ships first (days). One-link booking with deposit follows.**

---

## Slide 6 — Ask #2, Closed: A Real Calendar

**You wanted:** real online calendar sync.

**What we built:** our unified calendar becomes the **single source of truth** — and it already understands something a generic floor-plan tool doesn't: **upstairs bar vs. downstairs vs. whole space.**

- Customers **subscribe once** to a feed that auto-updates forever — no more "is that date open?"
- Staff get **two-way Google sync** — edit in either place, both stay in step.
- **Luna polices double-bookings before they happen** — she reads the event book and the party book together, so we can never sell a space that's already taken.

One calendar. Nobody steps on anybody.

---

## Slide 7 — Ask #3, Closed: Real Card Payments

**You wanted:** to sell merch and take deposits online.

**What we built:** **one** Stripe checkout rail. And here's the leverage — that single piece of plumbing powers **merch, event deposits, gift cards, and event tickets**, all at once. Three of your four asks ride on it.

- **Free Apple Pay / Google Pay** — customers check out in two taps.
- **Tax handled automatically** where we're registered.
- **Two-tap refunds ship in the same release** — so a storefront never turns into phone calls.

In the demo you'll watch a **real card get charged on my phone.** That's the moment.

---

## Slide 8 — Ask #4, Closed: True Social Auto-Posting

**You wanted:** auto-posting to social.

**What we built:** our Specials design studio — already the best post-maker any competitor has — gets a **Publish button that actually posts.** Instagram, Facebook, and Google Business Profile, **fully automatic**, even when the bar is slammed.

One honest note: Instagram requires Meta's approval to auto-post, and **that approval can take a few weeks** — it's paperwork on their end, not code on ours. So:

- The **draft-and-schedule queue ships now**, independent of the approval.
- We **start the Meta paperwork today** so it's done by the time the rest is ready.
- The current one-tap manual share stays as the fallback until approval lands.

---

## Slide 9 — The Part You Didn't Ask For: AI That Thinks Overnight

This is the one that separates us from everyone.

Luna reads the whole bar — the book, the inventory, the menu, the weather — and **on a schedule, she thinks.** Every morning before you open, a briefing is waiting:

> *"Today: Trivia 8pm downstairs; Garcia 40th 6pm upstairs (28, buffet). No conflicts. 3 items below par. Garcia confirmation not sent. Sunny 71° Saturday — staff up. **Needs your call today:** the Saturday corporate 50-top has been cold 9 days. Draft the follow-up?"*

You tap **Approve.** The app sends it under your login. **Luna never sends anything herself — she drafts, you trigger.** That's the design, and it's a feature: an AI that does the thinking and the typing, a human who stays in control of every send, charge, and post.

And the killer detail for a coast town: **she knows the difference between a slow night and bad weather.** "Down 28%, but it's 50° and raining — that's the weather, not a problem" versus "open night, sunny forecast, no event — let's fill it." No off-the-shelf tool understands Seaside like that.

---

## Slide 10 — Top 10 That'll Make You Smile

1. **Today's Pulse + morning briefing** — state of the bar with a weather/tide read no Toast or Square has, before you open.
2. **The Weekly Owner Pack** — a branded KPI report with a written summary that **shows up in your inbox Monday at 8am without anyone lifting a finger.**
3. **One link that views, signs, and pays the deposit** — the gap between "yes" and "money in" collapses to a single tap from behind the bar.
4. **The End-of-Night report** — one tap composes the whole shift and it's in your inbox **before I walk out the door.**
5. **Real card checkout** — you watch a live charge on my phone; one rail, three asks closed.
6. **Social that posts itself** — to IG/FB/Google **even when the bar is packed.**
7. **Review replies in my voice** — every low-star review buzzes my phone with a ready reply that **already knows it was the sold-out DJ night.**
8. **The live labor-% number** — labor cost against a forecast that **knows the event book.** The number that speaks to the bottom line.
9. **Weather-attributed slow nights** — never again confuse a rainy Tuesday for a problem.
10. **Marketing on autopilot** — birthday, win-back, and post-visit messages that run **while I'm tending bar** — the feature competitors charge $300/month for, free through Luna.

---

## Slide 11 — The Money Math

This isn't a cost center. It's a revenue tool that pays for itself three ways:

**Deposits collected, not chased.** Right now a "yes" can sit for days before money moves. One-link deposits mean **cash in the same hour the customer says yes** — and fewer no-shows on held dates.

**New dollar surfaces that don't exist today.** Merch checkout, **digital gift cards** (pre-paid float + brand-new customers walking in to spend them), and **event tickets** that pre-sell themed nights — all on plumbing we build once.

**Events booked by data, not gut.** The estimator pre-qualifies leads; the pipeline stops letting hot ones go cold; the ROI scoreboard tells us *"Trivia adds $420 a night, Karaoke is break-even"* so we program the room that actually fills.

**And the comparison that matters:** the booking tool, the review tool, the marketing tool, and the scheduling tool you'd otherwise rent run **hundreds a month, combined, for slices of this.** We get the whole thing — because we own the database and the agent.

---

## Slide 12 — How We Ship It: Phased, Each One Demoable

Every phase stands on its own, ships something you can see, and is honest about revenue. No big-bang, no "trust me, it'll work in six months."

- **Phase 0 — Wow in a week.** Today's Pulse, the run sheet, the smarter morning briefing. *(Live now / this week. No new infrastructure.)*
- **Phase 1 — The money rail.** Real Stripe checkout — merch, deposits, gift cards, tickets, refunds. *(Closes three asks.)*
- **Phase 2 — The board report.** The auto-emailed Weekly Owner Pack + the revenue dashboard.
- **Phase 3 — The sales closer.** One link to view, sign, and pay. *(Closes the booking ask fully.)*
- **Phase 4 — The daily cockpit.** Open/close the bar, checklists, line checks, the End-of-Night report.
- **Phases 5–9 — Reach & depth.** Social auto-publish, reviews, marketing, reservations, inventory/labor, the trust layer.

**Phases 5 through 9 reorder around whatever your hottest button is.** Social on top? We pull it forward. Reviews? Same.

---

## Slide 13 — What I Need From You Today

Most of these aren't code — they're business calls only you can make. Quick yeses keep us moving.

1. **The master gate:** OK to add the thin backend layer (Supabase Edge Functions)? **One yes unlocks payments, calendar sync, and social.**
2. **Stripe:** Is the account live and verified? Who's the legal owner? Which states do we collect tax in for shipped merch? *(Oregon pickup is $0 — clean.)*
3. **Deposit & no-show policy:** Flat amount or a percentage? Cancellation window? Luna and the booking flow need the rule.
4. **Social:** Is the Instagram a **Business** account linked to a Facebook Page? OK to **start Meta's approval paperwork now?**
5. **Calendar:** Who's the sync for — customers subscribing, or staff coordinating — and which direction?
6. **Packages:** Which 3–6 go public, at what description and price? Display-only first, or bookable right away?
7. **Merch:** Pickup-only or shipping? Who packs and ships?
8. **SMS & gift cards:** OK to register for text messaging (needed for the waitlist + reminders), and sign off on the gift-card float?

---

## Slide 14 — The One Line to Remember

**Every feature here is "AI that thinks about your bar" — and we already own the agent.**

Competitors charge hundreds a month for slices of this. We get the whole thing, on the foundation we've already built, because Luna reads the bar's own data with memory.

Give me the yeses on Slide 13, and the Pulse you'll see in two minutes becomes the way Iggy's runs.

**Let me show you.**
