import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  PartyPopper,
  MessageSquare,
  Moon,
  Package,
  CalendarClock,
  Star,
  Bell,
  CheckCheck,
  type LucideIcon,
} from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { EmptyState } from './ui/EmptyState';
import type { ActivityItem, ActivityKind } from '../hooks/useActivityFeed';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  items: ActivityItem[];
  unseenCount: number;
  onMarkAllSeen: () => void;
}

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  party: PartyPopper,
  message: MessageSquare,
  insight: Moon,
  inventory: Package,
  waitlist: CalendarClock,
  review: Star,
};

/** Tinted icon chip per source — semantic tokens only, dark-mode safe. */
const KIND_CHIP: Record<ActivityKind, string> = {
  party: 'bg-primary-50 text-primary',
  message: 'bg-primary-50 text-primary',
  insight: 'bg-primary-50 text-primary',
  inventory: 'bg-warning-light text-accent-hover',
  waitlist: 'bg-primary-50 text-primary',
  review: 'bg-warning-light text-accent-hover',
};

/** Tolerant relative-time label ("3 minutes ago"), never throws on bad input. */
function relativeTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  try {
    return formatDistanceToNow(new Date(ms), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * NotificationCenter — the unified activity panel. Renders as a bottom sheet on
 * mobile and a centered modal on desktop via the {@link Sheet} primitive. Each
 * row deep-links to its record on tap (closing the panel first), shows a source
 * icon, title/subtitle and a relative timestamp, and unseen rows carry a small
 * dot. "Mark all read" zeroes the unseen count.
 */
export function NotificationCenter({
  open,
  onClose,
  items,
  unseenCount,
  onMarkAllSeen,
}: NotificationCenterProps) {
  const navigate = useNavigate();

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Activity">
      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="New inquiries, messages, reviews and alerts will show up here."
          className="border-0 shadow-none p-8"
        />
      ) : (
        <div className="space-y-1">
          {unseenCount > 0 && (
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs text-text-muted">
                {unseenCount} new
              </span>
              <button
                type="button"
                onClick={onMarkAllSeen}
                className="btn-ghost px-2 py-1 text-xs"
              >
                <CheckCheck size={14} aria-hidden="true" />
                Mark all read
              </button>
            </div>
          )}

          <ul className="-mx-2">
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => go(item.to)}
                    className={`w-full flex items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      item.read ? '' : 'bg-primary-50'
                    }`}
                  >
                    <span
                      className={`shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${KIND_CHIP[item.kind]}`}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {item.title}
                        </span>
                        {!item.read && (
                          <span
                            className="shrink-0 h-2 w-2 rounded-full bg-primary"
                            aria-label="Unread"
                          />
                        )}
                      </span>
                      {item.subtitle && (
                        <span className="mt-0.5 block truncate text-sm text-text-secondary">
                          {item.subtitle}
                        </span>
                      )}
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {relativeTime(item.time)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

export default NotificationCenter;
