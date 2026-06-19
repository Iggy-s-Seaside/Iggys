import { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { QuickAddParty } from '../parties/QuickAddParty';
import { CommandPalette, CMD_NEW_PARTY, CMD_QUICK_POST } from '../CommandPalette';
import { ShortcutsSheet } from '../ShortcutsSheet';
import { OfflineBanner } from '../OfflineBanner';
import { SyncPendingPill } from '../SyncPendingPill';
import { LunaReachBanner } from '../LunaReachBanner';
import { NotificationBell } from '../NotificationBell';
import { MobileCommandButton } from '../MobileCommandButton';
import { ScrollToTop } from '../ui/ScrollToTop';

export function DashboardLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
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
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:shadow-lg">Skip to content</a>
      <Sidebar />
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 flex flex-col overflow-hidden lg:overflow-visible">
        {/* The single scroll container. overscroll-contain stops scroll-chaining;
            safe-area padding clears the notch (top) + bottom nav + home indicator.
            On lg we hand vertical scroll back to the body (overflow-visible), but
            keep the column width-bounded (w-full/min-w-0/max-w-full) so it can
            never exceed the flex track. The Outlet content is then wrapped in a
            horizontal-clip div below — that clip is where any stray too-wide child
            is contained, instead of widening the shell and shoving the sticky
            sidebar off-screen. (We deliberately don't put overflow-x-hidden on
            THIS lg container: overflow-x-hidden + overflow-y-visible is an invalid
            combo where the visible axis silently computes to auto, which would
            re-introduce an inner scrollbar on desktop.) */}
        <div ref={scrollRef} className="flex-1 w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch] lg:overflow-visible px-6 pt-[calc(4rem+env(safe-area-inset-top,0px))] pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:p-8 lg:pt-8 lg:pb-8">
          <OfflineBanner />
          {/* Back-online-but-still-replaying signal so offline writes aren't stranded. */}
          <SyncPendingPill />
          {/* Luna's unprompted reach — top of every screen when she raises one. */}
          <LunaReachBanner />
          {/* Width-bounded, horizontally-clipped wrapper around the routed page.
              This element stays overflow-x-hidden at ALL breakpoints. Per the CSS
              overflow rules, pairing overflow-x:hidden with an unset overflow-y
              makes y compute to `auto` — but that's harmless here: this wrapper has
              no fixed height, so it auto-sizes to its content and never has
              anything to scroll vertically (no inner scrollbar; the body keeps
              owning desktop vertical scroll). The x-clip is what contains any stray
              too-wide child, so the page can never exceed viewport width. */}
          <div className="w-full min-w-0 max-w-full overflow-x-hidden">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile-only thumb-reachable nav (self-hosts its context-aware FAB sheet) */}
      <BottomNav />
      {/* Kept for the command palette's "New Party" quick action */}
      <QuickAddParty open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />

      {/* Global Cmd/Ctrl+K command palette — mounted once, event-driven */}
      <CommandPalette />

      {/* "?" keyboard-shortcuts cheatsheet — mounted once, opens on the ? key */}
      <ShortcutsSheet />

      {/* Global notification bell — self-contained, fixed top-right */}
      <NotificationBell />

      {/* Mobile-only command-palette entry — fixed top-right beside the bell */}
      <MobileCommandButton />

      {/* Mobile-only "back to top" once the content scroller is a screenful down */}
      <ScrollToTop scrollRef={scrollRef} />
    </div>
  );
}
