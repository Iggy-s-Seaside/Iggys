# Iggy's manager-app — `feature/luna-self-design` PR Audit

_2026-06-19 · branch `feature/luna-self-design` vs base `v2-react` · 129-agent adversarially-verified audit_

**78 confirmed findings** — 1 critical · 13 high · 25 medium · 39 low. (49 confirmed of 74 round-1 candidates after adversarial verify; +29 from a completeness-critic round 2.)

**Baseline ground truth:** manager-app build (tsc -b + vite) green · 127 tests pass · in-scope lint clean (all 110 lint errors are in out-of-scope `supabase/functions/*` edge code).

## Executive summary

This PR (feature/luna-self-design vs v2-react) is broadly net-positive — it introduces a camera-footage-derived "actual_band" pipeline, an a11y hardening sweep across modals/drawers, a uniqueTopic realtime-channel consolidation, and new test coverage — but it ships with one critical and several high-severity defects that warrant blocking until fixed. The dominant recurring theme is the new Python footage pipeline (bar_busyness.py + luna_chronicle.py): it has a critical transaction-poisoning bug that can take down the entire nightly chronicle write, a deploy script that never copies the new module to PC1 (the feature is dead on production from day one), a sampling window that drops the busiest post-midnight close hours, and a re-run path that systematically misattributes footage-derived bands as human floor close-outs — corrupting Luna's accuracy scoreboard. A second theme is incomplete-sweep inconsistency: the a11y, uniqueTopic, and .limit(200) migrations were each applied to some call sites but missed others (OrderHistory drawer, ShiftModal/ImageLibrary aria-labels, four hooks still carrying copy-pasted uniqueTopic, useReviews/useSchedule/useSocialPosts unbounded queries). A third theme is uncleaned timers/effects (Messages, Pipeline, BottomSheet setTimeouts with no cleanup) and React-purity violations (useFocusTrap re-running on callback identity churn — a high-sev focus-trap break; prevFields side-effect in a state updater). Haptic feedback firing every pointermove frame during snap is a high-sev mobile defect. Most data-loss-adjacent issues stem from silent error swallowing with no user notification. The codebase is healthy in structure but needs the critical/high items resolved and the half-finished migrations completed before merge.

## Critical

- **Transaction poisoning: ensure_actual_band() swallows DB errors without rollback** — `manager-app/bridge/bar_busyness.py:135-148` — a DB error inside the cursor block leaves the shared `conn` in InFailedSqlTransaction state; the next `upsert()` in luna_chronicle then fails with "current transaction is aborted", losing the entire chronicle entry. A "non-fatal" block silently takes down the whole nightly write.
  - Fix: add `try: conn.rollback() except Exception: pass` at the top of the `except` block, mirroring `b._query()` in luna_iggys_bridge.py:207-219.

## High

- **deploy-chronicle.sh does not copy bar_busyness.py to PC1** — `manager-app/bridge/deploy-chronicle.sh:31` — only luna_chronicle.py is copied; the new untracked bar_busyness.py is never deployed, so the bare `import bar_busyness` raises ModuleNotFoundError every nightly run (swallowed as non-fatal). The footage feature is dead on production.
  - Fix: add `cp "$SRC_DIR/bar_busyness.py" "$WD/bar_busyness.py"` after the existing cp, and `git add` the file so it is tracked.
