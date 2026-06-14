# Iggy's — Anton Sprint ROUND 2 (durable anchor)

Second long autonomous run, authorized by Bradley 2026-06-14 ("another long run of the same anton mode office, ultracode ultrathink — I trust you, nail it"). Same autonomy + HARD NOs as `ANTON-SPRINT-PLAN.md`. **If the conversation compacts, RESUME FROM HERE.**

## NEW permission this round (the only change to the NOs)
- Email + SMS sends are allowed **ONLY** to Bradley's own test targets: **email `bradleyb1rd@icloud.com`**, **SMS `5035602288`**. NEVER send to any real customer/recipient. Build agents must hard-guard test sends to these targets.
- Everything else unchanged: no price changes, no Doogers/Iggy's menu CRUD, real Firefox (no playwright), feature branch only (not pushed).

## Owner's 11 notes → work items
1. **NO RESERVATIONS (hard family rule).** Repurpose "Reservations" → a **Waitlist** only: call-ahead/walk-up name list, party size, phone, quoted wait, status (waiting/notified/seated/no-show), **main-restaurant area** for now (not bar-side yet). Add a **"Text table is ready" SMS** button. Strip all reservation/"book a table" framing. (Private PARTIES are separate and stay.)
2. **Employee login (RBAC).** Waitlist is the first **employee-facing** surface — limited use. Add roles owner/manager/employee; employees see only waitlist + own schedule + checklists, not money/marketing/owner cockpit.
3. **Shift (bar open/close) vs Schedule** confusing — **rename** the bar-service cockpit to disambiguate from staff scheduling. Checklists **roll to the new day at ~9am** (grace window for the prior night's crew), not midnight.
4. **Invoice editing interface** — never built. Build create/edit (line items, totals, save, print; reuse package data + money()). No real sends except to the test email.
5. **Meta access token** — answer: submitted? + a submission checklist + prep (gated until his IG Business + Meta App Review).
6. **Marketing** — (a) public **email + SMS opt-in** signup on the website (consent-gated, subscribers table); (b) **Google Ads marketing plan** (research deliverable, Seaside geo, conversion tracking via existing funnel_events/track-event/Clarity); (c) **texting setup** path (Twilio trial → his number now; A2P 10DLC for production).
7. **Reviews** — answer where they update from (Google Business Profile / Yelp via reviews-sync, currently placeholder place_id) + enable **manual review entry** now.
8. **Docs/Help section** — in-app: a friendly **hand-holding** guide + an **advanced/admin** guide (mostly Bradley). Role-aware.
9. **Inventory (mid-shift realism).** RECOMMENDED design: a fast one-tap **"mark low/out"** with OPTIONAL rough count (chips: Out / 1 left / Low / ~half); **par-level + days-since-count alerts** as the safety net when nobody marks low; **invoice-scan** = reliable "incoming"; **periodic count + variance reconciliation**. Don't attempt real-time bottle-by-bottle depletion (that's the failure trap).
10. **Merch inventory (hardest).** New module: apparel as **style × size matrix** (shirts/crop-tops/sweatshirts), **hats by variant**, fast count-entry grid, intuitive **add-new-type** wizard, **invoice-scan** intake to populate variant stock; ties to the public store stock.
11. **Phones/iPads** — PWA install on iOS (Add to Home Screen): verify manifest + apple meta + icons + standalone; in-app **"Install" helper** (iOS has no native prompt), printable **QR + employee on-ramp**.

## Execution (ultracode, looping; refine after recon)
- **R0 Recon** (read-only, 10 subsystem mappers) → answers + grounded designs. [running]
- **Wave 6** — Waitlist (no reservations) + employee RBAC + "text table ready" SMS + Shift/Schedule rename + 9am checklist rollover.
- **Wave 7** — Inventory fast mark-low + par/reorder + reconciliation; Merch inventory module (variants + quick-add + invoice-scan).
- **Wave 8** — Invoice editor; Marketing (public email/SMS opt-in + campaign send gated/test); Reviews manual entry.
- **Wave 9** — Docs/Help (basic + advanced); PWA iOS install + employee on-ramp + QR.
- **Deliverable docs** — Google Ads plan, Meta submission checklist, Twilio/SMS runbook.
- **Review wave** — adversarial verify; fix confirmed issues.
- Possibly set up **Twilio trial** via eyes+hands (precedent: Stripe) so SMS-to-his-number works for real.

## PROGRESS LOG (round 2)
- 2026-06-14 — Round 2 kicked off. Recon workflow launched (wgtye5aq4). This plan written.
- 2026-06-14 — Recon DONE (10 subsystems). Answers → docs/OWNER-SETUP-GUIDE.md (Meta NOT submitted + checklist; Twilio A2P; Resend email; Google Ads; Google reviews place_id; behold.so IG embed; PWA). Recon facts: reservations+waitlist tables BOTH empty (clean cut); send-sms is a safe stub (needs SMS_ENABLED + TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM); auth was binary (1 user, no roles); inventory tracks one fictional current_quantity; merch_products.inventory is one int (no variants); manager index.html has a broken favicon + no apple-touch-icon.
- 2026-06-14 — WAVE 6 SHIPPED+DEPLOYED+verified (commit 2d2ee7a). Waitlist-only (reservations gutted; area=main-restaurant; no_show; SMS stub kept), employee RBAC (owner/manager/employee; get_my_role/has_role RPCs; RequireRole guards; role-filtered Sidebar/BottomNav — employees see only Service+Waitlist; manage-users+Team role-aware), Service rename + 9am business-day checklist rollover (+generate-eon tz fix). 3 migrations applied. Build green; manage-users+generate-eon redeployed; front-end deployed. Waitlist page verified rendering live.
  - **FOLLOW-UPS (important):** (1) TWILIO can't be fully auto-set-up — account/number verification texts a code to Bradley's physical phone, which I can't receive; app side is ready, it's a ~5-min owner hand-off (then I set the 4 secrets + flip SMS_ENABLED). (2) Employee-login RLS HARDENING: UI gating (RequireRole + sidebar) ships now, but current RLS is "authenticated can do everything" — before handing out REAL employee logins, add role-aware RLS on financial + customer-PII tables (recon flagged: invoices, proposals, contacts, cogs, subscribers, messages). Not urgent (waitlist is main-restaurant only, not bar-side yet, no employee accounts created yet). (3) Employee filtered-view UNTESTED (I'm owner) — verify in the review pass by creating a test employee.
