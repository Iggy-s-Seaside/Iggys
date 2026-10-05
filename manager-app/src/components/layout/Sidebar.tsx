import { NavLink, useNavigate } from 'react-router-dom';
import { Home, CalendarDays, MessageSquare, PartyPopper, Grid2X2, LogOut, Sun, Moon, HelpCircle, Hourglass } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// Kept for existing callers; More now opens a task page instead of a long drawer.
export const OPEN_MOBILE_NAV_EVENT = 'iggys:nav:open-mobile';
export function openMobileNav() { window.dispatchEvent(new CustomEvent(OPEN_MOBILE_NAV_EVENT)); }

export const MAIN_NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/parties', label: 'Bookings', icon: PartyPopper },
  { to: '/messages', label: 'Inbox', icon: MessageSquare },
  { to: '/tools', label: 'More tasks', icon: Grid2X2 },
];
const STAFF_NAV = [
  { to: '/waitlist', label: 'Waitlist', icon: Hourglass },
  { to: '/help', label: 'Help', icon: HelpCircle },
];

export function Sidebar() {
  const { role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const ops = role === 'owner' || role === 'manager';
  useEffect(() => {
    const open = () => navigate(ops ? '/tools' : '/help');
    window.addEventListener(OPEN_MOBILE_NAV_EVENT, open);
    return () => window.removeEventListener(OPEN_MOBILE_NAV_EVENT, open);
  }, [navigate, ops]);
  return <>
    <header className="app-mobile-header lg:hidden fixed top-0 inset-x-0 z-40 bg-surface border-b border-border h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-5 flex items-center">
      <NavLink to={ops ? '/' : '/waitlist'} className="min-h-[44px] inline-flex items-center"><span className="brand-wordmark">Iggy’s</span><span className="brand-place">Seaside<br />Oregon</span></NavLink>
      <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Use light screen' : 'Use dark screen'} className="ml-auto mr-12 inline-flex items-center gap-1.5 min-h-[44px] px-2 text-sm text-text-secondary">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}{theme === 'dark' ? 'Light' : 'Dark'}</button>
    </header>
    <aside className="app-sidebar hidden lg:flex w-56 bg-surface border-r border-border h-screen sticky top-0 shrink-0 flex-col">
      <NavLink to={ops ? '/' : '/waitlist'} className="px-8 pt-10 pb-6"><span className="brand-wordmark">Iggy’s</span><span className="brand-place mt-3">Seaside, Oregon</span></NavLink>
      <nav aria-label="Main navigation" className="p-4 space-y-2 flex-1">
        {(ops ? MAIN_NAV : STAFF_NAV).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item flex items-center gap-3 px-4 py-4 rounded-xl font-semibold ${isActive ? 'bg-primary-50 text-primary-dark' : 'text-text-secondary hover:bg-surface-hover'}`}><Icon size={22} />{label}</NavLink>)}
      </nav>
      <div className="sidebar-footer p-4 border-t border-border space-y-1">
        <NavLink to="/help" className="flex items-center gap-3 min-h-[48px] px-4 text-text-secondary"><HelpCircle size={20} />Help</NavLink>
        <button onClick={toggleTheme} className="flex items-center gap-3 min-h-[48px] px-4 text-text-secondary w-full">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}{theme === 'dark' ? 'Light screen' : 'Dark screen'}</button>
        <button onClick={signOut} className="flex items-center gap-3 min-h-[48px] px-4 text-text-secondary w-full"><LogOut size={20} />Sign out</button>
      </div>
    </aside>
  </>;
}