- **Post-midnight close hours never queried — busiest window silently dropped** — `manager-app/bridge/bar_busyness.py:76-77` — `compute_band` loops `range(12,24)` on the calendar date only; the 00:00-09:00 hours of day+1 (which businessDay's 9am cutoff assigns to the same service night, and which are the last-call peak) are never sampled, systematically downgrading PACKED close nights.
  - Fix: build timestamps via epoch arithmetic and extend the loop to cover [00:00,09:00) of day+1 into the same peak_floor/totals accumulators (CUTOFF_HOUR=9 to match businessDay.ts); fix the curve label to use a real datetime, not the raw `h`.
- **actual_source misattributed as 'floor' on every chronicle re-run after footage write** — `manager-app/bridge/luna_chronicle.py:71-80, 169-176, 274, 319-328` — `gather()` selects 6 columns and never reads `noted_by`. On re-run the `if not ctx.get("actual_band")` guard skips the footage block, so `actual_source` stays None; build_prompt() then tells Luna "the close-out, logged by the floor" and upsert() persists `actual_source='floor'` — corrupting the audit record and Luna's accuracy self-assessment. (Three findings describe the same defect.)
  - Fix: add `noted_by` to the `gather()` SELECT and set `ctx["actual_source"] = "footage"` when `dl[6] == "luna-footage"`, making re-runs idempotent. No schema change needed.
- **Poison-entry drop cascades silently into dependent queue entries with no user notification** — `manager-app/src/lib/outbox.ts:232-244` — when an offline INSERT hits MAX_REPLAY_ATTEMPTS it is dropped and the loop continues; dependent UPDATE/DELETE entries then replay against a non-existent row (Supabase returns no error for 0-row matches), succeed as no-ops, and the user gets only a console.error — silent offline data loss on bar wifi.
  - Fix: add an `onPoisonDrop?: (entry) => void` callback to `flush`/`doFlush`, call it after `removeById`, and in useSupabaseCRUD pass a `toast.error` so the lost write is surfaced; add a comment acknowledging the dependent-entry cascade gap.
- **outbox.test.ts: update and delete operations are entirely untested (incl. malformed silent-flush)** — `manager-app/src/lib/outbox.test.ts:41-73` — every test uses op='insert'; the update/delete paths and the malformed-entry branch (rowId null → logs, then `removeById` + `flushed++`) are uncovered, so a write that never reached Supabase is counted as flushed with no test guarding it.
  - Fix: add happy-path update + delete tests, a malformed-rowId test pinning whether `flushed` should be 0, and a server-error-on-update quarantine test mirroring the insert poison test.
- **useFocusTrap re-runs mid-open and re-captures focus when onEscape identity changes** — `manager-app/src/hooks/useFocusTrap.ts:46-91` — `onEscape` is in the dep array and every caller passes an inline/unstable arrow (Modal.tsx:27, Sidebar.tsx:128; zero useCallback across 11 callers), so any parent re-render tears down and re-runs the effect: focus snaps to the first child mid-session and restore targets an element inside the dialog instead of the opener.
  - Fix: hold `onEscape` in a ref synced each render, call `onEscapeRef.current?.()` in the keydown handler, and remove `onEscape` from the dep array. No callers change.
- **Snap haptic fires on every pointermove frame while a snap guide is visible** — `manager-app/src/hooks/useElementInteraction.ts:236-250` — `buzz([5,5,5])` runs unconditionally whenever `snaps.x.length > 0`, i.e. every frame the element is in the snap band; on Android this is a continuous 60fps buzz that interferes with motor control.
  - Fix: add a `lastSnapXRef`; only buzz when `snaps.x[0] !== lastSnapXRef.current`, update the ref, and reset to null when `snaps.x.length === 0`.
- **Rotation snap haptic fires on every pointermove frame within 5° of a snap** — `manager-app/src/hooks/useElementInteraction.ts:423-427` — `buzz(10)` inside the rotate snap loop fires on every frame the angle is within ROTATION_SNAP_THRESHOLD, producing dozens of pulses per slow rotation through a snap point.
  - Fix: add a `lastSnapAngleRef`; buzz only when the resolved snapped angle differs from the ref, update it, reset to null when no snap matches, and clear it in onUp.
- **Slider clone effect keyed on sliderActive doesn't re-run when a second slider is touched in peek mode** — `manager-app/src/components/ui/BottomSheet.tsx:84-150` — `handleSliderStart` sets `activeSliderRef.current` then `setSliderActive(true)`, a no-op when already true, so the clone effect (deps `[sliderActive]`) never rebuilds; the floating bar stays wired to the first slider and the second is silently ignored (reachable in PropertyPanel's ~15 sliders).
  - Fix: add a `sliderEpoch` state, increment it on every `handleSliderStart`, and add it to the clone effect's deps so the effect always rebuilds against the new `activeSliderRef.current`.
- **Scanner stuck in 'error' state after modal dismissed via Cancel** — `manager-app/src/pages/Inventory.tsx:663-668` — `onClose` only calls `scanner.reset()` when `state === 'done'`; cancelling from an error state leaves scanner in 'error', and the Scan Order button (gated `state !== 'idle' && !== 'done'`) stays permanently disabled until page reload.
  - Fix: call `scanner.reset()` unconditionally in `onClose` (it is idempotent); keep `refresh()` gated on 'done'.

## Medium

- **prevFields stale-undefined rollback in useSupabaseCRUD.update — optimistic patch stranded** — `manager-app/src/hooks/useSupabaseCRUD.ts:73-92` — `prevFields` is assigned inside the `setData` updater (a purity violation); under React 19's macrotask scheduling the awaited network call can resolve before the updater flushes, so on error the rollback spreads `prevFields ?? {}` (a no-op) and stale optimistic data stays visible. Also a no-op when the row isn't yet in `data[]`. (Two findings, same defect.)
  - Fix: compute `prevFields` synchronously from `data.find(r => r.id === id)` before calling `setData`, handle the row-absent case explicitly, and keep the `setData` updater pure.
