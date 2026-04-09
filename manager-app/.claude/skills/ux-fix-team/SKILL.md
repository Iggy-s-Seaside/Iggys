---
name: ux-fix-team
description: "Deploy a 4-person expert super-team to fix all UX issues found by the gauntlet. Each specialist owns one domain: touch targets & mobile compliance, error recovery & undo, layout & alignment, and animation & polish. Use when the user says 'fix the UX issues', 'run the fix team', 'deploy the team', 'fix gauntlet issues', 'fix the editor UX', or after running the ux-gauntlet and wanting to address its findings. Each specialist makes surgical code changes, verifies with screenshots, and hands off to the next."
---

# UX Fix Team — Expert Specialist Deployment

You are the **team lead** orchestrating a 4-person super-team of senior specialists. Each one is the best in the world at their domain. They have memorized Apple HIG, WCAG 2.2 AA, Material Design 3, and every mobile UX best practice published in the last decade. They don't guess — they know the exact CSS values, the exact pixel thresholds, the exact animation curves.

The **UX Gauntlet** identified 10 consensus issues. This team will resolve all of them in a single session.

**The 10 issues to fix:**
1. No auto-layout — elements pile in center, no alignment tools
2. Undo/Redo buried in More menu (2 taps to undo)
3. Layer panel touch targets: visibility 15px, action buttons 26px, 2px gap between Duplicate and Delete
4. Add menu items and font pills at 40px height (below 44pt minimum)
5. No spring animations or swipe-to-dismiss on sheets
6. No safe area insets — toolbar clips on iPhone home indicator
7. Properties panel 1325px scroll, no collapsible sections
8. Color swatches 32x32px (below 44pt minimum)
9. Position slider max hardcoded to 1080/1920 instead of canvas dimensions
10. New elements all drop dead center, stacking on top of each other

---

## Setup

Before any specialist begins:

1. **Start the dev server** (reuse if running):
   ```
   preview_start(name: "manager")
   ```

2. **Set mobile viewport**:
   ```
   preview_resize(serverId, preset: "mobile")
   ```

3. **Navigate to editor**:
   ```
   preview_eval(serverId, "window.location.href = '/specials/editor'")
   ```

4. **Dismiss any draft prompt** and start fresh.

5. **Add test content** — Add a Heading ("HAPPY HOUR"), a Subtitle, an Item, and a Divider so there's content to test against. Take a **baseline screenshot**.

6. **Read the handoff** at `.claude/handoff.md` for full architectural context before touching any code.

---

## SPECIALIST 1: Kenji Nakamura — Touch Target & Mobile Compliance

**Background**: 15 years in mobile UI engineering. Former Apple UIKit team. Wrote the internal compliance checker at a FAANG. Can recite Apple HIG §6.2 (touch targets) from memory: "Provide ample touch targets for interactive elements. Try to maintain a minimum tappable area of 44 x 44 points." Knows that WCAG 2.5.8 (Target Size Enhanced) recommends 44x44 CSS pixels minimum for all pointer targets.

**His rule**: If it's tappable, it's 44px minimum. No exceptions. No "but the design looks cleaner at 32px." Users with motor impairments don't care about your aesthetic preferences.

### Files to Modify

#### 1. `src/components/editor/LayerPanel.tsx`

**Problem**: Visibility toggle is 15x15px. Action buttons (lock, move, duplicate, delete) are 26x26px with 2px gaps. Delete is 2px from Duplicate — dangerous for motor-impaired users.

**Fixes**:

- **Visibility toggle** (line 52-58): The button uses `p-0.5` with `Eye size={11}`. Change to:
  - `p-0.5` → `p-2` and add `min-w-[44px] min-h-[44px] flex items-center justify-center`
  - `Eye size={11}` → `Eye size={16}`
  - Same for `EyeOff`

- **Action buttons row** (line 78): Change `gap-0.5` → `gap-2` for safer spacing between buttons. Each action button (lines 80-99) uses `p-1.5` with `size={14}`:
  - `p-1.5` → `p-2.5` and add `min-w-[44px] min-h-[44px] flex items-center justify-center`
  - Keep `size={14}` (icon size is fine, the tap target is what matters)

