import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { NotificationCenter } from './NotificationCenter';

/**
 * NotificationBell — a self-contained activity bell. Mountable with zero props
 * (`<NotificationBell />`); the integrator drops it once into DashboardLayout.
 *
 * Owns its own open state and the {@link useActivityFeed} aggregation, renders a
 * fixed top-right trigger with an unseen-count badge, and opens the
 * {@link NotificationCenter} panel. It sits to the LEFT of the mobile header's
 * right edge (and above its z-40 bar) so it never overlaps the left-side
 * hamburger; on desktop there's no top bar, so top-right is clean. Opening the
 * panel marks everything seen.
 */
export function NotificationBell() {
  const { items, unseenCount, markAllSeen } = useActivityFeed();
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    // Surfacing the feed is the "seen" event — clear the badge on open.
    markAllSeen();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={
          unseenCount > 0 ? `Activity, ${unseenCount} new` : 'Activity'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed top-[calc(0.5rem+env(safe-area-inset-top,0px))] right-3 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-surface border border-border text-text-secondary shadow-card hover:bg-surface-hover hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:top-4 lg:right-4"
      >
        <Bell size={20} aria-hidden="true" />
        {unseenCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-bold leading-none text-white"
            aria-hidden="true"
          >
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      <NotificationCenter
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        unseenCount={unseenCount}
        onMarkAllSeen={markAllSeen}
      />
    </>
  );
}

export default NotificationBell;
