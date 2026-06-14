import { useNavigate } from 'react-router-dom';
import {
  PartyPopper, CalendarClock, UserPlus, ListTodo, Share2, CalendarDays, Sparkles,
  PenLine, Ban, DoorClosed, type LucideIcon,
} from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { useShift } from '../hooks/useShift';

interface QuickCreateSheetProps {
  open: boolean;
  onClose: () => void;
}

interface QuickAction {
  label: string;
  hint: string;
  icon: LucideIcon;
  to: string;
  /** amber accent tint reserved for shift-context actions */
  accent?: boolean;
}

/** Pages adopt `?new=1` to auto-open their create flow; navigating there works
 * regardless, so this stays forward-compatible with pages that ignore it. */
const CREATE_ACTIONS: QuickAction[] = [
  { label: 'New Party', hint: 'Booking inquiry', icon: PartyPopper, to: '/parties?new=1' },
  { label: 'New Reservation', hint: 'Book a table', icon: CalendarClock, to: '/reservations?new=1' },
  { label: 'Add Walk-in', hint: 'Seat right now', icon: UserPlus, to: '/reservations?new=walkin' },
  { label: 'New To-do', hint: 'Task for the team', icon: ListTodo, to: '/todos?new=1' },
  { label: 'Quick Post', hint: 'Social draft', icon: Share2, to: '/social?new=1' },
  { label: 'New Event', hint: 'Add to calendar', icon: CalendarDays, to: '/events/new' },
  { label: 'New Special', hint: 'Build a special', icon: Sparkles, to: '/specials/editor' },
];

const SHIFT_ACTIONS: QuickAction[] = [
  { label: 'Log note', hint: 'Add to shift log', icon: PenLine, to: '/shift/log?new=1', accent: true },
  { label: '86 an item', hint: 'Mark out of stock', icon: Ban, to: '/shift/checks?new=86', accent: true },
  { label: 'Close-out', hint: 'End the shift', icon: DoorClosed, to: '/shift/close', accent: true },
];

function ActionButton({ action, onSelect }: { action: QuickAction; onSelect: (to: string) => void }) {
  const Icon = action.icon;
  return (
    <button
      onClick={() => onSelect(action.to)}
      className="card-hover flex items-center gap-3 p-3.5 text-left active:scale-[0.98] transition-transform min-h-[60px]"
    >
      <span
        className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${
          action.accent ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
        }`}
      >
        <Icon size={22} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-primary truncate">{action.label}</span>
        <span className="block text-xs text-text-muted truncate">{action.hint}</span>
      </span>
    </button>
  );
}

/**
 * Context-aware quick-create launched from the center FAB. Offers the common
 * create flows, and — when a shift is open — surfaces shift actions too.
 * Each action navigates to the right route, appending `?new=...` so pages that
 * support it can open their create flow immediately.
 */
export function QuickCreateSheet({ open, onClose }: QuickCreateSheetProps) {
  const navigate = useNavigate();
  const { current } = useShift();
  const shiftOpen = !!current;

  const handleSelect = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Quick create">
      <div className="pt-2 space-y-5">
        {shiftOpen && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
              Shift open
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              {SHIFT_ACTIONS.map((a) => (
                <ActionButton key={a.label} action={a} onSelect={handleSelect} />
              ))}
            </div>
          </section>
        )}

        <section>
          {shiftOpen && (
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
              Create
            </h4>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {CREATE_ACTIONS.map((a) => (
              <ActionButton key={a.label} action={a} onSelect={handleSelect} />
            ))}
          </div>
        </section>
      </div>
    </BottomSheet>
  );
}