- **OrderHistory slide-in drawer missing role='dialog', aria-modal, focus trap** — `manager-app/src/components/inventory/OrderHistory.tsx:26-38` — structurally identical to the drawers this PR hardened (InventoryLogDrawer/OrderDetailDrawer/MerchLogDrawer) but renders a plain div with no dialog semantics, no focus trap, and no Close aria-label; SR users can Tab out behind it.
  - Fix: add `useFocusTrap(open, panelRef, { onEscape: onClose })`, `role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} inert={!open}`, the slide-in transform classes, an `id` on the h2, `aria-label="Close"` on the X, and gate the backdrop on `open` — matching InventoryLogDrawer.tsx:14-51.
- **SegmentedControl uses tab/tablist ARIA without tabpanel relationships** — `manager-app/src/components/ui/SegmentedControl.tsx:78-81` — `role="tablist"`/`role="tab"` with `aria-selected` but no `aria-controls`, and neither call site (Calendar.tsx:182, Luna.tsx:385) adds `role="tabpanel"`/`aria-labelledby`, so AT cannot navigate tab↔panel.
  - Fix (preferred): switch to the radio-group pattern that matches the filter UX — `role="group"`/`role="radio"`, `aria-selected`→`aria-checked`; arrow keys remain valid per APG.
- **useUnreadCount mounted twice — 2 parallel COUNT queries + 2 realtime subs on every page** — `manager-app/src/hooks/useMessages.ts:150-179` — both Sidebar.tsx:124 and BottomNav.tsx:37 call it independently inside DashboardLayout, so every route opens two COUNT queries and two postgres_changes listeners on `messages`.
  - Fix: lift the call into DashboardLayout (or a MessagesContext) and pass `unreadCount` as a prop to both consumers.
- **CreateSocialPostModal mounts 3 data hooks unconditionally on SocialQueue load** — `manager-app/src/components/social/CreateSocialPostModal.tsx:37-40` — useSupabaseCRUD('specials'), useSupabaseCRUD('events'), and useSocialPosts() fire even while the modal is closed (it is always-mounted at SocialQueue.tsx:258), adding a duplicate social_posts fetch + second realtime sub plus two unused fetches.
  - Fix: conditionally render at the call site — `{showCreate && <CreateSocialPostModal .../>}` — so hooks run only when open.
- **useSchedule fetches ALL time_off_requests with no date filter/limit (+ hardcoded channel)** — `manager-app/src/hooks/useSchedule.ts:171, 195` — every realtime event triggers a full re-fetch of the unbounded time_off_requests table (shifts are week-scoped, this is not), and line 195 uses hardcoded `'schedule-board'` instead of uniqueTopic.
  - Fix: scope the query to a rolling window (e.g. -90/+60 days via date-fns addDays/format) and switch to `uniqueTopic('schedule-board')`.
- **Messages: askLunaToDraft's 2.5-min setTimeout + Supabase channel have no cleanup** — `manager-app/src/pages/Messages.tsx:310-366, 348-365` — the 150,000ms timeout id is never stored and the channel is only removed inside `finish()`; navigating away mid-draft leaks the channel for up to 2.5 min and fires setState/removeChannel on an unmounted tree. (Two findings, same defect.)
  - Fix: store the timer and channel in refs, clear/remove them inside `finish()`, and add a `useEffect(() => () => { clearTimeout(...); removeChannel(...); }, [])` cleanup.
- **animatedClose setTimeout has no clearTimeout — fires on unmount and can double-fire** — `manager-app/src/components/ui/BottomSheet.tsx:28-34` — the 250ms timer id is never stored; rapid backdrop-click + Escape queue two timers calling `onClose()` twice, and an unmount mid-animation fires setState on a dead component.
  - Fix: store the timer in a ref, early-return if a close is already in flight, and add a useEffect cleanup that clears it on unmount.
- **useFocusTrap deactivates and restores focus every time sliderActive toggles** — `manager-app/src/components/ui/BottomSheet.tsx:55` — `useFocusTrap(open && !sliderActive, ...)` flips active false on slider touch, running the restore-focus cleanup that yanks focus to the element behind the sheet mid-drag (the "detached node on re-activation" claim does not hold, but the focus theft does).
  - Fix: pass `restoreFocus: false` to the trap and manage pre-sheet focus manually in a `useEffect` keyed on `open` only, restoring on true close.
