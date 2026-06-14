import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, CornerDownLeft, ArrowUp, ArrowDown, Clock, Zap,
  LayoutDashboard, Calendar, CalendarDays, Sparkles, UtensilsCrossed,
  FolderOpen, Package, MessageSquare, PartyPopper, ListChecks, Receipt,
  Tags, Users, ClipboardList, ClipboardCheck, BarChart3, KanbanSquare,
  Share2, Star, Megaphone, CalendarClock, Calculator, ShieldCheck, Moon,
  Plus, PenSquare, DoorOpen, DoorClosed, Shirt, HelpCircle,
} from 'lucide-react';
import { useCommandPaletteController } from '../hooks/useCommandPalette';

/* ──────────────────────────────────────────────────────────────────────────
 * Command model
 * ──────────────────────────────────────────────────────────────────────── */

type CommandKind = 'page' | 'action';

interface Command {
  /** Stable id used for recents / most-used tracking. */
  id: string;
  label: string;
  /** Extra terms folded into the fuzzy match (e.g. a route path or synonyms). */
  keywords?: string;
  icon: React.ElementType;
  kind: CommandKind;
  /** Route to push, OR an imperative handler (for modal-style quick actions). */
  to?: string;
  run?: () => void;
}

/* ── Quick-action events ──────────────────────────────────────────────────
 * Modal-only actions (New Party, Quick Post) are dispatched as window events so
 * the palette stays decoupled from page-local modal state. DashboardLayout (and
 * any page that wants to host the modal) can listen and respond. They are safe
 * no-ops if nobody is listening.
 */
export const CMD_NEW_PARTY = 'iggys:cmd:new-party';
export const CMD_QUICK_POST = 'iggys:cmd:quick-post';