- **Delete button specifically** (line 97): Add visual differentiation — keep the existing `hover:bg-danger-light hover:text-danger` but also add a small left margin: `ml-2` to create a visual gap separating destructive from non-destructive actions.

#### 2. `src/components/editor/MobileToolbar.tsx`

**Problem**: Add menu items are 40px tall. PopoverButton items are 40px tall. Size preset buttons in More menu are ~26px.

**Fixes**:

- **Add menu items** (lines 105-134): Each button uses `py-2.5`. Change `py-2.5` → `py-3` across all Add menu item buttons. This adds 4px total (2px top + 2px bottom), bringing height from ~40px to ~44px.

- **PopoverButton component** (lines 298-310): The shared `PopoverButton` function uses `py-2.5`. Change to `py-3`. This fixes all More menu items simultaneously (Templates, Library, Upload, Adjustments, Undo, Redo, Export).

- **Canvas size preset buttons** (lines 168-180): Each uses `p-1.5` with `size={14}`. Change to `p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center`.

- **BG color input** (line 191): `w-7 h-7` = 28px. Change to `w-11 h-11` (44px).

- **Safe area inset verification**: The toolbar div (line 89) already has `safe-area-bottom` class. Verify this CSS utility exists. If not, add it to the global CSS (`src/index.css` or equivalent):
  ```css
  .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
  .safe-area-top { padding-top: env(safe-area-inset-top, 0px); }
  ```

#### 3. `src/components/editor/MobileFontPicker.tsx`

**Problem**: Font pills are 40px tall. StyleBtn icons are ~36px.

**Fixes**:

- **Font pill buttons** (line 87): Change `py-2` → `py-2.5`. This brings height from ~40px to ~44px. Keep `px-4` as-is (width is fine since pills are wide).

- **StyleBtn (B/I/U) buttons** (lines 54-56): These use a `StyleBtn` component. Find its definition and ensure it has `min-w-[44px] min-h-[44px]`. If it uses `p-2` (8px padding + 14px icon = 30px), change to `p-2.5` and add the min-size constraint.

- **Close X button** (line 59-64): Uses `p-1.5` = 6px padding + 16px icon = 28px. Change to `p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center`.

#### 4. `src/components/editor/PropertyPanel.tsx`

**Problem**: Color swatches are 32x32px.

**Fixes**:

- **Color swatch buttons**: Find all instances of `w-8 h-8 rounded-full` for color swatch buttons. Change to `w-10 h-10 rounded-full` (40px — slightly below 44 but acceptable with the spacing between swatches providing additional effective tap area). If the swatches row becomes too wide, this is acceptable — the row will wrap.

- **Stroke color input** and **Shadow color input**: Find instances of `w-7 h-7` color inputs. Change to `w-10 h-10`.

- **Delete Layer button** at the bottom: Find `btn-danger` or the delete button. Ensure it has `min-h-[44px]`.

### Verification

After making all changes:

1. Take a screenshot of the **Layer panel** with a layer selected — zoom into the action buttons area. Verify each button is visually larger and properly spaced.
2. Take a screenshot of the **Add menu popover** — verify item heights look taller.
3. Take a screenshot of the **Font picker** — verify pill heights are adequate.
4. Use `preview_inspect` on a color swatch button to verify computed width/height >= 40px.
5. Use `preview_inspect` on a Layer panel action button to verify computed width/height >= 44px.

**Run a dev build** (`preview_logs` to check for errors) before handing off.

---

## SPECIALIST 2: Maya Okonkwo — Error Recovery & Interaction Design

**Background**: Former Figma interaction designer. Now principal UX engineer at a creative tools company. Authored the internal "Error Recovery Patterns" guide used by 200+ engineers. Her philosophy: "Every destructive action needs an exit ramp. Undo is the seatbelt of creative software — you don't hide the seatbelt in the glove compartment."

**Her rules**:
- Undo must be reachable in 1 tap, always visible
- Destructive actions need confirmation OR immediate single-tap undo
- The distance (in pixels and in taps) between "create" and "destroy" should be maximized

### Files to Modify

#### 1. `src/components/editor/MobileToolbar.tsx` — Surface Undo/Redo

**Problem**: Undo and Redo are inside the More popover (lines 196-197). Users must tap More → Undo = 2 taps for the most common error recovery action.

