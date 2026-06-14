# Iggy's Manager App — "Trillion-Dollar" Anton Sprint

**Standing autonomous sprint** authorized by Bradley 2026-06-14. He is NOT available for approvals — I self-direct, self-approve, and keep going. This doc is the durable anchor: if the conversation compacts, RESUME FROM HERE.

## Mission
Make the **manager app** (`~/code_projects/Iggys/manager-app`, live at https://iggysmanagement.netlify.app) the best it can possibly be — polished, streamlined, feature-complete, vetted by many rounds of multi-team review. Build big, take time, polish relentlessly.

## Autonomy grant (explicit)
- Approve anything. Decide styling + functionality. No approvals needed.
- May sign up / configure **Stripe** using Bradley's credentials via the luna-eye hands+eyes harness.
- Self-paced ~12h sprint; keep working across turns without waiting.

## 🚫 HARD NOs (never violate — re-read every turn)
1. **NEVER actually send an email** to anyone. Test flows up to the send button; never trigger a real send (send-party-email, send-reply, auto-reply, send-sms, send-campaign, send-purchase-order, generate-eon email, weekly-owner-pack — all OFF-LIMITS for real sends). Use only obviously-fake test recipients if a send is unavoidable, and prefer NOT sending at all.
2. **NEVER change a price** of anything (menu prices, package prices, merch prices, happy_hour, etc.).
3. **NEVER touch Doogers-menu or Iggy's-menu items** (the menu CRUD: appetizers, on_tap, off_tap, cocktails, shots, happy_hour, menu_categories, menu_items, menu_item_options). This is THE real no.

## ✅ DOs
- Use the app via TOUCH / user-emulated interactions (luna-eye: bin/hid, bin/screenvision, bin/agentd.py).
- **Make a new special** (create + design + save one via the SpecialEditor canvas studio). Allowed.
- Build / add features. Polish UX, visual design, a11y, performance, mobile, consistency, delight.
- Run multi-team quality reviews (UX, design, a11y, perf, code quality, feature-gap, IA).
- Configure Stripe (account + keys + webhook + secrets) so checkout/deposits go live.

## Current state (as of sprint start)
- Branch `feature/anton-mode` (10+ commits, NOT pushed). Both apps deploy via Netlify CLI (authed bradleybird2@icloud.com / ArtisiteDesigns). PUBLIC deploy needs `netlify deploy --prod --dir=dist --no-build` (puppeteer plugin gotcha). Manager app: build `cd manager-app && npm run build`, deploy `netlify deploy --prod --dir=dist --site 4fc15a80-20de-4d36-9628-b4d23b593c6f`.
- Supabase project `nouxyrqpulkbjusriugx` ("iggys"); migrations applied; 15 edge fns + track-event deployed. DB changes via Supabase MCP apply_migration (per-file; cat raw SQL then reproduce).
- Manager app = 36 routes. Full inventory in docs/IGGYS-MASTER-BLUEPRINT.md.
- Stripe: NOT yet set up. Cart shows "Payments not configured yet" gracefully.

## Plan (phased, looping)
- **P0** — Durable plan (this doc) + strap in (luna-eye) + assess manager-app access. [in progress]
- **P1** — Multi-team review workflows over the manager app → prioritized findings (streamline + add).
- **P2** — Hands+eyes QA gauntlet: log in, navigate EVERY screen via touch, make a new special, note friction/bugs.
- **P3** — Build waves: implement top improvements + new features + polish. Build-verify + deploy each.
- **P4** — Stripe setup via eyes+hands (account/keys/webhook/secrets) → flip checkout/deposits live.
- **P5** — Verify everything live (browser/eyes). Loop P1→P3 for more rounds of review+polish.

## PROGRESS LOG (append each turn)
- 2026-06-14 — Sprint kicked off. Wrote this plan. Strapping in for hands+eyes. Launching multi-team review.

- 2026-06-14 — Bradley: STOP playwright. Use luna-eye (bin/hid + bin/screenvision) for ALL GUI/touch interaction. Test login: antonsprint@example.com / AntonSprint2026! (disposable, allowlisted). Review backlog -> docs/MANAGER-REVIEW-BACKLOG.md.

- 2026-06-14 — PIVOT COMPLETE: luna-eye hands+eyes on real Firefox (logged in as bradleybird3, his session). Made special "Slushie Hour" via touch (Slushie template) -> saved as DRAFT/Inactive (not published, no price). Desktop SpecialEditor toolbar tucks under the app header (toolbar findable via Cmd+S->save modal). Backlog ready (docs/MANAGER-REVIEW-BACKLOG.md, Top 20). Launching build wave 1.

- 2026-06-14 — WAVE 1 SHIPPED+DEPLOYED+verified live (ErrorBoundary, optimistic+undo CRUD, lazy routes 1.25MB->385KB, useConfirm x8 pages, a11y contrast+Select, EmptyState/Skeleton/format primitives, Luna handoff x4). commit on feature/anton-mode. Launching wave 2.

- 2026-06-14 — WAVE 5 SHIPPED+DEPLOYED+verified live (commit f0278c9). Page-partitioned consistency sweep across ~22 manager pages (6 disjoint agents): adopted PageHeader (uniform titles+subtitle+action slot), money()+thousands-separators (display-only, {cents} preserves decimals), safeFmtDate (crash-safe), EmptyState, Skeleton, Toggle, SegmentedControl, Field a11y — all behavior-preserving substitutions; agents conservatively SKIPPED unclear 1:1s (Shift/RunSheet/Checks headers kept due to inline badges/print-mode/glove-target concerns; SpecialEditor+MenuManager excluded by design). Build green (2276 modules), deployed. Verified live: Reports (PageHeader+Export/Print actions+charts) + Invoices (PageHeader+EmptyState) render clean. Also deployed create-checkout {CHECKOUT_SESSION_ID} success_url enhancement (commit prior). SPRINT STATUS: waves 1-5 + Stripe(test) all shipped/deployed/verified. Strong stopping point.

- 2026-06-14 — WAVE 4 SHIPPED+DEPLOYED (both apps) + verified live (commit 875e717). 5 disjoint agents: (A) DS primitives PageHeader/Toggle/SegmentedControl/Field (created, fixed a Field cloneElement type cast; not yet adopted — wave 5). (B) PUBLIC checkout result pages /checkout/success + /checkout/cancel (ties off Stripe; verified live rendering "Thank you!" + gift-card note + session_id ref — no more 404); repointed merch CartDrawer success/cancel URLs; left ProposalView deposit URLs intact by design. (C) first-run OnboardingChecklist + useFirstRun (mounted top of Dashboard; verified live "2 of 5 done", deep-links). (D) QuickAddParty dirty-guard (confirm-before-discard via useConfirm) + smart default date (tomorrow, mirrors Reservations) — from QA findings. (E) Reservation/Message -> Party upsell ("Start a party"/"Make a party", reuses findOrCreateContact+createParty, NO email; verified "Make a party" renders on a real lead). Manager build 423KB green; public build green. Deployed: manager (site 4fc15a80) + public (--no-build, site iggysseaside.com). Next: wave 5 = page-partitioned consistency adoption (money/date/EmptyState/PageHeader/Toggle/SegmentedControl/Field, form-label a11y).

- 2026-06-14 — 🟢 STRIPE LIVE IN TEST MODE (end-to-end verified) (commit c869898). Account acct_1TfyBgLd0IcdGP9q "Artisitedesigns" (already logged in, Firefox). Via eyes+hands on the real dashboard (sandbox/test mode): set Supabase edge secrets STRIPE_SECRET_KEY (sk_test) + STRIPE_WEBHOOK_SECRET (whsec) — both clipboard-mediated, never logged. Created webhook endpoint "charismatic-radiance" -> https://nouxyrqpulkbjusriugx.supabase.co/functions/v1/stripe-webhook listening checkout.session.completed. FOUND+FIXED real bug: create-checkout passed `automatic_payment_methods` (PaymentIntent-only param) -> Stripe rejected ALL checkouts; removed it (Checkout auto-enables methods by default), redeployed. GOLD-STANDARD test: created gift_card checkout -> hosted pay page (correct line item) -> test card 4242 -> success redirect -> webhook flipped gift_card pending->active + recorded payment_intent. Cleaned up all 3 test gift_cards. NOTES: (a) LIVE mode still needs Bradley's business/banking/tax activation (correctly his job, not fabricated). (b) Public site lacks /checkout/success + /checkout/cancel routes (404) — add real ones (wave 4). (c) Stripe test-mode Link account created for anton-qa@example.com (harmless test data). (d) Firefox autofill aggressively offered Bradley's REAL saved cards mid-test — used only the 4242 test card, never a real one.

- 2026-06-14 — Hands+eyes QA on live wave-2 (real Firefox, bradleybird3): verified Cmd+K palette (open/filter/route) + palette "New Party" -> QuickAddParty modal end-to-end. Reviewed Dashboard/Reports/Calendar. CONFIRMED in-app Luna is LIVE + expert (context-aware advice on the Jun 20 surf-rock show: PBR/Hamm's stocking, "Surf Break" combo). Findings -> docs/WAVE3-QA-FINDINGS.md (QuickAddParty dismiss-on-outside-click loses data; native date input clunky).

- 2026-06-14 — WAVE 3 SHIPPED+DEPLOYED (commit 6ed9b65). 7 disjoint-file agents + integration. (A) fetch-error ErrorState wired into 6 pages + 5 hooks (distinguishes load-failure from empty). (B) grouped/collapsible sidebar (6 sections, localStorage persist, fixed dup-Users/Reviews nits; routes byte-identical so palette stays in sync). (C) notification center: NotificationBell (mounted in DashboardLayout) + useActivityFeed aggregating parties/messages/luna_insights/low-stock/reservations/reviews into one panel. (D) Reports Export CSV + Print/PDF (scoped print stylesheet, no index.css touch). (E) Calendar month grid + tap-a-day chooser; I wired the date-prefill (Parties ?new=1&date=, PartyForm initialDate, EventForm ?date=). (F) Pipeline real kanban: Back/Advance + pointer-drag, optimistic stage writes, popUp celebration. (G) offline write outbox (src/lib/outbox.ts) wired into useSupabaseCRUD create/update/remove + flush-on-reconnect. Build green, main 418KB. Next: verify live via luna-eye, then wave 4.

- 2026-06-14 — WAVE 2 SHIPPED+DEPLOYED (commit bb3b571). Cmd/Ctrl+K command palette (recents+most-used, mirrors Sidebar nav, fires CMD_NEW_PARTY/CMD_QUICK_POST window events; mounted once in DashboardLayout). Offline awareness banner (useOnlineStatus, dismiss-per-stint). Context-aware FAB quick-create sheet in BottomNav (parties/reservations/walk-ins/todos/posts/events/specials) — BottomNav now self-hosts, dropped onQuickAdd prop. Web push (usePushSubscription, VAPID-gated no-op, wired in Team). Modal a11y focus trap. Responsive Sheet primitive. Build 408KB main, green. Next: hands+eyes live verify, then wave 3.
