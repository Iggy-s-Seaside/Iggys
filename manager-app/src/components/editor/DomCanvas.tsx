import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useEffect,
  memo,
} from 'react';
import type { EditorState, TextLayer } from '../../types';
import { BackgroundLayer } from './BackgroundLayer';
import { TextElement } from './TextElement';
import { DividerElement } from './DividerElement';
import { ImageElement } from './ImageElement';
import { VideoElement } from './VideoElement';
import { useVideoRefs } from '../../context/VideoRefContext';
import { SelectionOverlay } from './SelectionOverlay';
import { ZoomIndicator } from './ZoomIndicator';
import { exportToCanvas } from './exportToCanvas';
import { useCanvasGestures } from '../../hooks/useCanvasGestures';
import { useElementInteraction } from '../../hooks/useElementInteraction';

interface DomCanvasProps {
  state: EditorState;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, changes: Partial<TextLayer>) => void;
  zoomOverride?: number;
  onLayerTapped?: (layer: TextLayer) => void;
  onScaleChange?: (scale: number) => void;
  onGestureChange?: (active: boolean) => void;
  onTripleTap?: (layerId: string) => void;
}

export interface DomCanvasHandle {
  exportImage: (format?: string, quality?: number) => string | null;
  getVideoRefs: () => { getAll: () => Map<string, HTMLVideoElement>; seekAll: (time: number) => Promise<void>; hasVideos: () => boolean };
  getScale: () => number;
}