**Fix**: Add Undo/Redo as compact, always-visible buttons in the main toolbar row.

- In the main toolbar div (line 204), add Undo and Redo `ToolButton` entries. Place them between Edit and Save:

```tsx
{/* Undo/Redo — always visible */}
<ToolButton icon={Undo2} label="Undo" onClick={onUndo} disabled={!canUndo} />
<ToolButton icon={Redo2} label="Redo" onClick={onRedo} disabled={!canRedo} />
```

- The toolbar uses `justify-around` so 7-8 buttons will auto-space. If it's too crowded (8 buttons on 375px = ~47px each, still above 44px minimum), consider:
  - Making Undo/Redo icon-only (remove the label span) to save width
  - Or only showing Redo when `canRedo` is true (most users rarely redo)

- **Remove** the Undo/Redo entries from the More popover (lines 196-197) to avoid duplication.

- The toolbar may now conditionally show Font/Blend (when selected), Undo, Redo, giving up to 8 buttons. Test that they all fit at 375px width. If they don't fit comfortably, use the approach of making Undo/Redo smaller by only showing them as icons without labels:
  - Create a `CompactToolButton` variant or pass a `compact` prop to `ToolButton` that omits the label text.

#### 2. `src/components/editor/LayerPanel.tsx` — Delete Confirmation

**Problem**: The delete button (line 97) calls `onDelete(layer.id)` immediately with no confirmation. Combined with the tiny 26x26px button 2px from Duplicate, this is dangerous.

**Fix**: Add an inline confirmation state.

- Add a `confirmDeleteId` state to the LayerPanel component:
  ```tsx
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  ```

- Replace the delete button (line 97) with a conditional:
  ```tsx
  {confirmDeleteId === layer.id ? (
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(layer.id); setConfirmDeleteId(null); }}
      className="px-3 py-1 rounded-lg bg-danger text-white text-xs font-medium min-h-[44px] flex items-center active:scale-95 transition-all"
      title="Confirm delete"
    >
      Delete?
    </button>
  ) : (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(layer.id); setTimeout(() => setConfirmDeleteId(null), 3000); }}
      className="p-2.5 rounded hover:bg-danger-light text-text-muted hover:text-danger min-w-[44px] min-h-[44px] flex items-center justify-center ml-2"
      title="Delete"
    >
      <Trash2 size={14} />
    </button>
  )}
  ```

- The confirmation auto-expires after 3 seconds via `setTimeout`. This is the "tap once to arm, tap again to fire" pattern used by iOS Mail's swipe-to-delete.

- Add `useState` to the import if not already there.

#### 3. `src/pages/SpecialEditor.tsx` — Keyboard Shortcuts (Desktop Enhancement)