- **ContactField copy() doesn't guard navigator.clipboard before writeText** — `manager-app/src/pages/PartyProfile.tsx:71-79` — `await navigator.clipboard?.writeText(value)` resolves to undefined (not a rejection) in non-HTTPS/old-iOS/WebView contexts, so `setCopied(true)` + `buzz(8)` fire a false success while nothing is copied.
  - Fix: `if (!navigator.clipboard) throw new Error(...)` before writeText so the catch fires a "Copy unavailable on this device" toast.
- **luna_chronicle.py uses date.today() (system TZ) instead of Pacific** — `manager-app/bridge/luna_chronicle.py:371` — `date.today() - timedelta(days=1)` is system-TZ-dependent; on a UTC PC1 the 03:30 timer can write a chronicle entry for the still-open service night. bar_busyness.py anchors to America/Los_Angeles; the chronicle does not.
  - Fix: `day = datetime.now(ZoneInfo("America/Los_Angeles")).date() - timedelta(days=1)`, mirroring bar_busyness.py.
- **luna_photos.business_day stamped with UTC date, not the 9am-cutoff service day** — `manager-app/src/hooks/useLunaChronicle.ts:207` — `new Date().toISOString().slice(0,10)` means every evening/night photo (the active-bar window) gets the next UTC calendar day, so it's invisible to the chronicle's `WHERE business_day = %s` and Luna's Room for the correct date.
  - Fix: import and use `todaysBusinessDay()` from `../utils/businessDay`, matching useShift/useChecklists/useCloseOut.
- **useDemandLog today uses date-fns format (browser local TZ) not the 9am Pacific cutoff** — `manager-app/src/hooks/useDemandLog.ts:24, 54, 63` — `format(new Date(), 'yyyy-MM-dd')` diverges from businessDay() in both TZ and cutoff; between midnight and 9am Pacific the live read path (`todayRow` → ForecastCard accuracy) looks up the wrong day key.
  - Fix: replace with `todaysBusinessDay()` (removes the date-fns format dependency), fixing both the live todayRow read and the latent logActual write.
- **Dry-run still calls Luna and contaminates the production session tag** — `manager-app/bridge/luna_chronicle.py:330-342` — `--dry` prints the prompt but falls through to `b.ask_luna(..., session_tag=f"chronicle-{day}")`, firing the full API round-trip and writing to Luna's session history under the same tag a real run uses.
  - Fix: `return 0` immediately after printing the prompt in the dry branch (or use a distinct `-dry` session tag) so dry mode is a true no-op preview.
- **Partial-hour API failures silently bias peak_floor downward** — `manager-app/bridge/bar_busyness.py:83-87, 104-105` — `except Exception: continue` skips a failed hour with no log/counter; if peak close hours fail the band is computed on incomplete data and looks authoritative (zero-guard still passes on any earlier success).
  - Fix: add a `skipped` counter, log it after the loop, return `hours_skipped` in the dict, and append a data-quality note to `demand_log.note` when > 0.
- **Non-list/non-dict JSON response causes unguarded AttributeError abandoning all 13 windows** — `manager-app/bridge/bar_busyness.py:83-101` — a JSON string response (e.g. `"Internal Server Error"`) isn't a dict, so iteration yields chars and `ev.get('type')` raises, propagating out of compute_band and aborting every remaining hourly window with an unhelpful log.
  - Fix: after the dict unwrap, `if not isinstance(evs, list): continue` so one bad response skips only that hour.
- **Band miscalculated as SLOW when only patio/lottery cameras detect people** — `manager-app/bridge/bar_busyness.py:73-112` — the no-data guard returns None only when all three zone totals are zero; if floor cameras are silent (genuinely empty, or all requests failed) but patio/lottery fired, the guard passes and `_band(0)` writes a fabricated SLOW band.
  - Fix: change the guard to `if tot_floor == 0: return None` — absence of floor data is no signal regardless of patio/lottery activity.
- **build_prompt() asserts 'logged by the floor' when actual_source is None** — `manager-app/bridge/luna_chronicle.py:172-174` — the binary ternary treats any non-'footage' value (including None on re-run) as a human floor close-out, a factual error in Luna's prompt. (Tied to the actual_source High finding.)
  - Fix: covered by adding `noted_by` to gather(); optionally add a defensive `else: src = "the night's record"` for genuine None.
