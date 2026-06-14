import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, CalendarDays, Sparkles, UtensilsCrossed, LogOut, Menu, X, Sun, Moon, FolderOpen, Package, MessageSquare, PartyPopper, ListChecks, Receipt, Tags, Users, ClipboardList, ClipboardCheck, BarChart3, KanbanSquare, Share2, Star, Megaphone, Hourglass, Shirt, CalendarRange, Calculator, ShieldCheck, HelpCircle, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useRole, type Role } from '../../hooks/useRole';
import { useUnreadCount } from '../../hooks/useMessages';
import { useNewInsightCount } from '../../hooks/useLuna';

type NavItem = { to: string; icon: LucideIcon; label: string; badge?: 'messages' | 'luna'; roles?: Role[] };
type NavSection = { id: string; label: string; items: NavItem[] };

// Operational tier (owner + manager). Items with no `roles` are visible to ALL
// roles incl. employees — that's just the host waitlist + the bar service cockpit.
const OPS: Role[] = ['owner', 'manager'];

// Grouped nav. Every existing route is kept — sections only label + organise them.
const navSections: NavSection[] = [
  {
    id: 'tonight',
    label: 'Tonight',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: OPS },
      { to: '/shift', icon: ClipboardCheck, label: 'Service' },
      { to: '/waitlist', icon: Hourglass, label: 'Waitlist' },
      { to: '/help', icon: HelpCircle, label: 'Help' },
      { to: '/run-sheet', icon: ClipboardList, label: 'Run Sheet', roles: OPS },
    ],
  },
  {
    id: 'bookings',
    label: 'Bookings & Sales',
    items: [
      { to: '/parties', icon: PartyPopper, label: 'Parties', roles: OPS },
      { to: '/pipeline', icon: KanbanSquare, label: 'Pipeline', roles: OPS },
      { to: '/calendar', icon: CalendarDays, label: 'Calendar', roles: OPS },
      { to: '/events', icon: Calendar, label: 'Events', roles: OPS },
      { to: '/invoices', icon: Receipt, label: 'Invoices', roles: OPS },
      { to: '/packages', icon: Tags, label: 'Packages', roles: OPS },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { to: '/specials', icon: Sparkles, label: 'Specials', roles: OPS },
      { to: '/social', icon: Share2, label: 'Social', roles: OPS },
      { to: '/marketing', icon: Megaphone, label: 'Marketing', roles: OPS },
      { to: '/reputation', icon: Star, label: 'Reviews', roles: OPS },
      { to: '/media', icon: FolderOpen, label: 'Media', roles: OPS },
    ],
  },
  {
    id: 'menu',
    label: 'Menu & Stock',
    items: [
      { to: '/menu', icon: UtensilsCrossed, label: 'Menu', roles: OPS },
      { to: '/inventory', icon: Package, label: 'Inventory', roles: OPS },
      { to: '/inventory/count', icon: ClipboardCheck, label: 'Count Stock', roles: OPS },
      { to: '/merch', icon: Shirt, label: 'Merch', roles: OPS },
      { to: '/cogs', icon: Calculator, label: 'COGS', roles: OPS },
    ],
  },
  {
    id: 'boh',
    label: 'Back-of-House',
    items: [
      { to: '/team', icon: Users, label: 'Team', roles: ['owner'] },
      { to: '/schedule', icon: CalendarRange, label: 'Schedule', roles: OPS },
      { to: '/todos', icon: ListChecks, label: 'To-Do', roles: OPS },
      { to: '/compliance', icon: ShieldCheck, label: 'Compliance', roles: OPS },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { to: '/reports', icon: BarChart3, label: 'Reports', roles: OPS },
      { to: '/luna', icon: Moon, label: 'Luna', badge: 'luna', roles: OPS },
      { to: '/messages', icon: MessageSquare, label: 'Messages', badge: 'messages', roles: OPS },
    ],
  },
];

const COLLAPSED_KEY = 'iggys.sidebar.collapsed';

function readCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// Returns the section id that owns the current pathname (longest matching route wins).
function activeSectionId(pathname: string): string | undefined {
  let bestId: string | undefined;
  let bestLen = -1;
  for (const section of navSections) {
    for (const item of section.items) {
      const matches = item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/');
      if (matches && item.to.length > bestLen) {
        bestLen = item.to.length;
        bestId = section.id;
      }
    }
  }
  return bestId;
}

export function Sidebar() {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { can } = useRole();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  const unreadCount = useUnreadCount();
  const newInsightCount = useNewInsightCount();

  const activeSection = activeSectionId(location.pathname);

  // Role-filter: items with no `roles` are visible to everyone (employees see
  // just Service + Waitlist). Sections with nothing left drop out entirely.
  const visibleSections = navSections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || can(i.roles)) }))
    .filter((s) => s.items.length > 0);

  const toggleSection = (id: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // ignore persistence failures (private mode etc.)
      }
      return next;
    });
  };

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">
          Iggy's <span className="text-primary">Manager</span>
        </h1>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {visibleSections.map((section) => {
          // The active route's section is always shown, even if the user collapsed it.
          const isOpen = !collapsed.includes(section.id) || section.id === activeSection;
          return (
            <div key={section.id}>
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isOpen}
                className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
              >
                <span>{section.label}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${isOpen ? '' : '-rotate-90'}`}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div className="mt-1 space-y-1">
                  {section.items.map(({ to, icon: Icon, label, badge }) => {
                    const badgeCount =
                      badge === 'messages' ? unreadCount : badge === 'luna' ? newInsightCount : 0;
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-primary-50 text-primary-dark border-l-3 border-primary'
                              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                          }`
                        }
                      >
                        <Icon size={18} />
                        {label}
                        {badgeCount > 0 && (
                          <span className="ml-auto bg-primary text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                            {badgeCount > 9 ? '9+' : badgeCount}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Theme Toggle + User & Sign Out */}
      <div className="px-3 py-4 border-t border-border space-y-2">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        <p className="px-3 text-xs text-text-muted truncate">{user?.email}</p>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-danger transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-surface border-b border-border">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="p-2.5 -ml-1 rounded-lg hover:bg-surface-hover min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-sm font-bold text-text-primary tracking-tight">
          Iggy's <span className="text-primary">Manager</span>
        </h1>
        {can(OPS) && unreadCount > 0 && (
          <NavLink to="/messages" className="ml-auto flex items-center gap-1 text-xs text-primary">
            <MessageSquare size={14} />
            <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
          </NavLink>
        )}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 h-full bg-surface border-r border-border">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface-hover"
            >
              <X size={18} />
            </button>
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 bg-surface border-r border-border h-screen sticky top-0 shrink-0">
        {navContent}
      </aside>
    </>
  );
}
