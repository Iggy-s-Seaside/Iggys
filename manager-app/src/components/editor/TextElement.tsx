import { memo, useRef, useCallback, useEffect } from 'react';
import type { TextLayer } from '../../types';
import { MIN_TOUCH_TARGET } from './editorConstants';

interface TextElementProps {
  layer: TextLayer;
  isSelected: boolean;
  isEditing: boolean;
  onPointerDown?: (e: React.PointerEvent, layerId: string) => void;
  onTextCommit?: (layerId: string, text: string) => void;
  onEditEnd?: () => void;
  zoom?: number;
}

export const TextElement = memo<TextElementProps>(({
  layer,
  isSelected,
  isEditing,
  onPointerDown,
  onTextCommit,
  onEditEnd,
  zoom = 1,
}) => {
  const elRef = useRef<HTMLDivElement>(null);
  const originalTextRef = useRef(layer.text);

  // When entering edit mode, seed the DOM text, focus, and select
  useEffect(() => {
    if (isEditing && elRef.current) {
      originalTextRef.current = layer.text;
      // Seed the DOM with current text (we stop rendering {layer.text} during edit)
      elRef.current.innerText = layer.text;
      elRef.current.focus();

      // Select all text
      const range = document.createRange();
      range.selectNodeContents(elRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing, layer.text]);

  const handleBlur = useCallback(() => {
    if (isEditing && elRef.current) {
      const newText = elRef.current.innerText || '';
      onTextCommit?.(layer.id, newText);
      onEditEnd?.();
    }
  }, [isEditing, layer.id, onTextCommit, onEditEnd]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isEditing) return;
    if (e.key === 'Escape') {
      // Revert text
      if (elRef.current) {
        elRef.current.innerText = originalTextRef.current;
      }
      onEditEnd?.();
      e.stopPropagation();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elRef.current?.blur();
    }
    // Stop propagation so keyboard shortcuts don't fire during editing
    e.stopPropagation();
  }, [isEditing, onEditEnd]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isEditing) return; // Let native text selection work
    onPointerDown?.(e, layer.id);
  }, [isEditing, layer.id, onPointerDown]);

  if (!layer.visible) return null;

  // Derive CSS from layer properties
  const isBold = layer.fontStyle.includes('bold');
  const isItalic = layer.fontStyle.includes('italic');
  // fontWeight: use explicit numeric weight, but if fontStyle includes 'bold' and fontWeight is default (400), use bold
  const effectiveWeight = isBold && (!layer.fontWeight || layer.fontWeight === 400) ? 700 : (layer.fontWeight || 400);

  const hasShadow = layer.shadowBlur > 0 || layer.shadowOffsetX !== 0 || layer.shadowOffsetY !== 0;
  const textShadow = hasShadow
    ? `${layer.shadowOffsetX}px ${layer.shadowOffsetY}px ${layer.shadowBlur}px ${layer.shadowColor}`
    : 'none';

  const hasStroke = layer.strokeWidth > 0 && layer.stroke !== 'transparent';

  return (
    <div
      ref={elRef}
      data-layer-id={layer.id}
      className={`absolute ${isEditing ? '' : 'select-none'}`}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onPointerDown={handlePointerDown}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: layer.width,
        transform: `translate(${layer.x}px, ${layer.y}px)${layer.rotation !== 0 ? ` rotate(${layer.rotation}deg)` : ''}`,
        transformOrigin: 'center center',
        fontFamily: layer.fontFamily,
        fontSize: layer.fontSize,
        fontWeight: effectiveWeight,
        fontStyle: isItalic ? 'italic' : 'normal',
        textDecoration: layer.textDecoration || 'none',
        textTransform: layer.textTransform || 'none',
        textAlign: layer.align,
        letterSpacing: layer.letterSpacing !== 0 ? layer.letterSpacing : undefined,
        color: layer.fill,
        opacity: layer.opacity,
        textShadow,
        WebkitTextStroke: hasStroke ? `${layer.strokeWidth}px ${layer.stroke}` : undefined,
        paintOrder: hasStroke ? 'stroke fill' : undefined,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: layer.lineHeight || 1.3,
        // Ensure minimum 44px touch target for small text (via invisible expander, not minHeight)
        // Note: do NOT use display:flex here — it conflicts with text wrapping and causes
        // duplicated text rendering on mobile when combined with word-break + zoom scaling
        cursor: layer.locked ? 'not-allowed' : (isEditing ? 'text' : 'move'),
        pointerEvents: 'auto',
        // Edit mode styling
        caretColor: isEditing ? '#2dd4bf' : 'auto',
        outline: isEditing ? '2px solid #2dd4bf' : 'none',
        background: isEditing ? 'rgba(0,0,0,0.4)' : 'transparent',
        borderRadius: isEditing ? 4 : 0,
        padding: isEditing ? '2px 4px' : 0,
        // Minimum font size for iOS (prevent auto-zoom)
        ...(isEditing && layer.fontSize < 16 ? { fontSize: 16 } : {}),
        // Performance hints
        willChange: isSelected ? 'transform' : 'auto',
      }}
    >
      {/* Invisible touch target expander — ensures at least 44px screen-space tap area when canvas is zoomed out */}
      {zoom < 1 && !isEditing && (() => {
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
      {/* Only render as React child when NOT editing — during edit, DOM owns the text */}
      {!isEditing ? layer.text : null}
    </div>
  );
});

TextElement.displayName = 'TextElement';
