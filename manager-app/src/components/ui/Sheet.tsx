import { useEffect, useState, type ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { Modal } from './Modal';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional sticky action bar pinned to the bottom of the surface (e.g. Cancel / Save). */
  footer?: ReactNode;
  /** Desktop-only max width passed through to the underlying Modal. */
  maxWidth?: string;
}

const LG_QUERY = '(min-width: 1024px)';

/**
 * Sheet — one responsive disclosure primitive.
 *
 * Below the `lg:` breakpoint it renders as a full-height {@link BottomSheet}
 * (thumb-reachable header, drag-to-close, keyboard-aware, slider peek-through).
 * At `lg:` and up it renders as a centered {@link Modal}. A single API
 * ({ open, onClose, title, children, footer? }) drives both, unifying
 * elevation, blur, scroll-lock, a11y and focus behaviour across the app.
 *
 * Footer handling differs per surface so the action bar always stays reachable:
 *  - BottomSheet: the footer is pinned as a frosted, safe-area-aware bar so it
 *    floats above the scrolling content within thumb reach.
 *  - Modal: the footer is rendered after the scroll region as a bordered bar.
 *
 * The branch is chosen by an SSR-safe `matchMedia` listener rather than CSS so
 * only ONE underlying component mounts — avoiding duplicate portals, duplicate
 * scroll-locks and double focus traps.
 */
export function Sheet({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }: SheetProps) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(LG_QUERY).matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(LG_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  if (!open) return null;

  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title={title} maxWidth={maxWidth}>
        {children}
        {footer && (
          <div className="-mx-6 -mb-4 mt-4 px-6 py-4 border-t border-border bg-surface">
            {footer}
          </div>
        )}
      </Modal>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {/* Extra bottom padding when a footer is present so content never hides behind the pinned bar. */}
      <div className={footer ? 'pb-4' : undefined}>{children}</div>
      {footer && (
        <div className="fixed inset-x-0 bottom-0 z-[75] px-4 py-3 safe-area-bottom border-t border-border/60 bg-surface/95 backdrop-blur-sm lg:hidden">
          {footer}
        </div>
      )}
    </BottomSheet>
  );
}
