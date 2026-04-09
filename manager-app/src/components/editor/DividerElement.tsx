import { memo, useCallback } from 'react';
import type { TextLayer } from '../../types';
import { MIN_TOUCH_TARGET } from './editorConstants';

interface DividerElementProps {
  layer: TextLayer;
  isSelected: boolean;
  onPointerDown?: (e: React.PointerEvent, layerId: string) => void;
  zoom?: number;
}

export const DividerElement = memo<DividerElementProps>(({
  layer,
  isSelected,
  onPointerDown,
  zoom = 1,
}) => {
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    onPointerDown?.(e, layer.id);
  }, [layer.id, onPointerDown]);

  if (!layer.visible) return null;

  const label = layer.dividerLabel || layer.text || '';
  const lineColor = layer.dividerLineColor || layer.fill || '#2dd4bf';
  const lineOpacity = layer.dividerLineOpacity ?? 0.4;
  const lineThickness = layer.dividerLineThickness ?? 1;
  const padding = layer.dividerPadding ?? 40;
  const gap = layer.dividerGap ?? 16;
  const labelFont = layer.fontFamily || 'Montserrat';
  const labelSize = layer.fontSize || 20;
  const labelWeight = layer.fontWeight || 600;
  const labelColor = layer.fill || '#2dd4bf';
  const labelSpacing = layer.letterSpacing || 4;

  return (
    <div
      data-layer-id={layer.id}
      className={`absolute select-none`}
      onPointerDown={handlePointerDown}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: layer.width,
        height: 30,
        transform: `translate(${layer.x}px, ${layer.y}px)`,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${padding}px`,
        opacity: layer.opacity,
        cursor: layer.locked ? 'not-allowed' : 'move',
        pointerEvents: 'auto',
        minHeight: 44,
        willChange: isSelected ? 'transform' : 'auto',
      }}
    >
      {/* Invisible touch target expander — ensures at least 44px screen-space tap area */}
      {zoom < 1 && (() => {
        const expandY = Math.max(0, (MIN_TOUCH_TARGET / zoom - MIN_TOUCH_TARGET) / 2);
        return expandY > 0 ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: -expandY,
              bottom: -expandY,
            }}
          />
        ) : null;
      })()}
      {/* Left line */}
      <div
        style={{
          flex: 1,
          height: lineThickness,
          backgroundColor: lineColor,
          opacity: lineOpacity,
        }}
      />
      {/* Label */}
      {label && (
        <>
          <span
            style={{
              margin: `0 ${gap}px`,
              fontFamily: labelFont,
              fontSize: labelSize,
              fontWeight: labelWeight,
              color: labelColor,
              letterSpacing: labelSpacing,
              whiteSpace: 'nowrap',
              textTransform: (layer.textTransform || 'uppercase') as React.CSSProperties['textTransform'],
              lineHeight: 1,
            }}
          >
            {label}
          </span>
          {/* Right line */}
          <div
            style={{
              flex: 1,
              height: lineThickness,
              backgroundColor: lineColor,
              opacity: lineOpacity,
            }}
          />
        </>
      )}
    </div>
  );
});

DividerElement.displayName = 'DividerElement';
