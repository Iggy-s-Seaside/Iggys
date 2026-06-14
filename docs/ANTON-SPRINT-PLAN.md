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

- 2026-06-14 — WAVE 2 SHIPPED+DEPLOYED (commit bb3b571). Cmd/Ctrl+K command palette (recents+most-used, mirrors Sidebar nav, fires CMD_NEW_PARTY/CMD_QUICK_POST window events; mounted once in DashboardLayout). Offline awareness banner (useOnlineStatus, dismiss-per-stint). Context-aware FAB quick-create sheet in BottomNav (parties/reservations/walk-ins/todos/posts/events/specials) — BottomNav now self-hosts, dropped onQuickAdd prop. Web push (usePushSubscription, VAPID-gated no-op, wired in Team). Modal a11y focus trap. Responsive Sheet primitive. Build 408KB main, green. Next: hands+eyes live verify, then wave 3.
