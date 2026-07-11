import { useRef, useCallback, useEffect, useState } from 'react';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;

/**
 * Post-pan clamp for one axis, in two regimes:
 *  - canvas FITS in the viewport (scaled ≤ viewport): keep it fully inside
 *    ([0, viewport − scaled]).
 *  - canvas LARGER than viewport (zoomed in): keep ≥25% on screen
 *    ([viewport − 0.75·scaled, 0.25·scaled]).
 * The old single-regime margin math inverted (min > max) whenever the canvas
 * fit inside the viewport, so Math.max(min, …) slammed the pan to
 * `viewport − 0.75·scaled` — the canvas jumped to the bottom-right corner on
 * any background click. That was the owner-reported "canvas moves to the
 * bottom corner" bug. Exported for tests.
 */
export function clampPanAxis(pan: number, viewport: number, scaled: number): number {
  if (scaled <= viewport) {
    return Math.max(0, Math.min(pan, viewport - scaled));
  }
  const margin = 0.25;
  return Math.max(viewport - scaled * (1 - margin), Math.min(pan, scaled * margin));
}

interface UseCanvasGesturesOptions {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  baseScale: number;
  canvasWidth: number;
  canvasHeight: number;
  hasSelectedElement: boolean;
  isEditing: boolean;
  onZoomChange?: (zoom: number) => void;
}

