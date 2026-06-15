import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { QuickAddParty } from '../parties/QuickAddParty';
import { CommandPalette, CMD_NEW_PARTY, CMD_QUICK_POST } from '../CommandPalette';
import { OfflineBanner } from '../OfflineBanner';
import { NotificationBell } from '../NotificationBell';
import { MobileCommandButton } from '../MobileCommandButton';

export function DashboardLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const navigate = useNavigate();

  // The command palette fires decoupled window events for modal-style quick
  // actions. The layout is the natural host: New Party opens the global
  // QuickAdd sheet; Quick Post routes to the social composer.
  useEffect(() => {
    const onNewParty = () => setQuickAddOpen(true);
    const onQuickPost = () => navigate('/social');
    window.addEventListener(CMD_NEW_PARTY, onNewParty);
    window.addEventListener(CMD_QUICK_POST, onQuickPost);
    return () => {
      window.removeEventListener(CMD_NEW_PARTY, onNewParty);
      window.removeEventListener(CMD_QUICK_POST, onQuickPost);
    };
  }, [navigate]);

  return (
    // Fixed app-shell on mobile: the shell fills the viewport and never scrolls;
    // the inner content div is the ONE scroller (no body rubber-band). Desktop
    // (lg) reverts to normal in-flow layout + body scroll.
    <div className="flex h-[100dvh] overflow-hidden lg:h-auto lg:min-h-[100dvh] lg:overflow-visible">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden lg:overflow-visible">
        {/* The single scroll container. overscroll-contain stops scroll-chaining;
            safe-area padding clears the notch (top) + bottom nav + home indicator. */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch] lg:overflow-visible px-6 pt-[calc(4rem+env(safe-area-inset-top,0px))] pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:p-8 lg:pt-8 lg:pb-8">
          <OfflineBanner />
          <Outlet />
        </div>
      </main>

      {/* Mobile-only thumb-reachable nav (self-hosts its context-aware FAB sheet) */}
      <BottomNav />
      {/* Kept for the command palette's "New Party" quick action */}
      <QuickAddParty open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />

      {/* Global Cmd/Ctrl+K command palette — mounted once, event-driven */}
      <CommandPalette />

      {/* Global notification bell — self-contained, fixed top-right */}
      <NotificationBell />

      {/* Mobile-only command-palette entry — fixed top-left (no keyboard on mobile) */}
      <MobileCommandButton />
    </div>
  );
}
