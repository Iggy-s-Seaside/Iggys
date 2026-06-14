# Anton Mode — Mobile Optimization Pass (2026-06-14)

A 40-agent audit (2 mobile-design researchers + 37 per-page code auditors + 1 synthesizer)
swept every routed manager page against a mobile-first rubric, targeting a 375px iPhone
and iPad-portrait, used one-handed behind the bar. Findings: **5 critical, 72 high, 84
medium, 72 low.** This doc records what shipped and the remaining polish backlog.

## Root-cause themes — fixed once, applied app-wide

These live in `src/index.css` + shared primitives and resolve the bulk of the findings:

- **iOS auto-zoom on input focus** — `.input-field` was `text-sm` (14px); any focused
  field <16px makes Safari zoom-and-pan. → `text-base sm:text-sm`; plus the ≤768px
  `font-size:16px` guard now covers `date`/`time`/`datetime-local`/`password` types that
  were slipping through. (~20 findings across nearly every form/search box.)
- **Sub-44px touch targets** — shared `.btn` had no min-height. → added `min-h-[44px]`
  to `.btn`, so every button clears the touch floor regardless of `py-1.5`/`text-xs`
  overrides. `Select` manager trigger `min-h-[42px]`→`min-h-[44px]`.
- **No pressed feedback on touch** — controls only had `hover:` (never fires on touch).
  → `.btn` gets `active:scale-[0.98]`; `.btn-primary/secondary/ghost/danger` get
  `active:` background states.
- **`vh` instead of `dvh`** — mobile Safari's dynamic chrome makes `vh` mis-measure,
  clipping modal footers + full-height pages. → swept all `max-h-[NNvh]`/`100vh`/
  `min-h-screen` → `dvh` / `min-h-[100dvh]` across 13 files (desktop-only `h-screen` left).
- **Hover-only reveal = action impossible on touch** — image-remove X and media-card
  actions were `opacity-0 group-hover` → always visible on touch.

## Criticals — content/actions silently clipped off-screen (all fixed)

1. **CloseOut till-count rows** (`CloseOut.tsx` DenomRow) — ~368px of fixed columns in a
   ~287px card clipped the line-total + stepper on every denomination. → responsive
   widths (`w-12 sm:w-16`), `gap-2 sm:gap-3`, total `min-w-0 flex-1` instead of `w-24`.
2. **Messages — Send Reply unreachable** — wrapper `h-[calc(100vh-3rem)] -m-6` only
   cancelled horizontal shell padding, not the 4rem/6.5rem vertical, burying the composer
   behind the nav. → sized to the shell content box with `dvh` + safe-area, mobile-only.
3. **SpecialEditor MobileToolbar — Save clipped** — 8–9 × 48px buttons overflowed 375px,
   pushing Save off-screen. → Save+More pinned right (`shrink-0`), other tools scroll
   horizontally in the remaining space. Save can never be clipped.
4. **Events table** — `Add to Calendar` (full text) + Edit + Delete clipped the action
   column. → calendar button icon-only on phone; action buttons 44px.
5. **Cogs tables** (Menu Profitability + Purchase Orders) + **Compliance Credentials
   table** — raw `<table>` in `overflow-hidden` cards clipped action/name columns. →
   `overflow-x-auto overscroll-x-contain` + `min-w-[480px]`; action buttons 44px.

Plus: Messages header action row (icon-only + flex-wrap), Waitlist Seat emphasized to
48px, InventoryCount last-row clearance (`pb` clears reconcile bar + nav + safe-area),
ShiftLog 86-sheet (`dvh` + safe-area + removed autoFocus so the keyboard stops covering
the list), count steppers (ScanReview + Merch variant) bumped 28–36px → 44px, EventForm
+ Cogs recipe form grids stack to 1-col on phone, modal close-X buttons → 44px (×6).

## Verified live (Firefox @ 500×689 phone layout, harness)

- Scroll works end-to-end; **no rubber-band at top or bottom** (overscroll-behavior fix);
  fixed header + bottom nav stay put; footers clear the nav.
- Dashboard, Help, Schedule, Inventory, Compliance, Pipeline, Messages (list + detail)
  render clean with no horizontal cut-off. Messages detail pane is bounded — content sits
  above the nav, body scrolls, composer reachable.

Also shipped this pass: **PWA chunk-mismatch self-heal** (`main.tsx` `vite:preloadError`
handler) — after a deploy, an old tab navigating to a lazy route (Pipeline, etc.) no longer
crashes the ErrorBoundary; it reloads once and the network-first SW serves fresh chunks.

## Remaining polish backlog (lower-impact; not blocking)

- **RunOfShow reorder** (`RunOfShow.tsx`) — HTML5 drag is unreliable on iOS; add explicit
  Move-up/down 44px buttons as a touch fallback.
- **Todos priority on phone** (`Todos.tsx`) — the priority `<select>` is `hidden sm:block`;
  expose it on phone (tap chip → bottom-sheet Select).
- **Top-right create CTAs** (Menu/Media/Events/Parties/Social/Reputation/Marketing/
  Inventory/Schedule) — reachable but in the cold zone; optional `sm:hidden` FAB.
- **Calendar** month-grid chips/nav arrows → bigger tap targets + `gap`.
- **Destructive-adjacency** undo toasts on the few immediate-fire deletes (Todos, Schedule
  tip-pool, PartyInvoice line, PartyProfile revoke).
- **Glanceability** — bump fixed `text-[10px]/[11px]` labels to `text-xs` in dim light.
- **Horizontal-scroller polish** — `overscroll-x-contain` + edge-peek on Pipeline board.

Full raw findings (per-page, with file:line) were produced by the audit workflow
(`docs/_wf_mobile_audit.js`).
