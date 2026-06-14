The grep confirms the key claims (8 window.confirm files, 0 lazy imports, 0 ErrorBoundary, 0 useLocation consumers in pages, 0 pushManager.subscribe). I have enough verified grounding. Let me write the synthesized backlog.

# Iggy's Manager-App — Polish Sprint Backlog

*Head of Product + Design synthesis of 12 team reviews. Build order is the "Top 20" table. Menu items and prices are explicitly out of scope and excluded.*

---

## 1. State of the app

Iggy's is a genuinely mature, phone-first product with real craft in its best surfaces — the Shift cockpit, glove-friendly Checks, the SpecialEditor canvas studio (with haptics + undo history), the Today's Pulse hero, the Reports dashboard, and Luna's "draft-don't-send" action cards are all best-in-class thinking. The token system (`card`, `btn-*`, `badge-*`, semantic text/surface colors, dark-mode CSS vars) and disciplined lucide/date-fns usage prove the team can build cohesive primitives. **What holds it back from feeling trillion-dollar is uneven propagation of its own good ideas:** the great patterns (BottomSheet, the hardened Select, Luna's optimistic+granular realtime, the styled ConfirmDialog, content-shaped skeletons) each live on one or two screens while everywhere else re-implements a weaker version, so navigating between pages feels like a stack of separate documents rather than one machined object. **Three systemic resilience gaps are the real ceiling:** zero undo + 8 native `window.confirm()` dialogs make a fat-finger behind a wet bar permanent and ugly; there is no offline awareness or error boundary, so a signal drop in the walk-in silently loses a cash count and a single bad data row white-screens the whole PWA; and a 1.25 MB unsplit bundle taxes every cold start on seaside cellular. **The good news:** almost none of this is invention — the codebase already contains the exact fix patterns. This sprint is about hardening the shared layer once and letting it propagate.

---

## 2. Top 20, ranked (the build order)