export function useCanvasGestures({
  viewportRef,
  contentRef,
  baseScale,
  canvasWidth,
  canvasHeight,
  hasSelectedElement,
  isEditing,
  onZoomChange,
}: UseCanvasGesturesOptions) {
  // Detect mobile via viewport width — matches the CSS md: breakpoint.
  // Touch-API detection is unreliable (some mobile browsers report no touch),
  // but screen width is the real constraint: small screens must never pan/zoom.
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // All animation state in refs for 60fps — NO useState during gestures
  const zoomRef = useRef(baseScale);
  const panXRef = useRef(0);
  const panYRef = useRef(0);

  // React state — only updated on gesture END or external changes
  const [currentZoom, setCurrentZoom] = useState(baseScale);
  const [currentPanX, setCurrentPanX] = useState(0);
  const [currentPanY, setCurrentPanY] = useState(0);
  const [isGesturing, setIsGesturing] = useState(false);

  // Direct DOM update — 60fps, zero re-renders
  const applyTransform = useCallback(() => {
    if (!contentRef.current) return;
    contentRef.current.style.transform =
      `translate(${panXRef.current}px, ${panYRef.current}px) scale(${zoomRef.current})`;
  }, [contentRef]);

  // Commit ref values to React state
  const commitToState = useCallback(() => {
    setCurrentZoom(zoomRef.current);
    setCurrentPanX(panXRef.current);
    setCurrentPanY(panYRef.current);
    onZoomChange?.(zoomRef.current);
  }, [onZoomChange]);

  // Center canvas in viewport
  const centerCanvas = useCallback((zoom: number) => {
    if (!viewportRef.current) return;
    // On mobile, CSS left/top handles centering — no transform translate needed.
    if (isMobile) {
      panXRef.current = 0;
      panYRef.current = 0;
      applyTransform();
      return;
    }
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    const scaledW = canvasWidth * zoom;
    const scaledH = canvasHeight * zoom;
    const px = (vw - scaledW) / 2;
    const py = (vh - scaledH) / 2;
    panXRef.current = px;
    panYRef.current = py;
    applyTransform();
  }, [viewportRef, canvasWidth, canvasHeight, applyTransform, isMobile]);

  // Keep refs to always-current functions (avoids stale closures in the effect below)
  const centerCanvasRef = useRef(centerCanvas);
  centerCanvasRef.current = centerCanvas;
  const commitToStateRef = useRef(commitToState);
  commitToStateRef.current = commitToState;

  // Sync base scale changes (window resize, canvas size change)
  useEffect(() => {
    zoomRef.current = baseScale;
    centerCanvasRef.current(baseScale);
    commitToStateRef.current();
  }, [baseScale, canvasWidth, canvasHeight]);

  // ══════════════════════════════════════════════════════════════════
  // Desktop pan refs (always declared to satisfy Rules of Hooks)
  // ══════════════════════════════════════════════════════════════════
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });

  // ══════════════════════════════════════════════════════════════════
  // Mobile two-finger pinch/pan refs (always declared — Rules of Hooks)
  // ══════════════════════════════════════════════════════════════════
  // Tracks the active touch pointers by id so we can detect a 2-finger gesture.
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Snapshot taken when the 2nd finger lands — the reference frame for the gesture.
  // anchorX/anchorY are the canvas-local point under the initial pinch midpoint; keeping
  // it under the moving midpoint is what makes the zoom feel anchored to the fingers.
  const pinchStartRef = useRef<{
    dist: number;
    contentLeft: number;
    contentTop: number;
    anchorX: number;
    anchorY: number;
    zoom: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Mobile pinch/pan via CAPTURE-phase native listeners on the viewport.
  // Capture phase is essential: layer elements call e.stopPropagation() on pointerdown
  // to claim a single-finger drag, which would otherwise hide the touch from a
  // bubble-phase handler. Capturing means we always see every touch pointer, so a
  // second finger reliably promotes the interaction to a two-finger pinch/pan.
  // Single-finger touches are never swallowed — we only act once two pointers are down.
  useEffect(() => {
    if (!isMobile) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return; // touch-only path
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Begin pinch when exactly two fingers are down.
      if (activePointersRef.current.size === 2) {
        const pts = Array.from(activePointersRef.current.values());
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        // Content rect already folds in CSS left/top + current pan + scale, so the
        // canvas-local anchor is exact without needing those values separately.
        const rect = contentRef.current?.getBoundingClientRect();
        const startZoom = zoomRef.current;
        const contentLeft = rect ? rect.left : 0;
        const contentTop = rect ? rect.top : 0;
        pinchStartRef.current = {
          dist: Math.hypot(dx, dy) || 1,
          contentLeft,
          contentTop,
          anchorX: (midX - contentLeft) / startZoom,
          anchorY: (midY - contentTop) / startZoom,
          zoom: startZoom,
          panX: panXRef.current,
          panY: panYRef.current,
        };
        setIsGesturing(true);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Only act on a true two-finger gesture — single touches fall through to layer drag.
      if (activePointersRef.current.size !== 2 || !pinchStartRef.current) return;

      // Prevent the browser's native page zoom/scroll while we drive the canvas.
      e.preventDefault();

      const pts = Array.from(activePointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy) || 1;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      const start = pinchStartRef.current;
      const newZoom = clampZoom(start.zoom * (dist / start.dist));

      // Solve pan so the start anchor (canvas-local) sits exactly under the CURRENT
      // midpoint at the new zoom. content-origin-screen = contentLeft - startPan + newPan,
      // and we want: midpoint = contentOriginScreen + newZoom * anchor.
      // This yields both the zoom-anchor AND the two-finger pan in one step.
      panXRef.current = start.panX + (midX - start.contentLeft) - newZoom * start.anchorX;
      panYRef.current = start.panY + (midY - start.contentTop) - newZoom * start.anchorY;
      zoomRef.current = newZoom;
      applyTransform();
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      activePointersRef.current.delete(e.pointerId);

      // Once we drop below two fingers, the pinch is over — commit and reset.
      if (activePointersRef.current.size < 2 && pinchStartRef.current) {
        pinchStartRef.current = null;
        setIsGesturing(false);
        commitToState();
      }
    };

    // Capture phase (true) + non-passive move so preventDefault works.
    viewport.addEventListener('pointerdown', onPointerDown, { capture: true });
    viewport.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
    viewport.addEventListener('pointerup', onPointerEnd, { capture: true });
    viewport.addEventListener('pointercancel', onPointerEnd, { capture: true });
    return () => {
      viewport.removeEventListener('pointerdown', onPointerDown, { capture: true } as EventListenerOptions);
      viewport.removeEventListener('pointermove', onPointerMove, { capture: true } as EventListenerOptions);
      viewport.removeEventListener('pointerup', onPointerEnd, { capture: true } as EventListenerOptions);
      viewport.removeEventListener('pointercancel', onPointerEnd, { capture: true } as EventListenerOptions);
      activePointersRef.current.clear();
      pinchStartRef.current = null;
    };
  }, [isMobile, viewportRef, contentRef, applyTransform, commitToState]);

  // Cumulative pointer travel for the active pan — lets us tell a real drag
  // from a plain click (a click must never move or clamp the canvas).
  const panTravelRef = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isMobile) return;
    if (isEditing) return;
    if (hasSelectedElement) return;
    if (e.pointerType === 'mouse') {
      isPanningRef.current = true;
      panTravelRef.current = 0;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      setIsGesturing(true);
    }
  }, [isMobile, hasSelectedElement, isEditing]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastPanPointRef.current.x;
    const dy = e.clientY - lastPanPointRef.current.y;
    panTravelRef.current += Math.abs(dx) + Math.abs(dy);
    panXRef.current += dx;
    panYRef.current += dy;
    lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    applyTransform();
  }, [applyTransform]);

  const handlePointerUp = useCallback(() => {
    if (!isPanningRef.current) return;
    isPanningRef.current = false;
    // A plain click (≲3px of travel) is not a pan — leave the canvas alone.
    if (panTravelRef.current > 3 && viewportRef.current) {
      const vw = viewportRef.current.clientWidth;
      const vh = viewportRef.current.clientHeight;
      panXRef.current = clampPanAxis(panXRef.current, vw, canvasWidth * zoomRef.current);
      panYRef.current = clampPanAxis(panYRef.current, vh, canvasHeight * zoomRef.current);
      applyTransform();
    }
    setIsGesturing(false);
    commitToState();
  }, [applyTransform, commitToState, viewportRef, canvasWidth, canvasHeight]);

  const handlePointerCancel = useCallback(() => {
    isPanningRef.current = false;
    setIsGesturing(false);
  }, []);

  // Desktop mouse wheel zoom
  useEffect(() => {
    if (isMobile) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      let newZoom = zoomRef.current * (1 + delta);
      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

      // Zoom toward cursor
      const rect = viewport.getBoundingClientRect();
      const vpX = e.clientX - rect.left;
      const vpY = e.clientY - rect.top;
      const canvasX = (vpX - panXRef.current) / zoomRef.current;
      const canvasY = (vpY - panYRef.current) / zoomRef.current;
      panXRef.current = vpX - canvasX * newZoom;
      panYRef.current = vpY - canvasY * newZoom;

      zoomRef.current = newZoom;
      applyTransform();
      commitToState();
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [isMobile, viewportRef, applyTransform, commitToState]);

  // On mobile, pinch/pan is driven by capture-phase native listeners (see effect above),
  // so no React viewport handlers are needed. Single-finger touches pass straight through
  // to layer drag.
  if (isMobile) {
    return {
      isMobile: true,
      currentZoom,
      currentPanX,
      currentPanY,
      isGesturing,
      viewportHandlers: {},
    };
  }

  return {
    isMobile: false,
    currentZoom,
    currentPanX,
    currentPanY,
    isGesturing,
    viewportHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