function fireEvent(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

/* ── Pages: mirrors the nav list in Sidebar.tsx (keep in sync) ───────────── */
const PAGE_COMMANDS: Command[] = [
  { id: 'page:dashboard', label: 'Dashboard', to: '/', icon: LayoutDashboard, kind: 'page', keywords: 'home overview' },
  { id: 'page:shift', label: 'Service', to: '/shift', icon: ClipboardCheck, kind: 'page', keywords: 'shift bar open close drawer service tonight' },
  { id: 'page:run-sheet', label: 'Run Sheet', to: '/run-sheet', icon: ClipboardList, kind: 'page', keywords: 'today tonight prep' },
  { id: 'page:luna', label: 'Luna', to: '/luna', icon: Moon, kind: 'page', keywords: 'ai insights assistant' },
  { id: 'page:messages', label: 'Messages', to: '/messages', icon: MessageSquare, kind: 'page', keywords: 'inbox chat dm' },
  { id: 'page:reputation', label: 'Reviews', to: '/reputation', icon: Star, kind: 'page', keywords: 'reputation ratings google yelp' },
  { id: 'page:parties', label: 'Parties', to: '/parties', icon: PartyPopper, kind: 'page', keywords: 'events bookings functions' },
  { id: 'page:waitlist', label: 'Waitlist', to: '/waitlist', icon: CalendarClock, kind: 'page', keywords: 'waitlist walk-in walk in wait queue host table ready reservation seating' },
  { id: 'page:pipeline', label: 'Pipeline', to: '/pipeline', icon: KanbanSquare, kind: 'page', keywords: 'leads sales kanban' },
  { id: 'page:calendar', label: 'Calendar', to: '/calendar', icon: CalendarDays, kind: 'page', keywords: 'schedule month' },
  { id: 'page:todos', label: 'To-Do', to: '/todos', icon: ListChecks, kind: 'page', keywords: 'tasks checklist' },
  { id: 'page:invoices', label: 'Invoices', to: '/invoices', icon: Receipt, kind: 'page', keywords: 'billing payments money' },
  { id: 'page:reports', label: 'Reports', to: '/reports', icon: BarChart3, kind: 'page', keywords: 'analytics stats numbers' },
  { id: 'page:compliance', label: 'Compliance', to: '/compliance', icon: ShieldCheck, kind: 'page', keywords: 'licence safety legal' },
  { id: 'page:events', label: 'Events', to: '/events', icon: Calendar, kind: 'page', keywords: 'gigs whats on' },
  { id: 'page:specials', label: 'Specials', to: '/specials', icon: Sparkles, kind: 'page', keywords: 'deals promos drinks' },
  { id: 'page:social', label: 'Social', to: '/social', icon: Share2, kind: 'page', keywords: 'instagram facebook posts queue' },
  { id: 'page:marketing', label: 'Marketing', to: '/marketing', icon: Megaphone, kind: 'page', keywords: 'campaigns promo email' },
  { id: 'page:menu', label: 'Menu', to: '/menu', icon: UtensilsCrossed, kind: 'page', keywords: 'food drinks items prices' },
  { id: 'page:inventory', label: 'Inventory', to: '/inventory', icon: Package, kind: 'page', keywords: 'stock supplies counts mark low out 86' },
  { id: 'page:inventory-count', label: 'Count Stock', to: '/inventory/count', icon: ClipboardCheck, kind: 'page', keywords: 'count inventory periodic variance reconcile shrink' },
  { id: 'page:merch', label: 'Merch', to: '/merch', icon: Shirt, kind: 'page', keywords: 'merch shirts crop sweatshirt hats variants sizes stock apparel' },
  { id: 'page:help', label: 'Help & Guide', to: '/help', icon: HelpCircle, kind: 'page', keywords: 'help guide how to docs support training onboarding' },
  { id: 'page:cogs', label: 'COGS', to: '/cogs', icon: Calculator, kind: 'page', keywords: 'cost of goods margins pour' },
  { id: 'page:packages', label: 'Packages', to: '/packages', icon: Tags, kind: 'page', keywords: 'party packages pricing' },
  { id: 'page:media', label: 'Media', to: '/media', icon: FolderOpen, kind: 'page', keywords: 'photos images library assets' },
  { id: 'page:team', label: 'Team', to: '/team', icon: Users, kind: 'page', keywords: 'staff people roster' },
  { id: 'page:schedule', label: 'Schedule', to: '/schedule', icon: Users, kind: 'page', keywords: 'roster shifts rota staff' },
];

/* ── Quick actions ──────────────────────────────────────────────────────── */
const ACTION_COMMANDS: Command[] = [
  { id: 'action:new-event', label: 'New Event', to: '/events/new', icon: Plus, kind: 'action', keywords: 'create add gig' },
  { id: 'action:new-special', label: 'New Special', to: '/specials/editor', icon: Plus, kind: 'action', keywords: 'create add deal promo' },
  { id: 'action:new-party', label: 'New Party', run: () => fireEvent(CMD_NEW_PARTY), icon: Plus, kind: 'action', keywords: 'create add booking function quick' },
  { id: 'action:open-shift', label: 'Open Shift', to: '/shift', icon: DoorOpen, kind: 'action', keywords: 'start bar drawer begin' },
  { id: 'action:close-shift', label: 'Close Shift', to: '/shift/close', icon: DoorClosed, kind: 'action', keywords: 'end bar drawer cash out close the bar' },
  { id: 'action:quick-post', label: 'Quick Post', run: () => fireEvent(CMD_QUICK_POST), icon: PenSquare, kind: 'action', keywords: 'social instagram compose new caption' },
];

const ALL_COMMANDS: Command[] = [...ACTION_COMMANDS, ...PAGE_COMMANDS];
const COMMANDS_BY_ID = new Map(ALL_COMMANDS.map((c) => [c.id, c]));

/* ──────────────────────────────────────────────────────────────────────────
 * Fuzzy matching — lightweight subsequence scorer (no deps)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Returns a score for `query` against `text`, or -1 for no match. Higher is
 * better. Rewards contiguous runs, word-boundary hits and a prefix match.
 */
function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (t.startsWith(q)) return 1000 - t.length; // strong prefix bias, prefer short
  const idx = t.indexOf(q);
  if (idx !== -1) return 500 - idx - t.length * 0.1; // substring

  // Subsequence match
  let qi = 0;
  let score = 0;
  let streak = 0;
  let prevMatchIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      streak = prevMatchIdx === ti - 1 ? streak + 1 : 1;
      score += streak * 2;
      // Word-boundary bonus (start of a word)
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '/' || t[ti - 1] === '-') score += 5;
      prevMatchIdx = ti;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

