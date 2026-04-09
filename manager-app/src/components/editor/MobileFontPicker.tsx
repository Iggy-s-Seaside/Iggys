import { memo, useMemo } from 'react';
import { X, Bold, Italic, Underline } from 'lucide-react';
import { EDITOR_FONTS } from '../../types';
import type { TextLayer } from '../../types';

interface MobileFontPickerProps {
  layer: TextLayer;
  onUpdate: (changes: Partial<TextLayer>) => void;
  onClose: () => void;
  /** Vertical center of the selected element on screen (0-1 ratio) */
  elementScreenY?: number;
}

export const MobileFontPicker = memo(function MobileFontPicker({
  layer,
  onUpdate,
  onClose,
  elementScreenY = 0.5,
}: MobileFontPickerProps) {
  const isBold = layer.fontStyle.includes('bold');
  const isItalic = layer.fontStyle.includes('italic');
  const isUnderline = layer.textDecoration === 'underline';

  const toggleStyle = (style: 'bold' | 'italic') => {
    const parts = layer.fontStyle.split(' ').filter(Boolean);
    const has = parts.includes(style);
    const next = has ? parts.filter((p) => p !== style) : [...parts, style];
    onUpdate({ fontStyle: next.length === 0 ? 'normal' : next.join(' ') });
  };

  // Smart positioning: show at top if text is in bottom half, bottom if text is in top half
  const showAtBottom = elementScreenY < 0.45;

  const positionClasses = showAtBottom
    ? 'fixed bottom-16 left-0 right-0 z-[65] md:hidden safe-area-bottom'
    : 'fixed top-12 left-0 right-0 z-[65] md:hidden safe-area-top';

  const animationName = showAtBottom ? 'slideUpIn' : 'slideDownIn';

  // Scroll the active font into view on mount
  const activeFontIndex = useMemo(() => EDITOR_FONTS.indexOf(layer.fontFamily as typeof EDITOR_FONTS[number]), [layer.fontFamily]);

  return (
    <div
      className={positionClasses}
      style={{ animation: `${animationName} 250ms cubic-bezier(0.32, 0.72, 0, 1)` }}
    >
      <div className={`mx-3 ${showAtBottom ? 'mb-2' : 'mt-2'} rounded-2xl bg-surface/95 backdrop-blur-xl border border-border/20 shadow-modal overflow-hidden`}>
        {/* Header with style buttons */}
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mr-auto">Font</span>

          {/* Style toggle buttons */}
          <StyleBtn active={isBold} onClick={() => toggleStyle('bold')} label="Bold"><Bold size={14} /></StyleBtn>
          <StyleBtn active={isItalic} onClick={() => toggleStyle('italic')} label="Italic"><Italic size={14} /></StyleBtn>
          <StyleBtn active={isUnderline} onClick={() => onUpdate({ textDecoration: isUnderline ? '' : 'underline' })} label="Underline"><Underline size={14} /></StyleBtn>

          <div className="w-px h-5 bg-border/40 mx-1" />
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl hover:bg-surface-hover active:scale-90 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={16} className="text-text-muted" />
          </button>
        </div>

        {/* Font pills — horizontally scrollable */}
        <div
          className="flex gap-1.5 px-3 pb-2.5 overflow-x-auto scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' }}
          ref={(el) => {
            // Auto-scroll to active font on mount
            if (el && activeFontIndex > 0) {
              const child = el.children[activeFontIndex] as HTMLElement;
              if (child) {
                child.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
              }
            }
          }}
        >
          {EDITOR_FONTS.map((font) => {
            const isActive = layer.fontFamily === font;
            return (
              <button
                key={font}
                onClick={() => onUpdate({ fontFamily: font })}
                className={`shrink-0 px-4 py-2.5 rounded-xl transition-all active:scale-95 ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-hover/60 text-text-secondary hover:bg-surface-active'
                }`}
              >
                <span
                  style={{ fontFamily: font }}
                  className="text-sm font-medium whitespace-nowrap"
                >
                  {font}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
});

MobileFontPicker.displayName = 'MobileFontPicker';

function StyleBtn({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`p-2.5 rounded-lg transition-all active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center ${
        active
          ? 'bg-primary text-white shadow-sm'
          : 'bg-surface-hover/60 text-text-muted hover:bg-surface-active'
      }`}
    >
      {children}
    </button>
  );
}
