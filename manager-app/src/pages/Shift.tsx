import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Power,
  Loader2,
  Clock,
  User as UserIcon,
  ListChecks,
  NotebookPen,
  DollarSign,
  ChevronRight,
  History,
  type LucideIcon,
} from 'lucide-react';
import { formatDistanceToNow, format, parseISO, intervalToDuration } from 'date-fns';
import { useShift } from '../hooks/useShift';
import { useAuth } from '../context/AuthContext';
import type { ShiftSession } from '../types';

// ── Live shift clock ──

/** Compact H:MM since the shift opened, ticking every second. */
function liveDuration(openedAt: string): string {
  let start: Date;
  try {
    start = parseISO(openedAt);
  } catch {
    return '0:00';
  }
  const d = intervalToDuration({ start, end: new Date() });
  const totalHours = (d.days ?? 0) * 24 + (d.hours ?? 0);
  const mins = String(d.minutes ?? 0).padStart(2, '0');
  return `${totalHours}:${mins}`;
}

// ── Sub-station tile ──

interface StationProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent?: boolean;
  onClick: () => void;
}

function Station({ icon: Icon, title, subtitle, accent, onClick }: StationProps) {
  return (
    <button
      onClick={onClick}
      className={`card card-hover w-full text-left p-5 flex items-center gap-4 min-h-[88px] transition-colors ${
        accent ? 'border-accent/40' : ''
      }`}
    >
      <div
        className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
          accent ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'
        }`}
      >
        <Icon size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-text-primary">{title}</p>
        <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight size={20} className="shrink-0 text-text-muted" />
    </button>
  );
}

// ── Recent shifts (collapsed history) ──

function fmtRange(s: ShiftSession): string {
  try {
    const open = format(parseISO(s.opened_at), 'MMM d, h:mma');
    if (s.closed_at) {
      return `${open} – ${format(parseISO(s.closed_at), 'h:mma')}`;
    }
    return `${open} – open`;
  } catch {
    return s.opened_at;
  }
}

export function Shift() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, isOpen, recent, loading, openShift } = useShift();
  const [opening, setOpening] = useState(false);
  const [, setTick] = useState(0);

  // Tick the live clock once a second only while the bar is actually open.
  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  const handleOpen = async () => {
    setOpening(true);
    const row = await openShift(user?.email ?? null);
    setOpening(false);
    if (row) {
      // Land the manager straight on the opening line check.
      navigate('/shift/checks');
    }
  };

  // The stations are always reachable (no "open the bar" wall). Tapping one
  // quietly starts today's shift if it isn't open yet, so checks/log/close-out
  // attach to a real session — then we navigate. Jumping into your opening
  // checks IS opening the bar.
  const goStation = async (path: string) => {
    if (!isOpen) {
      setOpening(true);
      const row = await openShift(user?.email ?? null);
      setOpening(false);
      if (!row) return;
    }
    navigate(path);
  };

  const closedHistory = recent.filter((s) => s.status === 'closed');

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="card p-16 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Service</h1>
          <span className={`${isOpen ? 'badge-success' : 'badge'} text-sm px-3 py-1 font-semibold`}>
            {isOpen ? 'Bar is OPEN' : 'Bar is closed'}
          </span>
        </div>
        <p className="text-sm text-text-muted mt-1">Open the bar, run your checks, close out the night.</p>
      </div>

      {/* Status banner — live timer when open, a one-tap opener when closed.
          Either way the stations below are always available. */}
      {isOpen && current ? (
        <div className="card p-5 sm:p-6 mb-5 bg-primary/5 border-primary/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide">Shift in progress</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-text-primary">
                <Clock size={20} className="text-text-muted" />
                <span className="text-3xl font-bold tabular-nums">{liveDuration(current.opened_at)}</span>
                <span className="text-sm text-text-muted">elapsed</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  Opened {(() => {
                    try {
                      return format(parseISO(current.opened_at), 'h:mm a');
                    } catch {
                      return '—';
                    }
                  })()}
                </span>
                {current.opened_by && (
                  <span className="flex items-center gap-1">
                    <UserIcon size={12} />
                    by {current.opened_by.split('@')[0]}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate('/shift/close')}
              className="btn-secondary flex items-center gap-2 shrink-0 min-h-[48px] border-danger/40 text-danger hover:bg-danger/10"
            >
              <Power size={18} />
              Close the Bar
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-4 sm:p-5 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 p-2.5 rounded-lg bg-surface-hover">
              <Power size={20} className="text-text-muted" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-text-primary">The bar is closed</p>
              <p className="text-sm text-text-muted">Jump into any task below — it starts your shift automatically.</p>
            </div>
          </div>
          <button
            onClick={handleOpen}
            disabled={opening}
            className="btn-primary min-h-[48px] px-6 shrink-0"
          >
            {opening ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
            Open the Bar
          </button>
        </div>
      )}

      {/* Sub-stations — always available; tapping one auto-starts the shift. */}
      <div className="space-y-3">
        <Station
          icon={ListChecks}
          title="Checklists & Line Check"
          subtitle="Opening checks, par checks, equipment"
          onClick={() => goStation('/shift/checks')}
        />
        <Station
          icon={NotebookPen}
          title="Shift Log"
          subtitle="Notes, incidents, handoff for the next shift"
          onClick={() => goStation('/shift/log')}
        />
        <Station
          icon={DollarSign}
          title="Cash & End-of-Night"
          subtitle="Count the drawer and close out the shift"
          accent
          /* Go straight to close-out — never auto-(re)open a shift just to view
             or close it (that would wipe closed_at/closed_by on a done shift). */
          onClick={() => navigate('/shift/close')}
        />
      </div>

      {/* Recent shifts */}
      {closedHistory.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <History size={16} className="text-text-muted" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Recent shifts</h2>
          </div>
          <div className="card divide-y divide-border overflow-hidden">
            {closedHistory.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                <ClipboardCheck size={16} className="shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">{fmtRange(s)}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-text-muted">
                    {s.closed_at && (
                      <span>
                        {formatDistanceToNow(parseISO(s.closed_at), { addSuffix: true })}
                      </span>
                    )}
                    {s.closed_by && <span>closed by {s.closed_by.split('@')[0]}</span>}
                  </div>
                  {s.notes && <p className="text-xs text-text-muted mt-1 whitespace-pre-wrap line-clamp-2">{s.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
