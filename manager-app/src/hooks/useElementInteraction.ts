import { useRef, useCallback, useState } from 'react';
import type { TextLayer } from '../types';

const SNAP_THRESHOLD = 5;
const DRAG_DELAY = 40;
const TAP_DISTANCE = 5;
const ROTATION_SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315, 360];
const ROTATION_SNAP_THRESHOLD = 5;

interface SnapLines {
  x: number[];
  y: number[];
}

interface UseElementInteractionOptions {
  layers: TextLayer[];
  selectedLayerId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  contentRef: React.RefObject<HTMLDivElement | null>;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, changes: Partial<TextLayer>) => void;
  onLayerTapped?: (layer: TextLayer) => void;
  onEnterEditMode?: (layerId: string) => void;
  onTripleTap?: (layerId: string) => void;
}

type DragState =
  | { type: 'pending'; id: string; startX: number; startY: number; startTime: number }
  | { type: 'move'; id: string; offsetX: number; offsetY: number; currentX: number; currentY: number }
  | { type: 'resize'; id: string; handle: string; startX: number; startY: number; startWidth: number; startHeight: number; startFontSize: number; startImageHeight: number; isImage: boolean; startLayerX: number; startLayerY: number; currentWidth: number; currentFontSize: number; currentImageHeight: number; currentLayerX: number; currentLayerY: number }
  | { type: 'rotate'; id: string; centerX: number; centerY: number; startAngle: number; currentRotation: number }
  | null;

function estimateHeight(layer: TextLayer): number {
  if (layer.elementType === 'image') {
    return layer.imageHeight || layer.width; // Images have explicit height
  }
  const lines = layer.text.split('\n');
  const lineHeight = layer.fontSize * 1.3;
  return lines.length > 1 ? (lines.length - 1) * lineHeight + layer.fontSize : layer.fontSize;
}

/** Find the DOM element for a layer by data attribute */
function findLayerElement(contentRef: React.RefObject<HTMLDivElement | null>, layerId: string): HTMLElement | null {
  if (!contentRef.current) return null;
  return contentRef.current.querySelector(`[data-layer-id="${layerId}"]`);
}

/** Apply transform directly to DOM element — zero re-renders */
function applyPositionToDOM(el: HTMLElement, x: number, y: number, rotation?: number) {
  el.style.transform = `translate(${x}px, ${y}px)${rotation ? ` rotate(${rotation}deg)` : ''}`;
}

/** Move the selection overlay to match a layer's current visual position */
function syncSelectionOverlay(contentRef: React.RefObject<HTMLDivElement | null>, x: number, y: number, width: number, height: number, rotation: number) {
  if (!contentRef.current) return;
  const overlay = contentRef.current.querySelector('[data-selection-overlay]') as HTMLElement | null;
  if (!overlay) return;
  const padding = 4;
  const boxW = width + padding * 2;
  const boxH = height + padding * 2;
  overlay.style.width = `${boxW}px`;
  overlay.style.height = `${boxH}px`;
  overlay.style.transform = `translate(${x - padding}px, ${y - padding}px)${rotation !== 0 ? ` rotate(${rotation}deg)` : ''}`;
}