export const DomCanvas = memo(forwardRef<DomCanvasHandle, DomCanvasProps>(({
  state,
  onSelectLayer,
  onUpdateLayer,
  zoomOverride,
  onLayerTapped,
  onScaleChange,
  onGestureChange,
  onTripleTap,
}, ref) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const videoRefs = useVideoRefs();

  // Calculate fit scale on mount and resize
  const lastViewportDims = useRef({ w: 0, h: 0 });
  useEffect(() => {
    const calculate = () => {
      if (!viewportRef.current) return;
      const vw = viewportRef.current.clientWidth;
      const vh = viewportRef.current.clientHeight;
      // Guard against trivial resize events (e.g. overlay mount/unmount jitter)
      if (
        lastViewportDims.current.w > 0 &&
        Math.abs(vw - lastViewportDims.current.w) < 2 &&
        Math.abs(vh - lastViewportDims.current.h) < 2
      ) return;
      lastViewportDims.current = { w: vw, h: vh };
      const isMobile = vw < 768;
      // On mobile: minimal padding, account for toolbar overlay (60px)
      // On desktop: standard padding, fit both dimensions
      const padding = isMobile ? 8 : 16;
      const toolbarH = isMobile ? 60 : 0;
      const scaleX = (vw - padding) / state.canvasWidth;
      const scaleY = (vh - padding - toolbarH) / state.canvasHeight;
      // Fit canvas fully in the visible area (above toolbar on mobile)
      const newFit = Math.min(scaleX, scaleY, 1);
      setFitScale(newFit);
    };

    calculate();
    const observer = new ResizeObserver(calculate);
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [state.canvasWidth, state.canvasHeight]);

  // The effective base scale (fit or manual override)
  const baseScale = zoomOverride ?? fitScale;

  // Handle text editing (declared before hooks that reference it)
  const handleDoubleClick = useCallback((layerId: string) => {
    const layer = state.layers.find(l => l.id === layerId);
    if (layer && !layer.locked) {
      setEditingLayerId(layerId);
    }
  }, [state.layers]);

  // Gesture system for zoom/pan — uses contentRef for direct DOM transform
  const gestures = useCanvasGestures({
    viewportRef,
    contentRef,
    baseScale,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    hasSelectedElement: state.selectedLayerId !== null,
    isEditing: editingLayerId !== null,
    onZoomChange: onScaleChange,
  });

  // Element interaction (select, move, resize, rotate)
  const interaction = useElementInteraction({
    layers: state.layers,
    selectedLayerId: state.selectedLayerId,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    zoom: gestures.currentZoom,
    contentRef,
    onSelectLayer,
    onUpdateLayer,
    onLayerTapped,
    onEnterEditMode: handleDoubleClick,
    onTripleTap,
  });

  // Expose imperative handle for export
  useImperativeHandle(ref, () => ({
    exportImage: (format?: string, quality?: number) => {
      try {
        const canvas = exportToCanvas(state, videoRefs.getAll());
        const mimeType = format || 'image/png';
        return canvas.toDataURL(mimeType, quality ?? 0.92);
      } catch {
        return null;
      }
    },
    getVideoRefs: () => videoRefs,
    getScale: () => gestures.currentZoom,
  }), [state, gestures.currentZoom, videoRefs]);

  // Report scale changes
  useEffect(() => {
    onScaleChange?.(gestures.currentZoom);
  }, [gestures.currentZoom, onScaleChange]);

  // Report gesture state changes (for toolbar auto-hide)
  useEffect(() => {
    onGestureChange?.(gestures.isGesturing);
  }, [gestures.isGesturing, onGestureChange]);

  const handleTextCommit = useCallback((layerId: string, text: string) => {
    onUpdateLayer(layerId, { text });
  }, [onUpdateLayer]);

  const handleEditEnd = useCallback(() => {
    setEditingLayerId(null);
  }, []);

  // Deselect on background click
  const handleBackgroundPointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle direct clicks on the content div (not bubbled from elements)
    if (e.target === contentRef.current || (e.target as HTMLElement).dataset?.canvasBg !== undefined) {
      if (editingLayerId) {
        // Blur the contentEditable to trigger text commit before clearing edit state
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setEditingLayerId(null);
        return;
      }
      onSelectLayer(null);
    }
  }, [editingLayerId, onSelectLayer]);

  // Compute the final transform
  const zoom = gestures.currentZoom;
  const panX = gestures.currentPanX;
  const panY = gestures.currentPanY;

  // On mobile, compute centered position via CSS left/top instead of transform translate.
  // This makes it physically impossible for the canvas to fly off-screen.
  const isMobileView = gestures.viewportHandlers.onPointerDown === undefined; // mobile returns empty handlers

  // Mobile: calculate centered position using viewport dimensions
  const getMobilePosition = () => {
    if (!isMobileView || !viewportRef.current) return { left: 0, top: 4 };
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    const scaledW = state.canvasWidth * zoom;
    const scaledH = state.canvasHeight * zoom;
    const toolbarH = 60;
    const visibleH = vh - toolbarH;
    return {
      left: Math.max(0, (vw - scaledW) / 2),
      top: Math.max(4, (visibleH - scaledH) / 2),
    };
  };

  const mobilePos = isMobileView ? getMobilePosition() : null;

  return (
    <div
      ref={viewportRef}
      className="relative w-full h-full overflow-hidden bg-black/20"
      style={{ touchAction: 'none' }}
      {...gestures.viewportHandlers}
    >
      {/* Transformed canvas content */}
      <div
        ref={contentRef}
        className="absolute origin-top-left"
        style={
          isMobileView
            ? {
                width: state.canvasWidth,
                height: state.canvasHeight,
                left: mobilePos!.left,
                top: mobilePos!.top,
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
              }
            : {
                width: state.canvasWidth,
                height: state.canvasHeight,
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }
        }
        onPointerDown={handleBackgroundPointerDown}
      >
        {/* Background layer */}
        <BackgroundLayer
          backgroundColor={state.backgroundColor}
          backgroundGradient={state.backgroundGradient}
          backgroundOverlay={state.backgroundOverlay}
          backgroundImage={state.backgroundImage}
          imageFilters={state.imageFilters}
        />

        {/* Canvas elements */}
        {state.layers.map((layer) =>
          layer.elementType === 'divider' ? (
            <DividerElement
              key={layer.id}
              layer={layer}
              isSelected={layer.id === state.selectedLayerId}
              onPointerDown={interaction.handleElementPointerDown}
              zoom={zoom}
            />
          ) : layer.elementType === 'video' ? (
            <VideoElement
              key={layer.id}
              layer={layer}
              isSelected={layer.id === state.selectedLayerId}
              onPointerDown={interaction.handleElementPointerDown}
              zoom={zoom}
            />
          ) : layer.elementType === 'image' ? (
            <ImageElement
              key={layer.id}
              layer={layer}
              isSelected={layer.id === state.selectedLayerId}
              onPointerDown={interaction.handleElementPointerDown}
              zoom={zoom}
            />
          ) : (
            <TextElement
              key={layer.id}
              layer={layer}
              isSelected={layer.id === state.selectedLayerId}
              isEditing={layer.id === editingLayerId}
              onPointerDown={interaction.handleElementPointerDown}
              onTextCommit={handleTextCommit}
              onEditEnd={handleEditEnd}
              zoom={zoom}
            />
          )
        )}

        {/* Selection overlay (handles, guides) */}
        {state.selectedLayerId && !editingLayerId && (
          <SelectionOverlay
            layer={state.layers.find(l => l.id === state.selectedLayerId)!}
            canvasWidth={state.canvasWidth}
            canvasHeight={state.canvasHeight}
            snapLines={interaction.snapLines}
            zoom={zoom}
            onHandlePointerDown={interaction.handleHandlePointerDown}
          />
        )}
      </div>

      {/* Zoom indicator (above canvas, not transformed) */}
      <ZoomIndicator zoom={gestures.currentZoom} />
    </div>
  );
}));

DomCanvas.displayName = 'DomCanvas';
