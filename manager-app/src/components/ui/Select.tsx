import {
  Fragment, useEffect, useId, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  useFloating, offset, flip, size, autoUpdate,
  useClick, useDismiss, useRole, useListNavigation, useTypeahead, useInteractions,
  useTransitionStyles, FloatingFocusManager, FloatingPortal,
} from '@floating-ui/react';
import { ChevronDown, Check, type LucideIcon } from 'lucide-react';
import { useCoarsePointer } from '../../hooks/useCoarsePointer';

export interface SelectOption<T extends string | number = string | number> {
  value: T;
  label: string;
  disabled?: boolean;
  hint?: string;   // 'next day' renders as an amber chip; anything else is dim ("Booked"/"Overlaps")
  group?: string;  // section header
}

export interface SelectProps<T extends string | number> {
  value: T | null;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  variant?: 'glass' | 'manager';
  leadingIcon?: LucideIcon;
  /** Render a real native <select> on touch devices (default true). */
  nativeOnTouch?: boolean;
  /** Row to center on open when nothing is selected (e.g. a sensible default time). */
  defaultScrollTo?: T;
}

const triggerClasses = (variant: 'glass' | 'manager', className?: string) =>
  [
    'group w-full flex items-center gap-2.5 text-left transition outline-none',
    'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variant === 'manager'
      // Compose the manager's own input style so the closed trigger reads as a normal input field.
      ? 'input-field flex items-center min-h-[42px] hover:border-primary/40'
      : 'rounded-xl bg-surface border border-border px-4 py-3 min-h-[48px] text-text-primary hover:border-primary/40',
    className,
  ].filter(Boolean).join(' ');

function itemClasses(active: boolean, selected: boolean, disabled?: boolean) {
  const base = 'mx-1 my-0.5 min-h-[44px] px-3 rounded-lg flex items-center gap-2 text-sm tabular-nums select-none';
  if (disabled) return `${base} text-text-muted opacity-40 line-through cursor-not-allowed`;
  const it = `${base} cursor-pointer transition-colors`;
  if (selected && active) return `${it} bg-primary/[0.14] text-primary font-medium`;
  if (selected) return `${it} bg-primary/[0.06] text-primary font-medium`;
  if (active) return `${it} bg-primary/10 text-text-primary`;
  return `${it} text-text-primary`;
}

function HintChip({ hint }: { hint: string }) {
  return <span className={`shrink-0 text-[11px] ${hint === 'next day' ? 'text-accent' : 'text-text-muted'}`}>{hint}</span>;
}

