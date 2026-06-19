import { Search } from 'lucide-react';
import { openCommandPalette } from '../hooks/useCommandPalette';

/**
 * MobileCommandButton — a mobile-only (`lg:hidden`) entry point to the global
 * command palette. Desktop users reach it with Cmd/Ctrl+K, but mobile has no
 * keyboard, so this fixed top-LEFT trigger mirrors the NotificationBell on the
 * right: same sizing, same shell tokens, opposite corner. Tapping it fires the
 * window event that opens the palette ({@link openCommandPalette}).
 */
export function MobileCommandButton() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Search & quick actions"
      aria-haspopup="dialog"
      className="fixed top-[calc(0.5rem+env(safe-area-inset-top,0px))] left-3 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-surface border border-border text-text-secondary shadow-card hover:bg-surface-hover hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:hidden"
    >
      <Search size={20} aria-hidden="true" />
    </button>
  );
}

export default MobileCommandButton;
