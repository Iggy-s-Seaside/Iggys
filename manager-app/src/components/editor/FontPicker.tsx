import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { EDITOR_FONTS } from '../../types';
import { useClickOutside } from '../../hooks/useClickOutside';

interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
}

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, useCallback(() => setOpen(false), []), open);

  // Close on escape — stop propagation so the page-level Escape handler
  // (which deselects the layer) doesn't also fire.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    // Use capture phase so we intercept before the page handler
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="input-field w-full flex items-center justify-between gap-2 cursor-pointer text-left"
      >
        <span style={{ fontFamily: value }} className="truncate">
          {value}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-modal max-h-[280px] overflow-y-auto overscroll-contain">
          {EDITOR_FONTS.map((font) => (
            <button
              key={font}
              onClick={() => {
                onChange(font);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full px-3 py-2.5 text-left transition-colors ${
                value === font
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {value === font && <Check size={14} className="shrink-0" />}
              <span
                style={{ fontFamily: font }}
                className={`text-sm truncate ${value === font ? '' : 'ml-[22px]'}`}
              >
                {font}
              </span>
              <span
                style={{ fontFamily: font }}
                className="ml-auto text-xs text-text-muted hidden sm:block"
              >
                Abc
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
