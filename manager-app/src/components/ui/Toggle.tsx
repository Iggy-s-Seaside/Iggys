import { useId } from 'react';

interface ToggleProps {
  /** Whether the switch is on. */
  checked: boolean;
  /** Called with the next checked value when toggled. */
  onChange: (checked: boolean) => void;
  /** Optional text label, rendered to the right and clickable. */
  label?: string;
  /** Disables interaction and dims the control. */
  disabled?: boolean;
  /** aria-label for when no visible label is provided. */
  ariaLabel?: string;
  /** Extra classes for the wrapping element. */
  className?: string;
}

/**
 * Accessible iOS-style switch — the single source of truth for the toggle that
 * Events, EventForm and Packages each hand-rolled. Same look (h-6 w-11 track,
 * h-4 w-4 knob, bg-primary when on), now with role="switch"/aria-checked, full
 * keyboard support (Space/Enter), a 44px hit area, and a disabled state.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  ariaLabel,
  className,
}: ToggleProps) {
  const labelId = useId();

  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      aria-labelledby={label ? labelId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        // 44px hit target via padding; the visible track stays h-6 w-11.
        'relative inline-flex shrink-0 items-center p-2.5 -m-2.5 rounded-full',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        label ? '' : className,
      ].filter(Boolean).join(' ')}
    >
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-surface-active'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );

  if (!label) return button;

  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ''}`}>
      {button}
      <span
        id={labelId}
        onClick={() => !disabled && onChange(!checked)}
        className={`text-sm text-text-secondary select-none ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
      >
        {label}
      </span>
    </span>
  );
}

export default Toggle;
