import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Optional lucide icon, rendered before the label (size 14, like Luna's tabs). */
  icon?: LucideIcon;
  /** Optional count chip, rendered after the label (e.g. unread/new count). */
  badge?: number | string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the tablist. */
  ariaLabel?: string;
  /** Extra classes for the wrapping tablist. */
  className?: string;
}

/**
 * Pill-style tabs — the rounded-full active-pill pattern used on Parties and
 * Luna (px-3.5 py-1.5, bg-primary/white when active, bg-surface-hover otherwise).
 * Horizontally scrollable on narrow screens; exposes role="tablist"/role="tab".
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let newIndex: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
        newIndex = (index + 1) % options.length;
        break;
      case 'ArrowLeft':
        newIndex = (index - 1 + options.length) % options.length;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = options.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(options[newIndex].value);
    buttonRefs.current[newIndex]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-1.5 overflow-x-auto scrollbar-hide ${className ?? ''}`}
    >
      {options.map((opt, index) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              active
                ? 'bg-primary text-[#03201c]'
                : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
            }`}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            {opt.label}
            {opt.badge != null && opt.badge !== '' && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                  active ? 'bg-black/15 text-[#03201c]' : 'bg-primary text-[#03201c]'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
