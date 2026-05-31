import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, PartyPopper, Sparkles, ChevronRight, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useParties } from '../../hooks/useParties';
import type { Party } from '../../types';

function todayKey() {
  return format(new Date(), 'yyyy-MM-dd');
}
function addDaysKey(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}
function fmt(d: string | null) {
  if (!d) return '';
  try { return format(parseISO(d), 'EEE, MMM d'); } catch { return d; }
}

function Row({ party, tag, tagClass }: { party: Party; tag: string; tagClass: string }) {
  return (
    <Link
      to={`/parties/${party.id}`}
      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-surface-hover transition-colors min-h-[56px]"
    >
      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${tagClass}`}>{tag}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary truncate">{party.title?.trim() || party.contact_name}</p>
        <div className="flex items-center gap-x-3 text-xs text-text-muted">
          {party.event_date && <span className="flex items-center gap-1"><CalendarClock size={11} /> {fmt(party.event_date)}</span>}
          {party.guest_count != null && <span className="flex items-center gap-1"><Users size={11} /> {party.guest_count}</span>}
        </div>
      </div>
      <ChevronRight size={16} className="text-text-muted shrink-0" />
    </Link>
  );
}

/** "Needs your attention" — the first thing the owner sees: follow-ups due, today, and this week. */
export function PartiesTodayWidget() {
  const { parties, loading } = useParties();
  const today = todayKey();
  const weekEnd = addDaysKey(7);

  const { followUps, todays, thisWeek } = useMemo(() => {
    const followUps = parties
      .filter((p) => p.status === 'inquiry' && p.follow_up_date && p.follow_up_date <= today)
      .sort((a, b) => (a.follow_up_date || '').localeCompare(b.follow_up_date || ''));
    const todays = parties.filter((p) => p.status === 'confirmed' && p.event_date === today);
    const thisWeek = parties
      .filter((p) => p.status === 'confirmed' && p.event_date && p.event_date > today && p.event_date <= weekEnd)
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));
    return { followUps, todays, thisWeek };
  }, [parties, today, weekEnd]);

  const nothing = !loading && followUps.length === 0 && todays.length === 0 && thisWeek.length === 0;

  return (
    <div className="card overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <PartyPopper size={16} className="text-primary" /> Needs your attention
        </h2>
        <Link to="/parties" className="text-sm text-primary hover:text-primary-hover">All parties</Link>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-10 bg-surface-hover rounded animate-pulse" />)}
        </div>
      ) : nothing ? (
        <div className="p-8 text-center">
          <Sparkles size={28} className="mx-auto text-text-muted mb-2" />
          <p className="text-sm text-text-secondary font-medium">You're all caught up</p>
          <p className="text-xs text-text-muted mt-1">No follow-ups due and nothing on the books this week.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {followUps.map((p) => <Row key={`f${p.id}`} party={p} tag="Follow up" tagClass="bg-warning-light text-accent-hover" />)}
          {todays.map((p) => <Row key={`t${p.id}`} party={p} tag="Today" tagClass="bg-primary text-white" />)}
          {thisWeek.map((p) => <Row key={`w${p.id}`} party={p} tag="This week" tagClass="bg-success-light text-green-700 dark:text-green-400" />)}
        </div>
      )}
    </div>
  );
}