function scoreCommand(query: string, cmd: Command): number {
  if (!query) return 0;
  const haystacks = [cmd.label, cmd.to ?? '', cmd.keywords ?? ''];
  let best = -1;
  for (const h of haystacks) {
    const s = fuzzyScore(query, h);
    if (s > best) best = s;
  }
  return best;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Recents / most-used persistence
 * ──────────────────────────────────────────────────────────────────────── */

const RECENT_KEY = 'iggys.cmdk.recent.v1';
const USAGE_KEY = 'iggys.cmdk.usage.v1';
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr.filter((id) => COMMANDS_BY_ID.has(id)) : [];
  } catch {
    return [];
  }
}

function loadUsage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function recordUse(id: string) {
  try {
    const recent = [id, ...loadRecent().filter((x) => x !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    const usage = loadUsage();
    usage[id] = (usage[id] ?? 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {
    /* storage unavailable (private mode) — recents simply won't persist */
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────── */

interface Section {
  heading: string;
  icon: React.ElementType;
  items: Command[];
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { open, close } = useCommandPaletteController();

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Bump on open so recents reflect the latest usage each time it appears.
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setOpenCount((c) => c + 1);
      // Focus after paint so the portal is in the DOM.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      document.body.style.overflow = 'hidden';
      return () => {
        cancelAnimationFrame(id);
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  /* Build the sectioned, ordered result set. */
  const sections = useMemo<Section[]>(() => {
    const q = query.trim();

    if (!q) {
      const recentIds = loadRecent();
      const usage = loadUsage();

      const recentItems = recentIds
        .map((id) => COMMANDS_BY_ID.get(id))
        .filter((c): c is Command => Boolean(c));

      // Most-used = top usage, excluding anything already in recents.
      const recentSet = new Set(recentIds);
      const mostUsed = ALL_COMMANDS
        .filter((c) => (usage[c.id] ?? 0) > 0 && !recentSet.has(c.id))
        .sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0))
        .slice(0, MAX_RECENT);

      const out: Section[] = [];
      if (recentItems.length) out.push({ heading: 'Recent', icon: Clock, items: recentItems });
      if (mostUsed.length) out.push({ heading: 'Most used', icon: Zap, items: mostUsed });
      out.push({ heading: 'Quick actions', icon: Zap, items: ACTION_COMMANDS });
      out.push({ heading: 'Go to', icon: Search, items: PAGE_COMMANDS });
      return out;
    }

    const scored = ALL_COMMANDS
      .map((c) => ({ c, s: scoreCommand(q, c) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);

    const actions = scored.filter((c) => c.kind === 'action');
    const pages = scored.filter((c) => c.kind === 'page');
    const out: Section[] = [];
    if (actions.length) out.push({ heading: 'Quick actions', icon: Zap, items: actions });
    if (pages.length) out.push({ heading: 'Go to', icon: Search, items: pages });
    return out;
    // openCount forces recents/most-used to refresh on each open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, openCount]);

  /* Flattened list for keyboard navigation. */
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  // Keep the active index in range as results change.
  useEffect(() => {
    setActive((a) => (flat.length === 0 ? 0 : Math.min(a, flat.length - 1)));
  }, [flat.length]);

  const select = useCallback(
    (cmd: Command | undefined) => {
      if (!cmd) return;
      recordUse(cmd.id);
      close();
      // Defer so the palette unmounts before navigation / modal events fire.
      requestAnimationFrame(() => {
        if (cmd.to) navigate(cmd.to);
        else cmd.run?.();
      });
    },
    [close, navigate],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => (flat.length === 0 ? 0 : (a + 1) % flat.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => (flat.length === 0 ? 0 : (a - 1 + flat.length) % flat.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        select(flat[active]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActive(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActive(Math.max(0, flat.length - 1));
      }
    },
    [flat, active, select, close],
  );

  // Scroll the active row into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  if (!open) return null;

  // Build a running index across sections so keyboard nav lines up with render.
  let runningIndex = -1;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-start justify-center p-0 sm:p-4 sm:pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        style={{ animation: 'fadeIn 150ms ease-out' }}
        onClick={close}
      />

      {/* Panel — full-screen sheet on mobile, centered card on desktop */}
      <div
        className="relative w-full sm:max-w-xl bg-surface border border-border shadow-modal flex flex-col overflow-hidden h-[92dvh] sm:h-auto sm:max-h-[70dvh] rounded-t-2xl sm:rounded-2xl"
        style={{ animation: 'fadeSlideUp 200ms cubic-bezier(0.32,0.72,0,1)' }}
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-border shrink-0">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent py-4 text-base text-text-primary placeholder:text-text-muted focus:outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-listbox"
            aria-activedescendant={flat[active] ? `cmdk-opt-${active}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            onClick={close}
            aria-label="Close"
            className="p-2 -mr-1 rounded-lg hover:bg-surface-hover text-text-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center sm:min-w-0 sm:min-h-0 sm:p-1.5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="cmdk-listbox"
          role="listbox"
          aria-label="Results"
          className="flex-1 overflow-y-auto overscroll-contain py-2"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {flat.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Search size={32} className="mx-auto text-text-muted mb-3" />
              <p className="text-text-secondary font-medium">No matches</p>
              <p className="text-sm text-text-muted mt-1">Try a page name or an action like “New party”.</p>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.heading} className="mb-1 last:mb-0">
                <div className="flex items-center gap-1.5 px-4 pt-2 pb-1">
                  <section.icon size={12} className="text-text-muted" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {section.heading}
                  </span>
                </div>
                {section.items.map((cmd) => {
                  runningIndex++;
                  const index = runningIndex;
                  const isActive = index === active;
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      id={`cmdk-opt-${index}`}
                      data-cmd-index={index}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => select(cmd)}
                      onMouseMove={() => setActive(index)}
                      className={`w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-left transition-colors min-h-[48px] sm:min-h-0 ${
                        isActive ? 'bg-primary-50 text-primary-dark' : 'text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <Icon size={18} className={isActive ? 'text-primary' : 'text-text-muted'} />
                      <span className="flex-1 text-sm font-medium text-text-primary">{cmd.label}</span>
                      {cmd.kind === 'action' && (
                        <span className="shrink-0 rounded-full bg-surface-hover border border-border px-2 py-0.5 text-[10px] font-medium text-text-muted">
                          Action
                        </span>
                      )}
                      {isActive && (
                        <CornerDownLeft size={15} className="text-text-muted shrink-0 hidden sm:block" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints — desktop only (keyboard affordance) */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-2.5 border-t border-border text-[11px] text-text-muted shrink-0">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-border bg-surface-hover">
              <ArrowUp size={11} />
            </kbd>
            <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-border bg-surface-hover">
              <ArrowDown size={11} />
            </kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-[18px] px-1 rounded border border-border bg-surface-hover">
              <CornerDownLeft size={11} />
            </kbd>
            to select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-[18px] px-1.5 rounded border border-border bg-surface-hover font-medium">
              Esc
            </kbd>
            to close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CommandPalette;