| # | Change | Type | Area | Sev | Effort | Why |
|---|--------|------|------|-----|--------|-----|
| 1 | **Top-level `<ErrorBoundary>`** in `main.tsx` wrapping `<App/>` + React Router `errorElement` per route | add | Resilience | 5 | S | Zero error boundaries today (grep-confirmed). One bad date/row white-screens the entire live tool. Smallest effort, largest blast-radius cut. |
| 2 | **Undo on every delete** — soft-delete + persistent "Undo" toast in `hooks/useSupabaseCRUD.ts` `remove()`; inherits to Events/Specials/Todos/Menu/Packages/Social/Media, then port ShiftLog/Reservations/Cogs | add | Resilience | 5 | M | No undo anywhere; one mis-tap behind the bar = unrecoverable loss. Foundational — pairs with #3. |
| 3 | **Kill all 8 `window.confirm()`** → standardize on `ConfirmDialog` via a `useConfirm()` hook (Inventory, Team, CloseOut, Compliance, ShiftLog, Schedule, Cogs, Reservations) | fix | Consistency/UX | 5 | M | Native OS dialogs read as broken in a PWA, ignore dark/brand, block the JS thread. "Close the bar" gated behind a gray alert. Component already exists, unused at these sites. |
| 4 | **Optimistic list writes** — patch local `data` immediately, fire request in background, rollback on error; in `useSupabaseCRUD` + `useTodos`/`useReservations` | fix | Performance/UX | 5 | M | Every Active toggle / todo check / status flip waits a full round-trip + refetch — the laggiest, most-used micro-interaction class. Manager double-taps on bar wifi. |
| 5 | **Route-level `React.lazy` + Suspense** in `App.tsx` (keep Dashboard+Login eager); lazy-import `exportToGif`/gifenc inside the export handler | streamline | Performance | 5 | M | One 1.25 MB / 317 KB-gzip chunk; the 1809-line SpecialEditor + GIF encoder download before Dashboard is interactive. Est. 40-60% initial-JS cut. |
| 6 | **Offline awareness + write outbox** — `useOnlineStatus()`, persistent offline banner in `DashboardLayout`, localStorage outbox in write paths; prioritize cash count / line-check / 86 / shift-log | add | Resilience | 5 | L | Dead zones (walk-in, basement) silently drop data — every write just toasts "Failed" and loses input. Worst-case data loss for the actual use environment. |
| 7 | **Activate Web Push** — `usePushSubscription` (Notification permission → `pushManager.subscribe` → upsert `push_subscriptions`) + Settings toggle; trigger on inquiry/unread/low-review/Luna-alert/deposit-overdue/low-stock | add | Feature | 5 | M | ~80% built and dormant (SW handlers, table, edge fn exist; nothing client-side subscribes). THE feature that makes the app a teammate, not a dashboard. |
| 8 | **Wire Luna's one-tap action cards** — `useLunaHandoff()` reads `location.state` on `/parties/:id`, `/specials/editor`, `/messages`, `/social` to pre-fill draft + open modal (zero `useLocation` consumers today) | fix | Feature | 5 | M | Flagship "Luna drafts, you review, it sends" loop is dead on arrival — the draft pre-fill never fires. Pure wiring of existing contract. |
| 9 | **Surface fetch errors** — render `error` from `useSupabaseCRUD` as an inline "Couldn't load — Try again" card; make `useParties/useTodos/useShift/useReservations/useReviews/useSchedule` return it | fix | Resilience | 5 | M | A network error shows the *same* "No parties yet" empty state as genuine zero — manager panics data is gone. `error` is captured but never rendered. |
| 10 | **Harden the shared `Modal`** — `role="dialog"` + `aria-modal` + `aria-labelledby`, focus trap, Escape, focus restore (Modal.tsx) | fix | A11y | 5 | M | Zero dialog semantics in the entire codebase. Fix once; every dialog + ConfirmDialog inherits. Prereq for #11. |
| 11 | **Responsive Sheet primitive + migrate hand-rolled modals** — render `BottomSheet` below `lg:`, `Modal` at `lg:+` behind one API; migrate the 9 bespoke modals (Inventory, Reservations, Compliance, Schedule, Cogs, Marketing, ShiftLog, SocialQueue) | streamline | Consistency/Mobile | 5 | L | BottomSheet (the best mobile pattern) is used on ONE screen; everywhere else a phone gets a desktop centered dialog floating mid-screen. Unifies elevation, blur, scroll-lock, a11y, and thumb-reach in one move. |
| 12 | **Context-aware center FAB** — quick-create action sheet (Party / Reservation / Walk-in / Todo / Quick Post / Inventory adjust); during a live shift surface shift actions (Log note / 86 / Open bar) | streamline | Mobile/IA | 4 | M | The single most thumb-reachable control is hardwired to "add a party," wasting the app's fastest surface. BottomSheet already exists. |
| 13 | **One shared `money()` + `safeFmtDate()`** in `src/utils/format.ts`; migrate ~11 divergent money formatters and ~8 date copies | fix | Consistency | 4 | M | The same amount renders `$1200.00`, `$1,200`, `$1.2k`, `$1200` across pages — a real consistency bug in a money app. Display-only, no prices touched. |
| 14 | **Extract `<EmptyState>` + `<ListSkeleton>`/`<CardSkeleton>`** and migrate ~14 empty states + ~31 skeleton blocks; convert ~25 bare spinners to skeletons | streamline | Consistency/Onboarding | 4 | M | Half the empty states teach, half dead-end; loading splits 17 skeletons to 25 lonely spinners. One primitive fixes consistency, onboarding, and the error-card variant (#9) together. |
| 15 | **Harden `Select` for light mode** — replace `bg-[#111827]`/`text-white`/ring-offset hex with semantic tokens (Select.tsx) | fix | Design system | 5 | S | The only *fully broken* control: dark-on-light + invisible white text in light mode. One-file fix. |
| 16 | **Fix `text-muted` (2.56:1) + `btn-primary` (1.86:1) contrast** in `index.css` — darken light-mode muted to ~#64748b; darken primary button bg or use dark-teal label | fix | A11y | 5 | M | The most-used text color and the most-clicked control both fail WCAG AA on every screen. Dark mode is fine. |
| 17 | **Form labels + Login a11y** — `<Field>` wrapper with `useId` (174 labels, only 3 `htmlFor`); Login `autoComplete`, `aria-busy`, `aria-live` | fix | A11y | 5 | M | The vast majority of inputs are unlabeled to screen readers; Login breaks password managers. Prioritize Login + QuickAddParty. |
| 18 | **Global command palette / search** — Cmd+K desktop + persistent search pill in mobile header; index 36 routes (synonyms), live entities, and verbs ("Open the bar", "New special") | add | IA | 5 | L | The #1 missing primitive for 36 routes on a phone — collapses "remember which tab" to "type two letters." Reuse existing per-page filter predicates. |
| 19 | **Grouped/collapsible sidebar + Pinned/Recent zone** — 6 labeled sections (Tonight / Bookings & Sales / Marketing / Menu & Stock / Back-of-House / Insights); fix duplicate Users icon + Reviews→/reputation label mismatch | streamline | IA | 5 | M | 25-item alphabet-soup scroll with no grouping; every trip is a full re-scan. Cuts perceived nav from 25 to ~6. |
| 20 | **Backport `uniqueTopic()` + granular realtime** to the 11 fixed-topic hooks; debounce/patch-in-place instead of full refetch; drop post-write `refresh()` | fix | Resilience/Perf | 4 | M | Fixed channel names risk silent CHANNEL_ERROR when a hook mounts twice; refetch-on-change causes double-fetch + skeleton flicker mid-service. useLuna already documents the fix. |

---

## 3. Quick wins (ship today) — S-effort, high-severity

- **Harden `Select.tsx` for light mode** (#15) — semantic tokens instead of hardcoded dark hex. One file, fixes the only fully broken control.
- **`text-muted` contrast** (`index.css` `--color-text-muted` → ~#64748b) — one token, fixes AA on hints/timestamps/placeholders app-wide.
- **Add `.badge-neutral`** (`@apply badge bg-surface-hover text-text-secondary`) and replace the 10+ bare `badge text-text-muted` count chips that render as borderless floating text (Inventory, ShiftLog, Schedule, Reputation, Checks, Reservations, Cogs).
- **Login screen** (`Login.tsx:53`) — theme-aware/branded dark gradient instead of hardcoded `from-slate-50`; bump Sign In to `min-h-[48px]`. First impression every shift.
- **Kill dev-language empty states** (`Checks.tsx:589/604`) — "Run the add-checklists migration" → manager-facing copy + a "Set up checklists" CTA.
- **Manager-actionable send-failure** (`Messages.tsx:228`) — "Check Edge Function logs" → "Couldn't reach Gmail — saved as draft" + a **Retry send** button on the unsent reply.
- **Quick Post: drop required Title** (`QuickPostModal.tsx:351`) — auto-default from overlay text / "Special — {today}"; shoot-and-ship in 2 taps.
- **Compliance: surface expiry date on mobile** (`Compliance.tsx:~454`) — `hidden sm:table-cell` hides the one field that matters; show "Expires {date}" under the name like Events does.
- **Smart date/time defaults** in QuickAddParty / Todos / EventForm (Reservations' `defaultReservedFor()` already does this right).
- **Sub-44px tap targets** — TodoWidget toggle, Modal/Sidebar close (p-1.5 ≈ 27px), Luna action cards, Reservations row buttons → `min-h-[44px]` + `aria-label` on icon-only buttons.
- **ESLint config fix** — add `^_` ignore pattern (clears the false-positive unused-var errors instantly) and add `npm run lint` to the build so the 65-error count can't silently grow.
- **Dead-error & dead-animation cleanup** — remove the unread `error` return path where not wired to #9; wire up or delete the orphaned `slideDownIn/slideUpIn/fadeSlideUp/popUp` keyframes and the no-op `animate-slide-in` on `ImageLibrary.tsx:76` (reuse `popUp` for #the celebration work).

---

## 4. Big bets — L-effort, high-impact features to ADD

- **Global command palette + URL-addressable sub-views** (#18) — the connective tissue that makes 36 routes feel like one cockpit. Prereq: move in-page tab/filter state into URL params so the palette can target sub-views ("Inventory > Low Stock").
- **In-app notification center / activity feed** — a bell → BottomSheet timeline aggregating the realtime events already firing in 12 hooks (new inquiry, low review, deposit paid, schedule published, low stock) with deep links. Shares event sources with Web Push (#7).
- **Pipeline drag-to-advance** — make the kanban an actual kanban: touch long-press / "Advance stage" affordance that writes stage back. Pairs with the party-confirmed celebration for a signature moment.
- **Reservation/Message → Party upsell** — "Start a party from this inquiry" / "Make this a party" on a large reservation or Gmail message; pre-fill PartyForm via existing `findOrCreateContact`. The bar's highest-intent leads currently die in the host board.
- **Reports export/print/share** — page is explicitly built for the owner meeting yet has no PDF/CSV/print. `window.print` + print stylesheet is the cheap win; PartyBEO/RunSheet have patterns to copy.
- **Calendar month grid + tap-a-day-to-create** — currently a read-only agenda; for a venue the calendar is where conflicts are spotted and bookings made. Surface Parties' existing same-date conflict flags here.
- **First-run / onboarding layer** — `useFirstRun()` (localStorage or `profiles.onboarded_at`) + a dismissible Dashboard "Get set up" checklist that auto-hides as each module gains data. Optional one-tap "Load example data."
- **Pagination / `.range()` on growing lists** — Messages (Gmail backfill grows unbounded), Parties, Events, Inventory all `select('*')` with no ceiling; add "Load more"/infinite scroll before payloads bloat the Dashboard load.

---

## 5. Design-system fixes (do once, propagate everywhere)

These are the "one machined object" items — extract the primitive, migrate the call sites, delete the drift.

- **`<Toggle>` primitive** — the iOS switch is copy-pasted with drift across Events, EventForm, Packages, SpecialEditor (different knob sizes/off-colors). One component → identical thumb travel + a11y (`aria-checked`).
- **`<SegmentedControl>`/`<FilterTabs>`** — same control renders as `rounded-full` pills (Parties/Luna), `rounded-lg px-3` (Inventory/Compliance), `rounded-lg px-4` (MenuManager/MediaLibrary). Pick the pill; unify active/inactive colors.
- **`<PageHeader>`** — ~32 hand-rolled `text-2xl font-bold` h1 blocks; icon-beside-title on only 3 pages; Marketing uses `text-xl`. One pattern: title + optional icon + subtitle + breadcrumb/back + right-action slot. Bakes in the back-nav fix for deep `/shift/*` routes.
- **One content-width convention** — `max-w-3xl` is left-aligned on some pages, `mx-auto`-centered on others, full-bleed elsewhere; content visibly jumps on desktop nav. Bake max-width + centering into `DashboardLayout`'s inner container; remove ad-hoc per-page caps.
- **Badge / status-pill consolidation** — bare `.badge` (→ `.badge-neutral`), ad-hoc `rounded-full` chips, and bordered uppercase source tags coexist within one card. Define a small variant set (status / soft-accent / outline-meta) with consistent height/radius/weight. Verify `badge-success` AA; give "Bar is OPEN" first-class weight (live pulse dot).
- **Migrate 9 raw `<select className="input-field">`** to the themed `Select` (Todos, Compliance, Schedule, Reservations, PromoteEventModal, CreateSocialPostModal, QuickAdjust).
- **Centralize status/chart colors** — `text-success`/`text-danger` tokens used 7x while raw `text-green-*`/`text-red-*` appear 41x with hand-written `dark:` overrides; inline `#2dd4bf/#ef4444/#22c55e` in Schedule/Cogs/SpecialEditor. One `statusColors`/`chartColors` map so brand tweaks propagate and light-mode contrast is fixed once (status-by-color-alone also fails 1.4.1 — pair color with icon/text).
- **Dashboard icon-tile tints** — mix of token tints and raw `bg-blue-50 dark:bg-blue-500/10`; introduce semantic accent tints (info/ai/success) so tiles adapt uniformly.
- **`.skeleton` shimmer utility + `useHaptics()` hook** — replace bare `animate-pulse` with a shimmer-with-reduced-motion-fallback; extract the SpecialEditor's working `vibrate()` vocabulary into a shared hook and fire on commits/toggles/tab changes (cheap, very on-brand).
- **Modal enter/exit + page transitions** — add backdrop fade + panel scale-in (reuse `popUp`); wrap `<Outlet/>` in a 150-200ms keyed fade+translateY transition (respect `prefers-reduced-motion`). Felt on every tap.
- **Radius scale, form-gap, and create-verb sweep** — document controls=`lg` / cards=`xl` / sheets=`2xl`; standardize form-pair `gap-4`; pick one create verb ("New X" for headers, "Add X" into a collection, "Log X" for records).

---

## 6. Streamline (redundant / slow flows to simplify)

- **PartyProfile's 5+ independent Save buttons** → one page-level dirty state + a single sticky "Save changes" bar (one toast). Keep per-section actions only for true side-effects (Email invoice, Print).
- **Suppress noisy "Updated successfully" toasts** on cheap idempotent toggles — rely on optimistic flip (#4) as feedback; reserve toasts for creates/deletes/sends; make kept ones specific ("Special published").
- **Notes/follow-up Save UX** — disabled-when-unchanged reads as broken and fires no toast. Move to debounced auto-save with a subtle "Saved · 2s ago," or add a transient checkmark + consistent toast.
- **Checks "Save" buttons are redundant** — line-check rows commit on blur AND show Save (Checks.tsx:417/432); drop the explicit Save (rely on blur + in/out-of-range badge) or show per-row "Saved ✓."
- **Specials Templates panel** reflows the whole list on a header tap — move template quick-pick into SpecialEditor's empty/new state or a bottom sheet.
- **Dashboard de-dup** — Quick Actions grid + Upcoming Events + Low Stock overlap RunSheet and the smart FAB. Once #12/#18 land, trim to one source of truth for "create" and "tonight." Add a top "Needs you" strip (deduped actionable items); demote the vanity stat cards (Active/Total Events) from above-the-fold.
- **RunSheet vs Dashboard** — stop having two competing home-ish pages; either promote RunSheet as the open-hours landing or fold its "tonight" aggregation into Dashboard.
- **Cluster scattered domains into tabbed hubs** — a Marketing hub (Social/Specials/Reputation/Media) and a Money hub (Reports/Invoices/COGS) collapse ~8 flat sidebar entries into 2 destinations.
- **Unify the data layer** — extract `useRealtimeTable<T>` so ~21 hooks stop reimplementing the same refresh/loading/realtime/CRUD scaffold (~1,500 lines); absorbs Reservations' inline two-table CRUD and resolves the live-vs-stale Dashboard freshness contract.
- **Concurrent + leaner fetches** — `useMediaLibrary` serial folder lists → `Promise.all`; debounce the 3-4 full-table realtime refetches in `useReservations`/`useSchedule`; consider one Dashboard summary RPC instead of 7 parallel hooks; reuse the `head:true` count pattern (`useUnreadCount`) for unread/low-stock counts.
- **Image + font weight on cellular** — Supabase image transforms (`?width=400&quality=70`) for grid/card contexts (full-res only in editor); `loading="lazy" decoding="async"` + explicit dimensions on the 20 eager `<img>`s; load only Inter+Playfair eagerly and lazy-inject the 8 decorative font families when SpecialEditor mounts; add `manualChunks` + Supabase `preconnect`.
- **SpecialEditor maintainability** — split the 1809-line / 67-hook shell into `useExport()` / `useEditorModals()` (one discriminated-union `activeSheet` instead of ~13 contradictory booleans) / `useEditorSave()`; lazy-render sub-panels only when their sheet is open.

---

*Out of scope per constraint and excluded throughout: any change to menu items or prices (note: the shared `money()` util in #13/§5 is display-formatting only and touches no price values).*

Backlog grounded against the live codebase at `/Users/bradleybird/code_projects/Iggys/manager-app` — verified: 8 `window.confirm` files, 0 `lazy(` imports in `App.tsx`, 0 `useLocation` consumers in `src/pages`, 0 `pushManager.subscribe`, 0 `ErrorBoundary`.