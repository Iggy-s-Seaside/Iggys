# Iggy's "Anton Mode" — Deploy Runbook

Everything built across waves 1–3 is **committed on branch `feature/anton-mode`** and **builds green**, but nothing is live yet. This is the exact, ordered path to make it real. Steps are independent where noted — you can do the safe DB + bridge steps now and defer the payment/social steps until the owner answers.

Legend: 🟢 safe/additive · 🟡 needs an owner decision/account · 🔴 touches the live bar DB or a running service (do deliberately).

---

## 0. Prereqs
- `supabase` CLI logged in to the Iggy's project (`supabase link --project-ref <ref>`), **or** use the Supabase SQL Editor for the SQL steps.
- The repo: manager app `manager-app/`, public site root. Both already `npm run build` clean.

---

## 1. 🟢🔴 Run the database migrations (additive, idempotent)
All new tables/columns from waves 1–3 are consolidated into one file:

```
manager-app/scripts/ANTON-migrate-all.sql
```

Run it once in **Supabase → SQL Editor** (or `supabase db execute --file manager-app/scripts/ANTON-migrate-all.sql`). It is `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` throughout — safe to re-run, never drops data. It creates:
- **Commerce:** `merch_products`, `customer_orders`, `order_items`, `gift_cards`, `gift_card_transactions`; payment columns on `parties`.
- **Events sales:** `proposals`; `parties.run_of_show`; `packages.public_description`/`featured`.
- **Social:** `social_posts`; specials `starts_at`/`expires_at`.
- **Shift cockpit:** `shift_sessions`, checklist + line-check tables (with seeded default templates), `shift_log` (+ `menu_items.is_86d`), `cash_counts`, `eon_reports`.

> 🔴 It's a live production DB. The changes are additive and reversible, but run it at a quiet moment, not mid-Friday-service.

---

## 2. 🟢 Make Luna an expert (the headline) — deploy the upgraded bridge to PC1
The bridge brain upgrade is committed but PC1 still runs the old generic prompt. Two parts:

**2a. Grant the read access** (run in Supabase SQL Editor):
```
manager-app/bridge/grant-luna-bridge-reads.sql
```
(Grants the least-privilege `luna_bridge` role SELECT on `inventory_items, specials, happy_hour, todos` — without this, Luna's new context sections stay empty.)

**2b. Ship the upgraded daemon + restart** (from this Mac, in `manager-app/bridge/`):
```bash
scp luna_iggys_bridge.py bradley@archlinux:/home/bradley/projects/iggys-bridge/
ssh bradley@archlinux 'sudo systemctl restart luna-iggys-bridge && journalctl -u luna-iggys-bridge -n 5 --no-pager'
```
No env or unit changes needed (same file path, same secrets). Verify with the smoke test in `manager-app/bridge/README.md` (insert a pending `luna_messages` row, watch the journal answer it). The 07:00 briefing timer will now emit the expert briefing and can attach one-tap action cards.

> Say the word and I'll run 2a + 2b with you watching.

---

## 3. 🟡 Stripe (unlocks merch + deposits + gift cards — 3 owner asks)
Deploy the edge functions:
```bash
cd manager-app
supabase functions deploy create-checkout --no-verify-jwt   # public cart calls it; validates server-side
supabase functions deploy stripe-webhook  --no-verify-jwt   # Stripe calls it; secured by signature
supabase functions deploy create-refund                     # manager-only (JWT verified)
```
Set secrets:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
# then in Stripe Dashboard create a webhook -> https://<ref>.functions.supabase.co/stripe-webhook,
# subscribe ONLY to checkout.session.completed, copy its signing secret:
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```
**Seed merch:** insert your current shop products into `merch_products` (same string ids/name/price the storefront uses) or checkout returns "Unknown product."
**Owner needs to confirm:** Stripe account live + legal owner; which states to register for sales tax (Oregon storefront/pickup = none); deposit policy (flat vs %, prepay vs hold, cancellation window).

---

## 4. 🟢 Proposal portal + End-of-Night email
```bash
cd manager-app
supabase functions deploy proposal-sign --no-verify-jwt   # public, by unguessable token
supabase functions deploy generate-eon                    # manager-only; reuses the Gmail/send-party-email secrets (already set)
```
The proposal "Pay deposit" button reuses `create-checkout` (step 3). The public proposal page lives at `iggysseaside.com/p/<token>`.

---

## 5. 🟡 Social auto-posting (the safe layer ships now; live posting waits on Meta)
The **draft + approval queue** (`/social`) works as soon as the DB migration (step 1) is run — no deploy needed for drafting/scheduling. **Live posting is deliberately off.** When the owner is ready:
- Convert Instagram to a **Business** account linked to a **Facebook Page**; start **Meta App Review** for `instagram_content_publish` (this is the long pole — weeks).
- Then: `supabase functions deploy social-publish` and set `SOCIAL_PUBLISH_ENABLED=true`, `IG_ACCESS_TOKEN`, `FB_PAGE_ID` (+ GBP creds). Until then the publisher is a guarded stub that never posts.

---

## 6. 🟢 (Optional) luna-snapshot + weather
- `weather-fetch` powers the dashboard's live weather already via a direct browser call — deploying the edge function is optional (`supabase functions deploy weather-fetch --no-verify-jwt`) and only needed for server-side reuse.
- `luna-snapshot` is a future hosted-fallback path; the current PC1 bridge reads the DB directly, so it's **not required** now.

---

## 7. 🟢🔴 Ship the front-ends
Both apps build clean. Deploy however you currently do (Netlify):
```bash
# Manager app
cd manager-app && npm run build && netlify deploy --prod   # -> iggy-s-manager.netlify.app
# Public site
cd .. && npm run build && netlify deploy --prod            # -> iggysseaside.com
```
(Or merge `feature/anton-mode` into the production branch and let CI deploy.)

---

## Owner-decision checklist (gates the 🟡 items)
1. Backend go-ahead (already on Supabase — yes unlocks everything).
2. Stripe account live + which tax states.
3. Deposit & no-show policy.
4. IG **Business** account + approval to start Meta App Review now.
5. Calendar sync: who for, which direction(s).
6. Which 3–6 packages go public + their public copy/price.
7. Merch fulfillment (pickup vs shipping; who packs).
8. A2P 10DLC registration for SMS (waitlist + marketing — later phases).
9. Gift-card outstanding-liability sign-off.

---

## Rollback
- DB: every migration is additive; nothing is dropped. To "disable" a feature, leave its table empty / hide its nav entry.
- Bridge: `scp` the previous `luna_iggys_bridge.py` back and `systemctl restart`, or `git checkout` the prior version (it's in history).
- Front-end: redeploy the prior build, or revert the branch merge.
