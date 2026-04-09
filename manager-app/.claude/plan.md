# Plan: Background-as-Layer + Library for Image Layers

## Problem Summary
1. **Background photo isn't a layer** — once set, you can't move, resize, crop, or apply per-layer blend modes to it. It's a fixed `object-fit: cover` image with only global filters.
2. **Image Library only sets backgrounds** — the `onSelect` callback does `SET_BACKGROUND`. There's no way to pick a Supabase photo and insert it as a movable/resizable image layer.

---

## Fix 1: Library Works for Both Backgrounds AND Image Layers

**Approach:** Add a `mode` prop to `ImageLibrary` — `'background' | 'layer'`. When mode is `'layer'`, selecting a photo creates an image layer instead of setting background.

### Changes:

**ImageLibrary.tsx**
- Add `mode?: 'background' | 'layer'` prop (default `'background'`)
- Header shows "Set Background" vs "Add Image Layer" based on mode
- `onSelect` behavior stays the same — the parent decides what to do with the URL

**SpecialEditor.tsx**
- Add `libraryMode` state: `'background' | 'layer'`
- `handleLibrarySelect` checks mode:
  - `'background'` → `dispatch({ type: 'SET_BACKGROUND', url })`
  - `'layer'` → `addTextLayer({ elementType: 'image', imageSrc: url, ... })` (fetch image dimensions first)
- Wire MobileToolbar's `onOpenLibrary` to set mode `'background'`
- Add new callback for "Library" option inside the Add menu that sets mode `'layer'`

**MobileToolbar.tsx**
- Add "From Library" button in the Add menu (below "Image Layer")
- Calls `onAddImageFromLibrary()` → opens library in layer mode

---

## Fix 2: Background Photo Becomes a Layer

**Approach:** Instead of completely rearchitecting, add a **"Convert to Layer"** button when a background is set. This turns the background image into an image layer at position (0,0) at full canvas size, then clears the background image. The user gets full layer controls (move, resize, blend, per-layer filters).

### Why not make background always a layer?
- The current background has special rendering (object-fit: cover, fills canvas, renders behind everything)
- Templates, drafts, and export all depend on `state.backgroundImage` being separate
- A "convert" approach is simpler, less risky, and gives the user a clear choice

### Changes:

**SpecialEditor.tsx**
- Add `handleConvertBgToLayer` function:
  1. Get current `state.backgroundImage` URL
  2. Fetch image natural dimensions
  3. Calculate layer dimensions to fill canvas (maintaining aspect ratio)
  4. Call `addTextLayer({ elementType: 'image', imageSrc: url, width, imageHeight, x, y })`
  5. Copy current `state.imageFilters` to the new layer's `imageFilters`
  6. `dispatch({ type: 'SET_BACKGROUND', url: null })` to clear background
  7. `dispatch({ type: 'RESET_IMAGE_FILTERS' })` to clear background filters
  8. Toast: "Background converted to layer — you can now move, resize, and blend it"

**MobileToolbar.tsx (or MobileFilterBar.tsx)**
- When background is set, show a small "Convert to Layer" button in the More menu or Adjustments panel
- Icon: `Layers` or `Ungroup`

**ImageAdjustments.tsx**
- Add "Convert to Layer" button below the filter presets section
- Only visible when `hasBackground` is true

---

## Implementation Order
1. Library mode prop + layer creation from library URL
2. MobileToolbar "From Library" button in Add menu
3. "Convert to Layer" functionality
4. Wire up "Convert to Layer" in both mobile and desktop UIs

## Files Modified
- `src/components/editor/ImageLibrary.tsx` (mode prop, header text)
- `src/components/editor/MobileToolbar.tsx` (From Library button, Convert to Layer in More menu)
- `src/components/editor/ImageAdjustments.tsx` (Convert to Layer button)
- `src/pages/SpecialEditor.tsx` (library mode state, handlers, convert function)

## Risk Assessment
- **Low risk**: Library mode change is additive, doesn't break existing flow
- **Low risk**: Convert-to-layer is a one-time operation, easily undoable via Ctrl+Z
- **No migration needed**: Existing drafts/templates continue working as-is