- **invoice.test.ts: gratuity base only tested with food_total, never drink_total** — `manager-app/src/utils/invoice.test.ts:46-58` — the "key rule" test uses food=100/drink=0, so a regression to `gratuity_rate * foodTotal` (dropping drink) would still pass.
  - Fix: add a case with `drink_total: 200, food_total: 0` asserting `gratuity === 36`.
- **calendarSync.test.ts: ICS timestamps are floating (no TZID/Z) — spec deviation** — `manager-app/src/utils/calendarSync.test.ts:52-70` — `DTSTART:20260320T200000` has no UTC marker or TZID per RFC 5545; tests lock the non-conforming format so a correct fix can't be caught, and `downloadIcsFile` is live via AddToCalendarButton.
  - Fix: add a UTC formatter (getUTC* + `Z`) to calendarSync.ts for DTSTAMP/DTSTART/DTEND and update the test to assert the `Z` suffix.
- **Cross-language day-key contract is entirely untested** — `manager-app/src/utils/businessDay.test.ts:1-56` — no test (TS or Python) verifies that compute_band's sampled hours cover the same instants TS assigns to `business_day=day` (the [00:00,09:00) day+1 window); the contract is currently violated with no regression guard.
  - Fix: add a Python test asserting the [00:00,09:00) day+1 invariant against the corrected compute_band window, plus a TS exact-midnight boundary case.

## Low

- **outbox: poison entries at attempts 1-2 block the entire queue for up to 3 reconnects** — `manager-app/src/lib/outbox.ts:232-244` — `bumpAttempts` + `break` on the first/second rejection blocks all later (including independent-table) entries until the third rejection quarantines the poison entry. This is documented ordering-guarantee design; the proposed `continue` is unsafe without dependency tracking.
  - Fix: leave the ordering `break` as-is; if unblocking is wanted, add per-entry `dependsOn` tracking, or lower MAX_REPLAY_ATTEMPTS to shrink the blocking window.
- **outbox.test.ts: single-flight guard is completely untested** — `manager-app/src/lib/outbox.test.ts:35-73` — all tests await flush sequentially, so the `if (flushing) return flushing` branch (which prevents duplicate INSERTs) is never exercised.
  - Fix: add a `Promise.all([flush(s), flush(s)])` test asserting both return the same result by reference and `flushed === 2`.
- **cogs.test.ts: test title 'excludes items at or above par' is factually wrong** — `manager-app/src/hooks/cogs.test.ts:68-71` — impl uses `<=` (at-par items ARE included) but the test only checks qty=9>par=5; the at-par edge is untested and the title misleads.
  - Fix: rename to 'excludes items strictly above par' and add a case asserting at-par (qty=5,par=5) IS included.
- **timeWindows.test.ts: 'Late night' (and 'Evening') group labels never asserted** — `manager-app/src/lib/timeWindows.test.ts:96-101` — only Morning/Afternoon group labels are checked; a boundary regression in slotGroup() would pass silently.
  - Fix: add `byVal(opts,1200).group === 'Evening'` and `byVal(opts,1500).group === 'Late night'` assertions.
- **calendarSync.test.ts: no test asserts absence of RRULE/recur for non-recurring events** — `manager-app/src/utils/calendarSync.test.ts:41-50` — an accidental always-on RRULE would go undetected.
  - Fix: add `expect(url).not.toContain('recur=')` and `expect(ics).not.toContain('RRULE:')` to the non-recurring tests.
- **invoice/calendar aside — ShortcutsSheet '?' keydown toggles the modal shut while open** — `manager-app/src/components/ShortcutsSheet.tsx:32-41` — `isTypingTarget` returns false for the focused Close button, so a second `?` press calls `setOpen(v => !v)` and closes the modal, bypassing Escape.
  - Fix: change `setOpen((v) => !v)` to `setOpen(true)` so a second `?` is a no-op; rely on the Modal's own onClose paths.
- **animate-fade-in on role=alert (ErrorState) can suppress live-region announcement** — `manager-app/src/components/ui/ErrorState.tsx:33` — opacity:0 at DOM insertion can suppress the alert in older NVDA+Firefox (largely fixed in modern builds; reduced-motion collapses it).
  - Fix: swap `animate-fade-in` for a transform-only `animate-slide-in` keyframe that never starts at opacity:0; apply the same to EmptyState.tsx:23.
- **preloadImage resolves via decode() before the naturalWidth check** — `manager-app/src/components/editor/exportToCanvas.ts:385-399, 391-398` — the `decode().then(() => resolve(img))` path lacks the `naturalWidth > 0` guard that `onload` has; a 0x0 SVG can resolve non-null (downstream draw guard catches it, so impact is invisible output). (Two findings, same defect.)
  - Fix: `img.decode().then(() => resolve(img.naturalWidth > 0 ? img : null))`.
