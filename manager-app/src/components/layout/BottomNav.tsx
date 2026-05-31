import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PartyPopper, CalendarDays, MessageSquare, Plus } from 'lucide-react';
import { useUnreadCount } from '../../hooks/useMessages';

interface BottomNavProps {
  onQuickAdd: () => void;
}

function Tab({ to, icon: Icon, label, end, badge }: {
  to: string; icon: React.ElementType; label: string; end?: boolean; badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-medium transition-colors ${
          isActive ? 'text-primary' : 'text-text-muted'
        }`
      }
    >
      <Icon size={22} />
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute top-1.5 right-[18%] bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  );
}

/** Thumb-reachable bottom navigation for mobile, with a center Quick-Add button. */
export function BottomNav({ onQuickAdd }: BottomNavProps) {
  const unread = useUnreadCount();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border safe-area-bottom">
      <div className="grid grid-cols-5 items-center">
        <Tab to="/" icon={LayoutDashboard} label="Home" end />
        <Tab to="/parties" icon={PartyPopper} label="Parties" />
        <div className="flex justify-center">
          <button
            onClick={onQuickAdd}
            aria-label="Quick add a party"
            className="-mt-6 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus size={26} />
          </button>
        </div>
        <Tab to="/calendar" icon={CalendarDays} label="Calendar" />
        <Tab to="/messages" icon={MessageSquare} label="Inbox" badge={unread} />
      </div>
    </nav>
  );
}