// ── Native path: themed trigger, OS-drawn list (best touch UX, zero custom a11y) ──
function NativeSelect<T extends string | number>({
  value, onChange, options, placeholder = 'Select…', label, id,
  disabled, className, variant = 'glass', leadingIcon: LeadingIcon,
}: SelectProps<T>) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const keyMap = useMemo(() => new Map(options.map((o) => [String(o.value), o.value] as const)), [options]);
  const selected = options.find((o) => o.value === value) ?? null;

  const groups: { group?: string; items: SelectOption<T>[] }[] = [];
  for (const o of options) {
    const last = groups[groups.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else groups.push({ group: o.group, items: [o] });
  }
  const optEl = (o: SelectOption<T>) => (
    <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>
      {o.label}{o.hint ? ` · ${o.hint}` : ''}
    </option>
  );

  return (
    <div className="relative">
      {LeadingIcon && (
        <LeadingIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted z-10" />
      )}
      <select
        id={fieldId}
        aria-label={label}
        disabled={disabled}
        value={selected ? String(selected.value) : ''}
        onChange={(e) => { const v = keyMap.get(e.target.value); if (v != null) onChange(v); }}
        className={`${triggerClasses(variant, className)} appearance-none pr-10 ${LeadingIcon ? 'pl-10' : ''} ${selected ? '' : 'text-text-muted'}`}
      >
        <option value="" disabled>{placeholder}</option>
        {groups.map((g, i) => g.group
          ? <optgroup key={i} label={g.group}>{g.items.map(optEl)}</optgroup>
          : <Fragment key={i}>{g.items.map(optEl)}</Fragment>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
    </div>
  );
}

// ── Desktop path: custom dark-glass listbox, Floating-UI positioned, full keyboard ──
function DesktopSelect<T extends string | number>({
  value, onChange, options, placeholder = 'Select…', label, id,
  disabled, className, variant = 'glass', leadingIcon: LeadingIcon, defaultScrollTo,
}: SelectProps<T>) {
  const reactId = useId();
  const listId = id ?? reactId;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const selectedIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value]);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const listRef = useRef<Array<HTMLElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listContentRef = useRef<Array<string | null>>(options.map((o) => o.label));
  const isTypingRef = useRef(false);
  useEffect(() => { listContentRef.current = options.map((o) => o.label); }, [options]);

  const disabledIndices = useMemo(
    () => options.flatMap((o, i) => (o.disabled ? [i] : [])),
    [options],
  );

  const { refs, floatingStyles, context, placement } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ padding: 12 }),
      size({
        padding: 12,
        apply({ rects, elements, availableHeight }) {
          // Expose the available space as a CSS var so the INNER scroll div (not this
          // positioning wrapper) caps its height and scrolls internally.
          elements.floating.style.minWidth = `${rects.reference.width}px`;
          elements.floating.style.setProperty('--sel-max-h', `${Math.max(160, Math.min(320, availableHeight))}px`);
        },
      }),
    ],
  });

  const { isMounted, styles: transStyles } = useTransitionStyles(context, {
    duration: { open: 150, close: 110 },
    initial: { opacity: 0, transform: 'scale(0.96) translateY(-4px)' },
  });

  const click = useClick(context, { event: 'mousedown' });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'listbox' });
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    onNavigate: setActiveIndex,
    loop: false,
    disabledIndices,
    focusItemOnOpen: false,
  });
  const typeahead = useTypeahead(context, {
    listRef: listContentRef,
    activeIndex,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    onMatch: open ? setActiveIndex : (i) => { const o = options[i]; if (o && !o.disabled) onChange(o.value); },
    onTypingChange(t) { isTypingRef.current = t; },
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([click, dismiss, role, listNav, typeahead]);

  // Center a sensible row on open (selected, else defaultScrollTo).
  useEffect(() => {
    if (!open) { setActiveIndex(null); return; }
    let target = selectedIndex;
    if (target < 0 && defaultScrollTo != null) target = options.findIndex((o) => o.value === defaultScrollTo);
    if (target >= 0) {
      setActiveIndex(target);
      // Scroll WITHIN the panel (never the page).
      requestAnimationFrame(() => {
        const item = listRef.current[target];
        const cont = scrollRef.current;
        if (item && cont) cont.scrollTop = item.offsetTop - cont.clientHeight / 2 + item.offsetHeight / 2;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSelect(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
  }
  function onItemKeyDown(e: ReactKeyboardEvent<HTMLElement>, i: number) {
    if (e.key === 'Enter') { e.preventDefault(); handleSelect(i); }
    else if (e.key === ' ' && !isTypingRef.current) { e.preventDefault(); handleSelect(i); }
  }

  const origin = placement.startsWith('top') ? 'bottom' : 'top';
  let lastGroup: string | undefined;

  return (
    <>
      <button
        type="button"
        ref={refs.setReference}
        disabled={disabled}
        aria-label={label}
        className={triggerClasses(variant, className)}
        {...getReferenceProps()}
      >
        {LeadingIcon && <LeadingIcon className="w-4 h-4 text-text-muted shrink-0" />}
        <span className={`flex-1 truncate ${selected ? '' : 'text-text-muted'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {isMounted && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div ref={refs.setFloating} id={listId} style={floatingStyles} className="z-50 outline-none" {...getFloatingProps()}>
              <div
                ref={scrollRef}
                style={{ ...transStyles, transformOrigin: origin, maxHeight: 'var(--sel-max-h, 20rem)' }}
                className="relative overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface/95 backdrop-blur-xl p-1.5 scrollbar-hide shadow-modal"
              >
                {options.map((opt, i) => {
                  const showHeader = !!opt.group && opt.group !== lastGroup;
                  lastGroup = opt.group;
                  const isSel = i === selectedIndex;
                  const isAct = i === activeIndex;
                  return (
                    <Fragment key={String(opt.value)}>
                      {showHeader && (
                        <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-text-muted select-none">{opt.group}</div>
                      )}
                      <div
                        role="option"
                        aria-selected={isSel}
                        aria-disabled={opt.disabled || undefined}
                        id={`${listId}-opt-${i}`}
                        ref={(node) => { listRef.current[i] = node; }}
                        tabIndex={isAct ? 0 : -1}
                        className={itemClasses(isAct, isSel, opt.disabled)}
                        {...getItemProps({ onClick: () => handleSelect(i), onKeyDown: (e) => onItemKeyDown(e, i) })}
                      >
                        <span className="flex-1 truncate">{opt.label}</span>
                        {opt.hint && <HintChip hint={opt.hint} />}
                        {isSel && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

export default function Select<T extends string | number>(props: SelectProps<T>) {
  const coarse = useCoarsePointer();
  if (props.nativeOnTouch !== false && coarse) return <NativeSelect {...props} />;
  return <DesktopSelect {...props} />;
}