- **CampaignComposer: useFocusTrap called with hardcoded `true`** — `manager-app/src/pages/Marketing.tsx:416` — works because the component is conditionally rendered (same pattern in PromoteEventModal.tsx:55, Compliance.tsx:59); a future always-mounted refactor would break the trap.
  - Fix: thread an `open` prop and pass `useFocusTrap(open, ...)`, or add a JSDoc invariant; apply consistently to the other two.
- **ShiftModal Close button missing aria-label** — `manager-app/src/pages/Schedule.tsx:191` — the X button got `transition-colors` but not `aria-label="Close"` like StaffFormModal:79; fails WCAG 4.1.2.
  - Fix: add `aria-label="Close"` to the button.
- **ImageLibrary search input missing aria-label** — `manager-app/src/components/editor/ImageLibrary.tsx:99-105` — the PR added `aria-label="Search images"` to equivalent inputs (MediaLibrary, Inventory, Merch) but missed this one.
  - Fix: change `type="text"`→`type="search"` and add `aria-label="Search images"`.
- **aria-label={title} duplicates the visible h3 for screen readers** — `manager-app/src/components/ui/BottomSheet.tsx:245-248` — the dialog's aria-label and the visible h3 (line 273) both render `title`, announcing it twice.
  - Fix: remove `aria-label`, add `id` to the h3, and point `aria-labelledby` at it.
- **useReviews limit(200) not applied to realtime-prepended rows** — `manager-app/src/hooks/useReviews.ts:33-34` (handlers at 71/101; same pattern useMessages.ts:46) — realtime INSERTs prepend without trimming, so in-memory arrays can drift past 200 over long sessions (negligible at bar volumes).
  - Fix: `.slice(0, 200)` in the INSERT handlers.
- **useReviews uses hardcoded channel 'reputation-realtime'** — `manager-app/src/hooks/useReviews.ts:64-65` — not migrated to uniqueTopic like useMessages/useSocialPosts; latent collision risk only (single mount today).
  - Fix: `import { uniqueTopic }` and `.channel(uniqueTopic('reputation-realtime'))`.
- **Three realtime hooks missed in uniqueTopic migration** — `manager-app/src/hooks/useShiftLog.ts:102` (also useSchedule.ts:195, useReviews.ts:65) — hardcoded channel names remain; latent only since each hook mounts once.
  - Fix: migrate all three to `uniqueTopic(...)`.
- **Four hooks still carry copy-pasted uniqueTopic after consolidation** — `manager-app/src/hooks/useLuna.ts:16-17` (also useLunaChronicle.ts:10-11, useParties.ts:10-11, useWeatherWatch.ts:25-26) — local `channelSeq`/`uniqueTopic` persist despite lib/realtimeTopic.ts; no correctness bug (distinct base strings), just incomplete migration.
  - Fix: delete the local copies and `import { uniqueTopic } from '../lib/realtimeTopic'`.
