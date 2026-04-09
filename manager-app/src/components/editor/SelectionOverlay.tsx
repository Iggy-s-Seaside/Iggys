import { memo, useMemo } from 'react';
import { Lock } from 'lucide-react';
import type { TextLayer } from '../../types';
import { MIN_TOUCH_TARGET } from './editorConstants';

interface SnapLines {
  x: number[];
  y: number[];
}

interface SelectionOverlayProps {
  layer: TextLayer;
  canvasWidth: number;
  canvasHeight: number;
  snapLines: SnapLines;
  zoom?: number;
  onHandlePointerDown: (e: React.PointerEvent, handle: string) => void;
}

const MIN_TOUCH_HEIGHT = MIN_TOUCH_TARGET;

/** Estimate element height based on type */
function estimateHeight(layer: TextLayer): number {
  if (layer.elementType === 'image' || layer.elementType === 'video') {
    return layer.imageHeight || layer.width; // Images/videos have explicit height
  }
  const lines = layer.text.split('\n');
  const lh = layer.lineHeight || 1.3;
  const lineHeight = layer.fontSize * lh;
  const rawHeight = lines.length > 1 ? (lines.length - 1) * lineHeight + layer.fontSize : layer.fontSize;
  // Match the 44px minHeight applied to TextElement so the selection box aligns
  return Math.max(rawHeight, MIN_TOUCH_HEIGHT);
}

const HANDLE_SIZE = 10;
const TOUCH_SIZE = 44;
const ROTATION_OFFSET = 30;

type HandleId = 'nw' | 'ne' | 'sw' | 'se' | 'rotate';

const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export const SelectionOverlay = memo<SelectionOverlayProps>(({
  layer,
  canvasWidth,
  canvasHeight,
  snapLines,
  zoom = 1,
  onHandlePointerDown,
}) => {
  const height = estimateHeight(layer);
  const padding = 4;
  // Scale touch targets inversely with zoom so they stay ≥44px on screen
  const touchSize = Math.max(TOUCH_SIZE, TOUCH_SIZE / zoom);

  // Selection box position (with padding around text)
  const boxX = layer.x - padding;
  const boxY = layer.y - padding;
  const boxW = layer.width + padding * 2;
  const boxH = height + padding * 2;

  // Corner handle positions relative to box
  const handles = useMemo<{ id: HandleId; x: number; y: number; cursor: string }[]>(() => [
    { id: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
    { id: 'ne', x: boxW, y: 0, cursor: 'nesw-resize' },
    { id: 'sw', x: 0, y: boxH, cursor: 'nesw-resize' },
    { id: 'se', x: boxW, y: boxH, cursor: 'nwse-resize' },
  ], [boxW, boxH]);

  // Rotation handle position (above top-center)
  const rotateX = boxW / 2;
  const rotateY = -ROTATION_OFFSET;

  // Scale handle visual size inversely to keep consistent on screen
  const handleVisualSize = Math.max(HANDLE_SIZE, HANDLE_SIZE / zoom);

  return (
    <>
      {/* Selection ring + handles (rotated with the layer) */}
      <div
        data-selection-overlay
        className="absolute pointer-events-none"
        style={{
          left: 0,
          top: 0,
          width: boxW,
          height: boxH,
          transform: `translate(${boxX}px, ${boxY}px)${layer.rotation !== 0 ? ` rotate(${layer.rotation}deg)` : ''}`,
          transformOrigin: `${layer.width / 2 + padding}px ${height / 2 + padding}px`,
        }}
      >
        {/* Selection border — solid for cleaner look */}
        <div
          className="absolute inset-0 rounded"
          style={{
            border: `${Math.max(1.5, 1.5 / zoom)}px solid rgba(45, 212, 191, 0.8)`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.1), 0 0 12px rgba(45, 212, 191, 0.2)',
          }}
        />

        {/* Rotation line (hidden on touch devices) */}
        {!isTouchDevice && (
          <div
            className="absolute"
            style={{
              left: boxW / 2 - 0.5,
              top: -ROTATION_OFFSET,
              width: Math.max(1, 1 / zoom),
              height: ROTATION_OFFSET,
              backgroundColor: 'rgba(45, 212, 191, 0.6)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Rotation handle (hidden on touch devices) */}
        {!isTouchDevice && (
          <div
            className="absolute pointer-events-auto"
            style={{
              left: rotateX - touchSize / 2,
              top: rotateY - touchSize / 2,
              width: touchSize,
              height: touchSize,
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPointerDown={(e) => onHandlePointerDown(e, 'rotate')}
          >
            <div
              style={{
                width: handleVisualSize,
                height: handleVisualSize,
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: `${Math.max(1.5, 1.5 / zoom)}px solid #2dd4bf`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                transition: 'transform 150ms ease',
              }}
            />
          </div>
        )}

        {/* Corner resize handles */}
        {handles.map(({ id, x, y, cursor }) => (
          <div
            key={id}
            className="absolute pointer-events-auto"
            style={{
              left: x - touchSize / 2,
              top: y - touchSize / 2,
              width: touchSize,
              height: touchSize,
              cursor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPointerDown={(e) => onHandlePointerDown(e, id)}
          >
            <div
              style={{
                width: handleVisualSize,
                height: handleVisualSize,
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: `${Math.max(1.5, 1.5 / zoom)}px solid #2dd4bf`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                transition: 'transform 150ms ease',
              }}
            />
          </div>
        ))}

        {/* Lock indicator */}
        {layer.locked && (
          <div
            className="absolute flex items-center justify-center rounded-md bg-amber-500/90 p-1"
            style={{
              top: -16 / zoom,
              right: -16 / zoom,
              transform: `scale(${1 / zoom})`,
              transformOrigin: 'bottom left',
            }}
          >
            <Lock size={12} className="text-white" />
          </div>
        )}
      </div>

      {/* Snap guide lines (not rotated, full canvas span) */}
      {snapLines.x.map((x, i) => (
        <div
          key={`sx-${i}`}
          className="absolute pointer-events-none"
          style={{
            left: x,
            top: 0,
            width: Math.max(1, 1 / zoom),
            height: canvasHeight,
            backgroundColor: 'rgba(45, 212, 191, 0.5)',
          }}
        />
      ))}
      {snapLines.y.map((y, i) => (
        <div
          key={`sy-${i}`}
          className="absolute pointer-events-none"
          style={{
            left: 0,
            top: y,
            width: canvasWidth,
            height: Math.max(1, 1 / zoom),
            backgroundColor: 'rgba(45, 212, 191, 0.5)',
          }}
        />
      ))}
    </>
  );
});

SelectionOverlay.displayName = 'SelectionOverlay';
