---
name: test-editor
description: "Comprehensive hands-on testing of the Iggy's Manager App specials editor. Use this skill whenever the user asks to test the editor, QA the app, check for bugs, run a testing round, or verify features are working. Also use when the user says things like 'test it', 'check everything', 'make sure it works', 'run through the app', 'QA pass', or 'find bugs'. This skill emulates a real user interacting with the editor on a mobile phone — tapping buttons, adding elements, dragging things around, and checking that everything behaves correctly."
---

# Specials Editor — Comprehensive Test Suite

You are a meticulous QA tester with a keen eye for UX issues. Your job is to use the app exactly like a real person would on their iPhone — tapping through every feature, trying combinations that might break things, and documenting everything you find.

## Setup

1. **Start the dev server** (reuse if already running):
   ```
   preview_start(name: "manager")
   ```

2. **Set mobile viewport** to match iPhone testing:
   ```
   preview_resize(serverId, preset: "mobile")
   ```

3. **Navigate to the editor**:
   ```
   preview_eval(serverId, "window.location.href = '/specials/editor'")
   ```

4. **Wait for load**, then dismiss any draft restore prompt:
   ```
   preview_eval(serverId, `(()=>{
     const btns = document.querySelectorAll('button');
     for (const b of btns) {
       if (b.textContent?.trim() === 'Discard') { b.click(); return 'discarded'; }
     }
     return 'no draft prompt';
   })()`)
   ```

5. **Take a baseline screenshot** to confirm the canvas is visible and centered.

## Test Sequence

Work through each section below in order. After EVERY action, take a screenshot and evaluate what you see. If something looks wrong, note the bug immediately — don't skip past it.

### Phase 1: Element Creation & Centering

Add each element type one at a time via the Add menu. After each addition, close the properties sheet and verify:
- The element appears **centered** on the canvas (not off to one side)
- Selection handles are visible at all 4 corners + rotation handle on top
- The toolbar shows the correct contextual button ("Font" for text/divider, "Blend" for image)

**Elements to test** (click Add → each option):
1. Plain Text
2. Heading
3. Subtitle
4. Item
5. Price
6. CTA
7. Divider — specifically check that the "SECTION" label is centered, not floating off to one side
8. Image Layer — this opens a file picker which you can't interact with in preview. Instead, verify the menu item exists and is clickable. To test image layers programmatically, you can create one via eval:
   ```javascript
   // Find the React state dispatcher and add an image layer manually
   // This is a fallback since file picker can't be used in preview
   ```

After adding all elements, take a screenshot showing the full canvas with multiple elements.

### Phase 2: Selection & Manipulation

1. **Tap different elements** on the canvas to select them. Verify selection handles appear.
2. **Check the toolbar changes**: selecting a text layer should show "Font", selecting an image layer should show "Blend".
3. **Tap empty canvas area** to deselect. Verify handles disappear.

### Phase 3: Overlay Mutual Exclusion (Critical!)

This is where bugs have been found before. Test these combos:

1. Open **Font picker** → tap **Layers** → verify Font picker closes
2. Open **Font picker** → tap **Edit** → verify Font picker closes
3. Open **Font picker** → tap **More** → verify Font picker closes (no overlap!)
4. Open **Font picker** → tap **Add** → verify Font picker closes
5. Open **Layers** sheet → tap **Font** → verify Layers closes
6. Open **Edit** sheet → tap **Font** → verify Edit closes
7. Open **More** popover → tap **Add** → verify More closes (and vice versa)

For each test, take a screenshot AFTER the second action. If any overlay is still visible when it shouldn't be, that's a bug.

### Phase 4: Font Picker

With a text layer selected:
1. Open the Font picker overlay
2. Tap different font pills — verify the text on canvas changes font
3. Toggle **Bold** — verify text becomes bold
4. Toggle **Italic** — verify text becomes italic
5. Toggle **Underline** — verify underline appears
6. Close the font picker

### Phase 5: PropertyPanel (Edit Button)

Test the Edit button with different layer types selected:

**Text layer selected → tap Edit:**
- Should show: Text, Typography, Colors (with fill/stroke/opacity), Shadow, Position, Advanced, Delete
- Should NOT show: Image Filters, Blending, Fit

**Divider layer selected → tap Edit:**
- Should show: Label, Divider Line (color/thickness/opacity/gap/padding), Typography, Colors, Position, Delete
- Title should say "Divider Properties"

**Image layer selected → tap Edit:**
- Should show: Blending (blend mode grid + opacity), Image Filters (brightness/contrast/saturation/blur/overlay), Position (with Height slider), Delete
- Should NOT show: Text content, Typography, Colors, Shadow
- Title should say "Image Properties"

### Phase 6: Layers Panel

1. Open **Layers** from toolbar
2. Verify all added layers are listed with correct icons (T for text, — for divider)
3. Test **visibility toggle** (eye icon) — tap it and verify the element hides on canvas
4. Test **lock** — tap lock icon
5. Test **reorder** — tap up/down arrows
6. Test **duplicate** — tap copy icon, verify new layer appears
7. Test **delete** — tap trash icon, verify layer is removed

### Phase 7: More Menu

1. Open **More** from toolbar
2. Verify all options are present: Templates, Library, Upload, Adjustments, Size, BG, Undo, Redo, Export
3. Test **Size presets** — tap each (1:1, 4:5, 9:16, 16:9) and verify canvas shape changes
4. Test **BG color** — change the background color, verify canvas updates
5. Test **Undo/Redo** — verify buttons enable/disable correctly
6. Test **Adjustments** — verify filter bar overlay opens (if background is set)
7. Test **Templates** — verify template picker opens
8. Test **Library** — verify image library opens with photos
9. Test **Export** — verify export modal opens with format/quality options

### Phase 8: Save Flow

1. Tap **Save** in toolbar
2. Verify save modal opens with fields: Title, Description, Type (drink/food/seasonal), Price
3. Fill in test values
4. Verify the save button is present and clickable (don't actually save unless the user asked)

### Phase 9: Background & Filters

1. Open More → **Library**
2. Select a photo as background
3. Verify it fills the canvas
4. Open More → **Adjustments**
5. Try filter presets (Moody, Warm, Cool, etc.) — verify canvas updates in real-time
6. Expand a fine-tune slider (Brightness) — drag it and verify the background changes
7. Try the color overlay — pick a color and increase opacity
8. Reset filters — verify everything goes back to normal

### Phase 10: Canvas Stability

Throughout all testing, watch for:
- Canvas shifting or jumping when tapping elements
- Canvas going off-screen or becoming unreachable
- Elements flying off the canvas during resize
- Any touch causing unexpected zoom or pan

If the canvas ever becomes displaced, note it as a **P0 bug**.

## Reporting

After completing all phases, produce a structured report:

```markdown
# Editor Test Report — [date]

## Summary
- Total tests: X
- Passed: X
- Failed: X
- Warnings: X

## ✅ Working Correctly
- [List each feature that passed]

## ❌ Bugs Found
For each bug:
- **What**: Description
- **Steps to reproduce**: 1, 2, 3
- **Expected**: What should happen
- **Actual**: What actually happened
- **Severity**: P0 (blocking) / P1 (significant) / P2 (minor)
- **Screenshot**: [reference the screenshot taken]

## ⚠️ UX Issues
- [Issues that aren't bugs but feel wrong or confusing]

## 📋 Recommendations
- [Suggested improvements based on testing]
```

## Tips for Effective Testing

- **Take screenshots liberally** — they're your evidence. A screenshot before and after each action is ideal.
- **Try unexpected combos** — open things in weird orders, tap rapidly, try edge cases.
- **Think like a confused user** — what would someone's grandma try to do?
- **Check text content** — does the actual text on canvas match what's in the property panel?
- **Watch for z-index issues** — overlays should be above the canvas but below each other in the right order.
- **Note performance** — does anything feel slow or janky? Animations smooth?
