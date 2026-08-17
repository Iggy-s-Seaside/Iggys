import { Search } from 'lucide-react';
import { openCommandPalette } from '../hooks/useCommandPalette';

/**
 * MobileCommandButton — a mobile-only (`lg:hidden`) entry point to the global
 * command palette. Desktop users reach it with Cmd/Ctrl+K, but mobile has no
 * keyboard, so this fixed trigger sits next to the NotificationBell. It's a
 * labelled "Search" pill, not a bare magnifier — an unlabeled icon read as
 * decoration and the feature was effectively invisible. Tapping it fires the
 * window event that opens the palette ({@link openCommandPalette}).
 */
export function MobileCommandButton() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Search & quick actions"
      aria-haspopup="dialog"
      className="fixed top-[calc(0.5rem+env(safe-area-inset-top,0px))] right-16 z-50 flex h-11 items-center gap-1.5 rounded-full bg-surface border border-border px-3.5 text-text-secondary shadow-card hover:bg-surface-hover hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:hidden"
    >
      <Search size={18} aria-hidden="true" />
      <span className="text-sm font-medium">Search</span>
    </button>
  );
}

export default MobileCommandButton;