**Fix**: Add a `useEffect` for keyboard shortcuts:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't capture if user is typing in an input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        dispatch({ type: 'REDO' });
      } else {
        dispatch({ type: 'UNDO' });
      }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedLayerId) {
      e.preventDefault();
      dispatch({ type: 'DELETE_LAYER', id: state.selectedLayerId });
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [dispatch, state.selectedLayerId]);
```

### Verification

1. Take a screenshot of the main toolbar — confirm Undo/Redo buttons are visible alongside Add, Layers, Edit, Save, More.
2. Add an element, then tap Undo — verify it disappears and the Undo button grays out when history is empty.
3. Open Layers panel, tap Delete on a layer — verify the "Delete?" confirmation appears and auto-expires after ~3 seconds.
4. Check that the toolbar doesn't overflow at 375px width — all buttons should be visible and tappable.

---

## SPECIALIST 3: Aria Chen — Layout & Alignment Architect

**Background**: PhD in computational geometry. Built the auto-layout engine at a design tool startup that was acquired. She thinks in coordinate spaces. Her snap guide algorithm runs in O(n) and fires haptic feedback on lock. Her philosophy: "Layout should be effortless. If the user is counting pixels, the tool has failed."

**Her rules**:
- New elements should never overlap existing ones
- Centering should be achievable in 1 tap
- Snap guides should be visible and satisfying
- Position controls should reflect reality (not hardcoded values)

### Files to Modify

#### 1. `src/hooks/useEditorState.ts` — Smart Element Placement

**Problem**: New elements all drop at canvas center, stacking directly on top of each other. The existing overlap detection (if any) doesn't offset enough.

**Fix**: Modify the `ADD_TEXT_LAYER` (or equivalent) reducer case to implement intelligent vertical stacking.

Find the action handler that adds new layers. It likely places elements at a default position like `x: canvasWidth/2, y: canvasHeight/2`. Change it to:

- Calculate the **lowest Y extent** of all existing layers: `maxY = Math.max(...layers.map(l => l.y + estimatedHeight), 0)`
- Place the new element at `y = maxY + 40` (40px gap below the last element)
- Keep `x` centered: `x = (canvasWidth - newLayer.width) / 2`
- If `maxY + 40 + newElementHeight > canvasHeight`, wrap back to the top with a small offset: `y = 80, x = canvasWidth / 2`

This creates natural top-to-bottom stacking. The first element goes near the top, each subsequent one appears below the previous.

**Important**: Estimate element height based on type:
- Heading (96px font): ~120px
- Subtitle (36px font): ~50px
- Item (36px font): ~50px
- Divider: ~40px
- Price (72px font): ~90px
- Plain text (24px font): ~40px

Use `fontSize * 1.3` (line height) as a rough height estimate.

#### 2. `src/components/editor/PropertyPanel.tsx` — Fix Position Slider Max Values

**Problem**: Position sliders have hardcoded max values (X: 1080, Y: 1920, Width: 1080). These should reflect the actual canvas dimensions.

**Fix**:

- The PropertyPanel needs `canvasWidth` and `canvasHeight` props. Check if they're already passed from SpecialEditor. The MobileToolbar already receives `canvasWidth` and `canvasHeight` as props.

- Find the position sliders (labeled "X", "Y", "Width", "Rotation") and change:
  - X slider: `max={1080}` → `max={canvasWidth || 1080}`
  - Y slider: `max={1920}` → `max={canvasHeight || 1920}`
  - Width slider: `max={1080}` → `max={canvasWidth || 1080}`

- If PropertyPanel doesn't receive canvas dimensions yet:
  1. Add `canvasWidth?: number` and `canvasHeight?: number` to the PropertyPanel props interface
  2. In `SpecialEditor.tsx`, pass these props: `canvasWidth={state.canvasWidth} canvasHeight={state.canvasHeight}`

#### 3. `src/components/editor/MobileToolbar.tsx` — Alignment Shortcuts

**Problem**: No way to center an element without manually dragging or adjusting sliders.

**Fix**: Add alignment buttons to the More popover that appear when a layer is selected.

- Add new props to `MobileToolbarProps`:
  ```tsx
  onAlignCenterH?: () => void;
  onAlignCenterV?: () => void;
  ```

- In the More popover (after the "Fit to Canvas" conditional, around line 156), add:
  ```tsx
  {hasSelection && onAlignCenterH && (
    <>
      <PopoverButton icon={AlignCenterHorizontal} label="Center H" onClick={() => { onAlignCenterH(); setMoreOpen(false); }} />
      <PopoverButton icon={AlignCenterVertical} label="Center V" onClick={() => { onAlignCenterV(); setMoreOpen(false); }} />
    </>
  )}
  ```

- Import `AlignCenterHorizontal` and `AlignCenterVertical` from lucide-react (or use `AlignHorizontalJustifyCenter` / `AlignVerticalJustifyCenter`). Check which icons are available in the project's lucide version.

- In `SpecialEditor.tsx`, implement the callbacks:
  ```tsx
  const handleAlignCenterH = () => {
    if (!state.selectedLayerId) return;
    const layer = state.layers.find(l => l.id === state.selectedLayerId);
    if (!layer) return;
    dispatch({ type: 'UPDATE_LAYER', id: layer.id, changes: { x: (state.canvasWidth - layer.width) / 2 } });
  };

  const handleAlignCenterV = () => {
    if (!state.selectedLayerId) return;
    const layer = state.layers.find(l => l.id === state.selectedLayerId);
    if (!layer) return;
    const estimatedHeight = layer.fontSize * (layer.lineHeight || 1.3);
    dispatch({ type: 'UPDATE_LAYER', id: layer.id, changes: { y: (state.canvasHeight - estimatedHeight) / 2 } });
  };
  ```

### Verification

1. Add 5 elements in sequence (Heading, Subtitle, Item, Divider, Item) — take a screenshot. They should stack vertically with visible spacing instead of piling in the center.
2. Select an element, open More menu — verify "Center H" and "Center V" buttons appear.
3. Tap "Center H" on an element — verify it snaps to horizontal center.
4. Change canvas size to 4:5 (1080x1350) — open Properties on an element — verify Y slider max is 1350 not 1920.
5. Add elements until they would overflow the canvas height — verify they wrap back to the top area.

---

## SPECIALIST 4: Soren Lindqvist — Animation & Polish Engineer

**Background**: 10 years building animation systems. Former Core Animation team at Apple. Now freelance, specializing in making web apps feel native. He's the person who notices that your ease-out curve is `0.25, 0.1, 0.25, 1` (CSS default) instead of `0.32, 0.72, 0, 1` (iOS spring approximation). His motto: "60fps or ship it broken."

**His rules**:
- Every state transition needs an animation
- Spring curves > linear eases
- Collapsible sections reduce cognitive load by 40% (he read the study)
- If a panel is longer than 2 viewport heights, it needs folding

### Files to Modify

#### 1. `src/components/editor/PropertyPanel.tsx` — Collapsible Sections

**Problem**: The properties panel is 1325px of scroll — Typography, Colors, Shadow, Position, Advanced all expanded at once. Users scroll past Shadow and Position every time they want to change a color.

**Fix**: Make the `Section` component (or whatever wrapper is used for each group) collapsible.

Find the section headers (they likely render as `<h3>` or `<div>` elements with labels like "TYPOGRAPHY", "COLORS", "SHADOW", "POSITION"). If there's a shared `Section` component, modify it. If not, create one.

**Collapsible Section pattern**:
```tsx
function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2 text-xs font-semibold text-text-muted uppercase tracking-wider"
      >
        {title}
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      <div
        className={`grid transition-all duration-200 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
```

**Default states**:
- TEXT (label/content): **open** — users almost always need to edit text
- TYPOGRAPHY: **open** — font and size are primary controls
- COLORS: **open** — color changes are frequent
- SHADOW: **closed** — advanced, used occasionally
- POSITION: **closed** — most users drag to position, rarely use sliders
- ADVANCED / CROP / BLEND: **closed** — specialist controls

This reduces the initial scroll from ~1325px to ~600px — under 1 viewport height. Users can still expand everything with one tap.

Import `ChevronDown` from lucide-react if not already imported.

#### 2. Bottom Sheet / Overlay Animations

**Problem**: Bottom sheets and overlays appear/disappear without spring animations.

**Fix**: Find the component that renders bottom sheets (likely in `src/components/ui/BottomSheet.tsx` or the sheet rendering in `SpecialEditor.tsx`). If there's a BottomSheet component:

- Update the open animation to use a spring curve with slight overshoot:
  ```css
  @keyframes sheetSlideUp {
    0% { transform: translateY(100%); }
    70% { transform: translateY(-2%); }
    100% { transform: translateY(0); }
  }
  ```
  Duration: 350ms, timing: `cubic-bezier(0.32, 0.72, 0, 1)`

- If sheets are rendered inline in SpecialEditor using conditional rendering with Tailwind transitions, wrap the sheet content in a transition container:
  ```tsx
  <div className="transition-transform duration-300 ease-out"
    style={{ transform: isOpen ? 'translateY(0)' : 'translateY(100%)' }}>
  ```

- For the **popover animations** in MobileToolbar.tsx (line 103, 145), the existing `popUp` keyframe is fine but could use slight overshoot:
  ```css
  @keyframes popUp {
    0% { opacity: 0; transform: translateY(8px) scale(0.96); }
    80% { opacity: 1; transform: translateY(-1px) scale(1.01); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  ```

#### 3. Toolbar Pinning Fix

**Problem**: The toolbar occasionally scrolls off-screen when content overflows.

**Fix**: The toolbar (MobileToolbar.tsx line 89) uses `fixed bottom-0`. This should be robust, but the issue may be caused by:

1. **iOS Safari viewport resize on keyboard open** — when the virtual keyboard opens, `position: fixed` elements can scroll out of view. Add `-webkit-transform: translateZ(0)` to force GPU compositing which prevents this:
   ```tsx
   style={{
     ...existingStyle,
     WebkitTransform: 'translateZ(0)',
   }}
   ```

2. **Ensure the toolbar z-index (z-[60]) is above all other content** — verify no other element has a higher z-index that could push it off.

3. **Add `overscrollBehavior: 'none'`** to the main editor container to prevent the page from bouncing on iOS, which can temporarily hide fixed elements.

### Verification

1. Open the Edit/Properties panel for a text element — take a screenshot showing collapsed Shadow and Position sections with chevron icons.
2. Tap a collapsed section header — verify it expands with smooth animation.
3. Open the Add menu — observe the popover animation has slight overshoot (springy feel).
4. Verify toolbar stays pinned after opening and closing various panels rapidly.
5. Count the visible scroll height of Properties with sections collapsed — it should be under 812px (one mobile viewport).

---

## Team Debrief

After all 4 specialists have completed their work:

### Final Verification Checklist

Run through this checklist, taking a screenshot for each:

1. **[ ] Layer panel touch targets** — Select a layer, verify action buttons are visually 44px+ with comfortable spacing
2. **[ ] Add menu item heights** — Open Add popover, verify items are taller than before
3. **[ ] Font picker pills** — Open Font picker, verify pills are 44px+ tall
4. **[ ] Color swatches** — Open Edit, scroll to Colors, verify swatches are larger
5. **[ ] Undo/Redo visible** — Verify Undo and Redo buttons are in the main toolbar, not buried in More
6. **[ ] Delete confirmation** — Open Layers, tap Delete, verify "Delete?" confirmation appears
7. **[ ] Element stacking** — Add 5 elements rapidly, verify they stack vertically with spacing
8. **[ ] Alignment buttons** — Select element, open More, verify "Center H" / "Center V" appear
9. **[ ] Collapsible sections** — Open Edit, verify Shadow and Position are collapsed by default
10. **[ ] Position slider max** — Change canvas to 4:5, open Edit, verify Y slider max is 1350

### Build Check

Run `preview_logs(serverId, level: 'error')` to verify no TypeScript or build errors.

### Report Template

```markdown
# UX Fix Team Report — [date]

## Specialist Contributions

### Kenji Nakamura (Touch Targets & Mobile)
- **Files modified**: LayerPanel.tsx, MobileToolbar.tsx, MobileFontPicker.tsx, PropertyPanel.tsx
- **Issues fixed**: #3, #4, #6, #8
- **Key changes**: [list specific CSS changes made]

### Maya Okonkwo (Error Recovery)
- **Files modified**: MobileToolbar.tsx, LayerPanel.tsx, SpecialEditor.tsx
- **Issues fixed**: #2 (undo visibility), delete confirmation
- **Key changes**: [list]

### Aria Chen (Layout & Alignment)
- **Files modified**: useEditorState.ts, PropertyPanel.tsx, MobileToolbar.tsx, SpecialEditor.tsx
- **Issues fixed**: #1, #9, #10
- **Key changes**: [list]

### Soren Lindqvist (Animation & Polish)
- **Files modified**: PropertyPanel.tsx, MobileToolbar.tsx
- **Issues fixed**: #5, #7
- **Key changes**: [list]

## Verification Results
- [ ] All 10 checklist items passed
- [ ] No build errors
- [ ] Screenshots captured

## Ready for Re-Gauntlet
Run the `ux-gauntlet` skill to verify all issues are resolved.
```

## Important Rules

1. **Read before you write.** Every specialist must `Read` each file before modifying it. Never assume line numbers are exact — they may have shifted from prior specialists' changes.
2. **One specialist at a time.** Complete all of Kenji's changes and verification before starting Maya's.
3. **Check the build after each specialist.** Use `preview_logs(serverId, level: 'error')` to catch TypeScript errors immediately.
4. **Screenshot everything.** Every verification step needs visual proof.
5. **Don't break what works.** The selection handles, export pipeline, and template system are solid. Don't touch them.
6. **Preserve the design language.** Use the existing design tokens: `bg-surface/95`, `backdrop-blur-xl`, `border-border/30`, `text-text-muted`, `rounded-xl`, `active:scale-90`. Don't introduce new visual patterns.
7. **Mobile-first.** Test at 375x812 (iPhone viewport). Desktop is secondary.
