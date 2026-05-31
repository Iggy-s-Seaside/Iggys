import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { QuickAddParty } from '../parties/QuickAddParty';

export function DashboardLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {/* pt-16 clears the mobile hamburger bar; pb-24 clears the mobile bottom nav */}
        <div className="p-6 pt-16 pb-24 lg:p-8 lg:pt-8 lg:pb-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile-only thumb-reachable nav + global Quick-Add */}
      <BottomNav onQuickAdd={() => setQuickAddOpen(true)} />
      <QuickAddParty open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  );
}