export function useElementInteraction({
  layers,
  selectedLayerId,
  canvasWidth,
  canvasHeight,
  zoom,
  contentRef,
  onSelectLayer,
  onUpdateLayer,
  onLayerTapped,
  onEnterEditMode,
  onTripleTap,
}: UseElementInteractionOptions) {
  const dragRef = useRef<DragState>(null);
  // Snap lines: ref for 60fps updates, state for React render on commit
  const snapLinesRef = useRef<SnapLines>({ x: [], y: [] });
  const [snapLines, setSnapLines] = useState<SnapLines>({ x: [], y: [] });
  const lastElementTapRef = useRef<{ layerId: string; time: number; count: number }>({ layerId: '', time: 0, count: 0 });

  // Convert client coordinates to canvas coordinates
  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    if (!contentRef.current) return { x: 0, y: 0 };
    const rect = contentRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }, [contentRef, zoom]);

  // Calculate snap guides (ported from Canvas.tsx)
  const calcSnapLines = useCallback((movingId: string, newX: number, newY: number, width: number, fontSize: number): SnapLines => {
    const xSnaps: number[] = [];
    const ySnaps: number[] = [];

    const movingCenterX = newX + width / 2;
    const movingCenterY = newY + fontSize / 2;
    const movingRight = newX + width;

    // Snap to canvas center
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    if (Math.abs(movingCenterX - canvasCenterX) < SNAP_THRESHOLD) xSnaps.push(canvasCenterX);
    if (Math.abs(movingCenterY - canvasCenterY) < SNAP_THRESHOLD) ySnaps.push(canvasCenterY);

    // Snap to canvas edges
    if (Math.abs(newX) < SNAP_THRESHOLD) xSnaps.push(0);
    if (Math.abs(movingRight - canvasWidth) < SNAP_THRESHOLD) xSnaps.push(canvasWidth);

    // Snap to other layers
    for (const layer of layers) {
      if (layer.id === movingId) continue;
      const lCenterX = layer.x + layer.width / 2;
      const lCenterY = layer.y + layer.fontSize / 2;

      if (Math.abs(movingCenterX - lCenterX) < SNAP_THRESHOLD) xSnaps.push(lCenterX);
      if (Math.abs(movingCenterY - lCenterY) < SNAP_THRESHOLD) ySnaps.push(lCenterY);
      if (Math.abs(newX - layer.x) < SNAP_THRESHOLD) xSnaps.push(layer.x);
      if (Math.abs(movingRight - (layer.x + layer.width)) < SNAP_THRESHOLD) xSnaps.push(layer.x + layer.width);
    }

    return { x: xSnaps, y: ySnaps };
  }, [layers, canvasWidth, canvasHeight]);

  /** Update snap line DOM elements directly (avoid React re-render during drag) */
  const updateSnapLinesDOM = useCallback((snaps: SnapLines) => {
    snapLinesRef.current = snaps;
    // We still need React to render snap lines, but throttle to avoid per-frame re-renders
    // Only update state if snap lines actually changed
    setSnapLines(prev => {
      if (prev.x.length === snaps.x.length && prev.y.length === snaps.y.length &&
          prev.x.every((v, i) => v === snaps.x[i]) && prev.y.every((v, i) => v === snaps.y[i])) {
        return prev; // Same reference = no re-render
      }
      return snaps;
    });
  }, []);

  // Element pointer down — select and start potential drag
  const handleElementPointerDown = useCallback((e: React.PointerEvent, layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    e.stopPropagation(); // Prevent canvas pan

    // Multi-tap detection: double-tap = edit mode, triple-tap = fit to canvas
    const now = Date.now();
    const prev = lastElementTapRef.current;
    const isSameLayer = layerId === prev.layerId;
    const isQuick = now - prev.time < 400;

    if (isSameLayer && isQuick && !layer.locked) {
      const newCount = prev.count + 1;
      if (newCount >= 3) {
        // Triple-tap → fit to canvas (for image/video layers)
        lastElementTapRef.current = { layerId: '', time: 0, count: 0 };
        if ((layer.elementType === 'image' || layer.elementType === 'video') && onTripleTap) {
          onTripleTap(layerId);
          return;
        }
      } else if (newCount === 2) {
        // Double-tap → enter edit mode (for text layers)
        lastElementTapRef.current = { layerId, time: now, count: newCount };
        if (layerId === selectedLayerId) {
          onEnterEditMode?.(layerId);
          return;
        }
      } else {
        lastElementTapRef.current = { layerId, time: now, count: newCount };
      }
    } else {
      lastElementTapRef.current = { layerId, time: now, count: 1 };
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    onSelectLayer(layerId);
    onLayerTapped?.(layer);

    if (layer.locked) return;

    const { x, y } = clientToCanvas(e.clientX, e.clientY);

    dragRef.current = {
      type: 'pending',
      id: layerId,
      startX: x,
      startY: y,
      startTime: performance.now(),
    };

    // Haptic on select
    if ('vibrate' in navigator) navigator.vibrate(10);

    // Listen for global move/up on this pointer
    const onMove = (me: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const { x: cx, y: cy } = clientToCanvas(me.clientX, me.clientY);

      if (drag.type === 'pending') {
        const dist = Math.hypot(cx - drag.startX, cy - drag.startY);
        const elapsed = performance.now() - drag.startTime;
        if (dist > TAP_DISTANCE || elapsed > DRAG_DELAY) {
          // Transition to move
          dragRef.current = {
            type: 'move',
            id: drag.id,
            offsetX: layer.x - cx,
            offsetY: layer.y - cy,
            currentX: layer.x,
            currentY: layer.y,
          };
        }
        return;
      }

      if (drag.type === 'move') {
        const newX = Math.round(cx + drag.offsetX);
        const newY = Math.round(cy + drag.offsetY);

        const snaps = calcSnapLines(drag.id, newX, newY, layer.width, layer.fontSize);
        updateSnapLinesDOM(snaps);

        // Snap apply
        let finalX = newX;
        let finalY = newY;
        if (snaps.x.length > 0) {
          const centerX = newX + layer.width / 2;
          for (const sx of snaps.x) {
            if (Math.abs(centerX - sx) < SNAP_THRESHOLD) {
              finalX = sx - layer.width / 2;
              break;
            }
            if (Math.abs(newX - sx) < SNAP_THRESHOLD) {
              finalX = sx;
              break;
            }
          }
          // Haptic on snap
          if ('vibrate' in navigator) navigator.vibrate([5, 5, 5]);
        }

        // Clamp to canvas bounds — keep element fully within canvas
        const height = estimateHeight(layer);
        finalX = Math.max(0, Math.min(finalX, canvasWidth - layer.width));
        finalY = Math.max(0, Math.min(finalY, canvasHeight - height));

        // Direct DOM update — no React re-render
        const el = findLayerElement(contentRef, drag.id);
        if (el) {
          applyPositionToDOM(el, finalX, finalY, layer.rotation || undefined);
        }

        // Keep selection overlay in sync during drag
        syncSelectionOverlay(contentRef, finalX, finalY, layer.width, height, layer.rotation || 0);

        // Store current position for commit on pointerup
        drag.currentX = finalX;
        drag.currentY = finalY;
      }

      // Note: resize and rotate are handled exclusively by handleHandlePointerDown.
      // This handler only creates 'pending' or 'move' drag states.
    };

    const onUp = () => {
      const drag = dragRef.current;

      // Commit final position to React state
      if (drag?.type === 'move') {
        onUpdateLayer(drag.id, { x: drag.currentX, y: drag.currentY });
      }

      dragRef.current = null;
      snapLinesRef.current = { x: [], y: [] };
      setSnapLines({ x: [], y: [] });
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [layers, selectedLayerId, clientToCanvas, contentRef, onSelectLayer, onUpdateLayer, onLayerTapped, onEnterEditMode, calcSnapLines, updateSnapLinesDOM, canvasWidth, canvasHeight]);

  // Handle pointer down on a selection handle
  const handleHandlePointerDown = useCallback((e: React.PointerEvent, handle: string) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const layer = layers.find(l => l.id === selectedLayerId);
    if (!layer || layer.locked) return;

    const { x, y } = clientToCanvas(e.clientX, e.clientY);

    if (handle === 'rotate') {
      const h = estimateHeight(layer);
      const centerX = layer.x + layer.width / 2;
      const centerY = layer.y + h / 2;
      const startAngle = Math.atan2(y - centerY, x - centerX) * 180 / Math.PI - layer.rotation;

      dragRef.current = {
        type: 'rotate',
        id: layer.id,
        centerX,
        centerY,
        startAngle,
        currentRotation: layer.rotation,
      };
    } else {
      const startHeight = estimateHeight(layer);
      const isImage = layer.elementType === 'image';
      dragRef.current = {
        type: 'resize',
        id: layer.id,
        handle,
        startX: x,
        startY: y,
        startWidth: layer.width,
        startHeight,
        startFontSize: layer.fontSize,
        startImageHeight: layer.imageHeight || layer.width,
        isImage,
        startLayerX: layer.x,
        startLayerY: layer.y,
        currentWidth: layer.width,
        currentFontSize: layer.fontSize,
        currentImageHeight: layer.imageHeight || layer.width,
        currentLayerX: layer.x,
        currentLayerY: layer.y,
      };
    }

    // Same global listeners pattern — direct DOM during drag, commit on up
    const onMove = (me: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const { x: cx, y: cy } = clientToCanvas(me.clientX, me.clientY);

      if (drag.type === 'resize') {
        const deltaX = cx - drag.startX;
        const deltaY = cy - drag.startY;

        // Proportional resize using diagonal distance
        const isRight = drag.handle === 'ne' || drag.handle === 'se';
        const isBottom = drag.handle === 'se' || drag.handle === 'sw';
        const dirX = isRight ? 1 : -1;
        const dirY = isBottom ? 1 : -1;
        const diagLen = Math.sqrt(drag.startWidth * drag.startWidth + drag.startHeight * drag.startHeight);
        const normX = (drag.startWidth * dirX) / diagLen;
        const normY = (drag.startHeight * dirY) / diagLen;
        const projection = deltaX * normX + deltaY * normY;
        const scale = Math.max(0.1, (diagLen + projection) / diagLen);

        let newWidth = Math.max(50, Math.round(drag.startWidth * scale));
        const newFontSize = Math.max(8, Math.round(drag.startFontSize * scale));
        const newImageHeight = Math.max(30, Math.round(drag.startImageHeight * scale));

        newWidth = Math.max(50, Math.min(newWidth, canvasWidth));

        // For images, also limit height to canvas bounds
        let clampedImageHeight = newImageHeight;
        if (drag.isImage) {
          clampedImageHeight = Math.min(newImageHeight, canvasHeight);
        }

        let newX: number;
        let newY = drag.startLayerY;
        if (isRight) {
          newX = drag.startLayerX;
        } else {
          newX = Math.round(drag.startLayerX + (drag.startWidth - newWidth));
        }
        if (!isBottom) {
          const newHeight = drag.isImage ? clampedImageHeight : estimateHeight({ ...layer, fontSize: newFontSize });
          newY = Math.round(drag.startLayerY + (drag.startHeight - newHeight));
        }

        newX = Math.max(0, Math.min(newX, canvasWidth - newWidth));

        // Clamp Y to canvas bounds
        const finalHeight = drag.isImage ? clampedImageHeight : estimateHeight({ ...layer, fontSize: newFontSize });
        newY = Math.max(0, Math.min(newY, canvasHeight - finalHeight));

        const el = findLayerElement(contentRef, drag.id);
        if (el) {
          el.style.width = `${newWidth}px`;
          if (drag.isImage) {
            el.style.height = `${clampedImageHeight}px`;
          } else {
            el.style.fontSize = `${newFontSize}px`;
          }
          applyPositionToDOM(el, newX, newY, layer.rotation || undefined);
        }

        // Sync selection overlay during resize
        syncSelectionOverlay(contentRef, newX, newY, newWidth, finalHeight, layer.rotation || 0);

        drag.currentWidth = newWidth;
        drag.currentFontSize = newFontSize;
        drag.currentImageHeight = drag.isImage ? clampedImageHeight : newImageHeight;
        drag.currentLayerX = newX;
        drag.currentLayerY = newY;
      }

      if (drag.type === 'rotate') {
        const rawAngle = Math.atan2(cy - drag.centerY, cx - drag.centerX) * 180 / Math.PI;
        let angle = rawAngle - drag.startAngle;
        angle = ((angle % 360) + 360) % 360;

        for (const snap of ROTATION_SNAP_ANGLES) {
          if (Math.abs(angle - snap) <= ROTATION_SNAP_THRESHOLD) {
            angle = snap === 360 ? 0 : snap;
            if ('vibrate' in navigator) navigator.vibrate(10);
            break;
          }
        }

        const finalAngle = Math.round(angle);
        const el = findLayerElement(contentRef, drag.id);
        if (el) {
          applyPositionToDOM(el, layer.x, layer.y, finalAngle);
        }

        // Sync selection overlay rotation
        const h = estimateHeight(layer);
        syncSelectionOverlay(contentRef, layer.x, layer.y, layer.width, h, finalAngle);

        drag.currentRotation = finalAngle;
      }
    };

    const onUp = () => {
      const drag = dragRef.current;

      // Commit to React state
      if (drag?.type === 'resize') {
        const changes: Partial<TextLayer> = { width: drag.currentWidth, fontSize: drag.currentFontSize, x: drag.currentLayerX, y: drag.currentLayerY };
        if (drag.isImage) changes.imageHeight = drag.currentImageHeight;
        onUpdateLayer(drag.id, changes);
      } else if (drag?.type === 'rotate') {
        onUpdateLayer(drag.id, { rotation: drag.currentRotation });
      }

      dragRef.current = null;
      snapLinesRef.current = { x: [], y: [] };
      setSnapLines({ x: [], y: [] });
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [layers, selectedLayerId, clientToCanvas, contentRef, onUpdateLayer, canvasWidth, canvasHeight]);

  return {
    snapLines,
    handleElementPointerDown,
    handleHandlePointerDown,
  };
}