- **useShift triggers 3 redundant refresh() calls on one shift event** — `manager-app/src/hooks/useShift.ts:63-73` — on `/` an ops user has 3 live uniqueTopic channels (Dashboard direct + useAutoOpenShift + QuickCreateSheet via BottomNav), each firing its own select() per shift_sessions change (the finding's "4×" is overstated by 1).
  - Fix: lift shift state into a ShiftContext so one provider owns one channel/refresh, or debounce the channel callback ~50ms.
- **useSupabaseCRUD does SELECT * with no .limit()** — `manager-app/src/hooks/useSupabaseCRUD.ts:17` — unbounded fetch for events/specials/inventory_categories/user_templates (social_posts is NOT routed here); low cardinality today.
  - Fix: add an optional `limit = 500` param applied in `refresh()`.
- **useSocialPosts has no .limit() on its main query** — `manager-app/src/hooks/useSocialPosts.ts:71-73` — every realtime event triggers a full unbounded social_posts scan; PR added .limit(200) to messages/reviews but not here.
  - Fix: add `.limit(200)` after the `.order(...)`.
- **useOutboxPending instantiated twice — doubled localStorage poll** — `manager-app/src/components/SyncPendingPill.tsx:13` — SyncPendingPill and OfflineBanner are co-mounted and each starts a 4s interval + online/visibilitychange listeners for the same value; trivial cost.
  - Fix: lift one `useOutboxPending()` into DashboardLayout and pass `pending` as a prop to both.
- **Triple-tap on a TEXT layer falls through to pending-drag state** — `manager-app/src/hooks/useElementInteraction.ts:160-201` — text layers don't early-return after `newCount >= 3` (only image/video do), so setPointerCapture + listeners run and a spurious onUpdateLayer can fire if the pointer drifts before lift; cleanup is guaranteed (no leak).
  - Fix: move the `return` outside the inner image/video `if` so any triple-tap exits before pointer capture.
- **estimateHeight in hook hardcodes lineHeight 1.3 vs SelectionOverlay's layer.lineHeight** — `manager-app/src/hooks/useElementInteraction.ts:37-44` — for any TextLayer with a custom lineHeight the hook underestimates height, making canvas-bounds clamping too permissive and the selection overlay Y-extent misaligned.
  - Fix: use `layer.fontSize * (layer.lineHeight ?? 1.3)` and the MIN_TOUCH_TARGET floor, or extract a shared estimateHeight util.
- **TodaysPulse accuracy display nested inside the pulse-only branch** — `manager-app/src/components/dashboard/TodaysPulse.tsx:150,182,184` — when no pulse exists yet, accuracy (fetched independently by useDemandLog) is silently dropped despite being populated.
  - Fix: move the accuracy paragraph outside the pulse ternary, guarded on `accuracy && accuracy.n >= 2`.
- **useDemandLog refresh() has no error handling** — `manager-app/src/hooks/useDemandLog.ts:29,37,46,47` — destructures only `data`, so a query failure silently nulls todayRow/accuracy; the mount effect's promise rejection is unhandled.
  - Fix: destructure `error`, log/return on it, and `refresh().catch(console.error)` in the effect.
- **bg-fixed parallax on hero causes broken parallax on iOS Safari** — `src/pages/Home.tsx:185-189` — `md:bg-fixed` is unsupported on iOS WebKit (falls back to scroll — image renders, parallax just fails; not a blank hero as originally framed) and `willChange:'transform'` breaks it on desktop too.
  - Fix: drop `md:bg-fixed`, keep `bg-cover bg-center`; use a transform-based parallax if the effect is wanted.
- **bothEventColumns flickers during async load (layout shift)** — `src/pages/Home.tsx:154-164` — useEvents/useSpecials resolve at different times, so the section appears single-column then jumps to two-column on the second fetch (worse CLS than the pre-PR always-two-column).
  - Fix: destructure `loading` from both hooks and gate `bothEventColumns` on `!eventsLoading && !specialsLoading` so the layout class is chosen once.
- **loading state from all four Home hooks silently discarded** — `src/pages/Home.tsx:154-157` — only `data` is destructured; on slow/cold-start fetches every section renders empty with no skeleton, and errors render nothing (public page, fast in practice).
  - Fix: destructure `loading`/`error`, add a combined loading guard / skeletons, mirroring Events.tsx:169-170.
- **compute_band worst-case 12×45s = 9 min stall** — `manager-app/bridge/bar_busyness.py:76-87` — all-timeout case adds ~9 min before returning; harmless given the daily 03:30 timer and non-fatal wrapper (no next-day overlap), but slow.
  - Fix: drop the per-request timeout from 45s to 10s (bounds worst case to 120s); optionally add a wall-clock budget.
- **bar_busyness imported inline inside run(), ImportError swallowed as generic non-fatal** — `manager-app/bridge/luna_chronicle.py:321` — a missing/broken module is indistinguishable from a footage-API failure in the log (the "hot path cost" framing is inaccurate — it's a nightly one-shot).
  - Fix: move `import bar_busyness` to module top wrapped in `try/except ImportError: bar_busyness = None` and guard the call with `if bar_busyness is not None:`.
- **compute_band zero-event guard / patio-only SLOW (duplicate of the patio finding)** — `manager-app/bridge/bar_busyness.py:104-112` — same root cause as the medium patio/lottery finding, viewed at the guard line.
  - Fix: `if tot_floor == 0: return None` (single fix covers both).
- **Unclosed file handle in _bareye_creds()** — `manager-app/bridge/bar_busyness.py:45-52` — `for line in open(_LUNA_API_ENV):` leaks the handle on exception (matters on PyPy / tight ulimits on PC1).
  - Fix: wrap in `with open(...) as fh:`.
- **actual_source column missing / gather() omits noted_by (self-heal blocked)** — `manager-app/bridge/luna_chronicle.py:274` — re-run misattribution can't self-heal because gather() never reads `noted_by` ("missing migration" framing is wrong — actual_source lives only in the context JSONB by design).
  - Fix: same one-line gather() fix — add `noted_by` to the SELECT and derive actual_source.
- **CloseOutCard.tsx is now a dead export with no callers** — `manager-app/src/components/dashboard/CloseOutCard.tsx:1-88` — only its own file references it after Dashboard removal.
  - Fix: delete the file (recoverable from git history) or add an UNMOUNTED marker comment.
- **useDemandLog fields todayRow/saving/logActual now unused in Dashboard** — `manager-app/src/pages/Dashboard.tsx:20,42,121` — only `demand.accuracy` is consumed after CloseOutCard removal; the hook still fires its query.
  - Fix: `const { accuracy } = useDemandLog()` and update line 121; longer term extract a read-only `useDemandAccuracy()`.
- **useDemandLog's useAuth() call is now wasted work** — `manager-app/src/hooks/useDemandLog.ts:4,23,56,68` — `user` is only used by the now-uncalled `logActual`, leaving a live AuthContext subscription that re-renders Dashboard on token refresh.
  - Fix: remove the useAuth import/call, set `noted_by: null`, drop `user` from the dep array (or add a TODO if logActual will be revived).
- **DEV_AUTH_FLAG exported but never imported outside its module** — `manager-app/src/lib/devAuth.ts:21` — only internal usage; the export is dead.
  - Fix: remove the `export` keyword.
- **peekHeight prop declared but never used** — `manager-app/src/components/ui/BottomSheet.tsx:10-13` — dead interface member, no caller passes it.
  - Fix: remove `peekHeight?: number` from the interface.

## Coverage notes

Reviewed the full feature/luna-self-design diff against v2-react across three surfaces: (1) the new Python footage pipeline — `bar_busyness.py` and `luna_chronicle.py` (transaction handling, timezone/day-key correctness, the camera-sampling window, error swallowing, deploy script, and dry-run semantics); (2) the React manager-app — outbox/offline-sync, the useSupabaseCRUD optimistic-update path, realtime-channel (uniqueTopic) consolidation, the a11y hardening sweep (focus traps, dialog roles, aria-labels), the canvas editor (element interaction/haptics, exportToCanvas, image library), BottomSheet/slider peek mode, and the demand/chronicle dashboard wiring; and (3) the public `src/pages/Home.tsx` plus the test suites (outbox, cogs, invoice, calendarSync, timeWindows, businessDay). Every finding was adversarially verified against the cited file:lines; several severities were corrected down where the impact was over-stated (patio/lottery, Home iOS hero, bg-fixed) and the cross-language day-key contract was confirmed untested. Not covered here: runtime/manual QA, security/RLS review (see prior backend audit), and visual regression of the design changes.

## Quick wins (trivial / safe)

- Delete dead CloseOutCard.tsx (manager-app/src/components/dashboard/CloseOutCard.tsx:1-88) — no callers remain after Dashboard removal
- Remove the unused peekHeight?: number from BottomSheetProps (manager-app/src/components/ui/BottomSheet.tsx:10-13)
- Drop the export keyword on DEV_AUTH_FLAG (manager-app/src/lib/devAuth.ts:21) — only used internally
- Add aria-label="Close" to the ShiftModal X button (manager-app/src/pages/Schedule.tsx:191)
- Add aria-label="Search images" and type="search" to the ImageLibrary search input (manager-app/src/components/editor/ImageLibrary.tsx:99-105)
- Wrap _bareye_creds() file read in a `with open(...)` context manager (manager-app/bridge/bar_busyness.py:45-52)
- Replace aria-label={title} with id+aria-labelledby on BottomSheet dialog (manager-app/src/components/ui/BottomSheet.tsx:245-248) to stop double-announce
- Narrow Dashboard's useDemandLog to `const { accuracy } = useDemandLog()` (manager-app/src/pages/Dashboard.tsx:42,121)
- Change ShortcutsSheet's `setOpen((v) => !v)` to `setOpen(true)` (manager-app/src/components/ShortcutsSheet.tsx:36)
- Add `.limit(200)` to useSocialPosts main query (manager-app/src/hooks/useSocialPosts.ts:73)
- Add `.slice(0, 200)` to the realtime INSERT handlers in useReviews and useMessages (useReviews.ts:71,101; useMessages.ts:46)
- Add the naturalWidth guard to the decode() resolve path in exportToCanvas.ts:394
- Migrate the four hooks (useLuna/useLunaChronicle/useParties/useWeatherWatch) to import uniqueTopic from lib/realtimeTopic and delete local copies
