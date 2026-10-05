import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PartyPopper, CalendarDays, MessageSquare, Hourglass, HelpCircle, Menu } from 'lucide-react';
import { useUnreadCount } from '../../hooks/useMessages';
import { useRole } from '../../hooks/useRole';

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

/** Consistent mobile navigation, with a smaller set of destinations for staff. */
export function BottomNav() {
  const unread = useUnreadCount();
  const { can } = useRole();
  const ops = can(['owner', 'manager']);

  return (
    <>
      <nav aria-label="Primary" className="app-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border safe-area-bottom">
        {ops ? (
          <div className="grid grid-cols-5 items-center">
            <Tab to="/" icon={LayoutDashboard} label="Home" end />
            <Tab to="/parties" icon={PartyPopper} label="Bookings" />
            <Tab to="/calendar" icon={CalendarDays} label="Calendar" />
            <Tab to="/messages" icon={MessageSquare} label="Inbox" badge={unread} />
            <Tab to="/tools" icon={Menu} label="More" />
          </div>
        ) : (
          // Employee view: the surfaces they're allowed to run + Help.
          <div className="grid grid-cols-2 items-center">
            <Tab to="/waitlist" icon={Hourglass} label="Waitlist" />
            <Tab to="/help" icon={HelpCircle} label="Help" />
          </div>
        )}
      </nav>

    </>
  );
}
