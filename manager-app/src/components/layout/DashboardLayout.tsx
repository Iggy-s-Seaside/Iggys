import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { QuickAddParty } from '../parties/QuickAddParty';
import { CommandPalette, CMD_NEW_PARTY, CMD_QUICK_POST } from '../CommandPalette';
import { OfflineBanner } from '../OfflineBanner';
import { NotificationBell } from '../NotificationBell';

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
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {/* pt-16 clears the mobile hamburger bar; pb-24 clears the mobile bottom nav */}
        <div className="p-6 pt-16 pb-24 lg:p-8 lg:pt-8 lg:pb-8">
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
    </div>
  );
}
