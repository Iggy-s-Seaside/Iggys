import { Link } from 'react-router-dom';
import { ChevronRight, Bell, Loader2 } from 'lucide-react';
import { useSupabaseCRUD } from '../hooks/useSupabaseCRUD';
import { useMessages } from '../hooks/useMessages';
import { useParties } from '../hooks/useParties';
import { useAuth } from '../context/AuthContext';
import { latestConversations } from '../lib/messageConversations';
import { needsReplyNow } from '../utils/triage';
import { buildCalendarItems } from '../lib/calendarItems';
import { formatRange } from '../lib/timeWindows';
import { pacificDay, addDateDays } from '../../supabase/functions/event-reminders/schedule';
import { EventNotificationSettings } from '../components/EventNotificationSettings';
import { useEventReminders } from '../hooks/useEventReminders';
import { safeFmtDate } from '../utils/format';
import type { IggyEvent } from '../types';

export function Dashboard() {
  const { firstName } = useAuth();
  const { data: events, loading: eventsLoading, error: eventsError, refresh: refreshEvents } = useSupabaseCRUD<IggyEvent>('events');
  const { parties, loading: partiesLoading, error: partiesError, refresh: refreshParties } = useParties();
  const { messages, loading: messagesLoading, error: messagesError, refresh: refreshMessages } = useMessages();
  const { reminders } = useEventReminders();
  const today = pacificDay();
  const waiting = latestConversations(messages).filter(needsReplyNow);
  const requests = parties.filter((p) => p.status === 'inquiry' && (!p.event_date || p.event_date >= today));
  const schedule = buildCalendarItems(parties, events, [], today, addDateDays(today, 7))
    .filter((item) => item.kind !== 'party' || item.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startMin ?? 0) - (b.startMin ?? 0));
  const loading = eventsLoading || partiesLoading;
  const error = eventsError || partiesError || messagesError;
  const refresh = () => { void refreshEvents(); void refreshParties(); void refreshMessages(); };
  return <div className="max-w-4xl mx-auto space-y-6">
    <header className="day-header">
      <p className="day-eyebrow">{safeFmtDate(today, 'EEEE, MMMM d')}</p>
      <h1 className="day-title">Today at Iggy’s.</h1>
      <p className="day-subtitle">{firstName ? `Hi ${firstName}. ` : ''}Your bookings, your messages, and what’s coming up.</p>
    </header>
    {error && <div className="card p-5 border-danger/40" role="alert"><p>Some information could not be loaded. These counts may be incomplete.</p><button className="btn-secondary mt-3" onClick={refresh}>Try again</button></div>}
    <section aria-label="Needs your attention" className="grid sm:grid-cols-2 gap-4">
      <Link to="/messages?view=needs" className="attention-tile">
        <span className="attention-number" aria-hidden="true">{messagesLoading ? '—' : waiting.length}</span><div className="flex-1"><p className="font-semibold text-lg">{messagesLoading ? 'Checking messages…' : waiting.length ? `${waiting.length} ${waiting.length === 1 ? 'conversation needs' : 'conversations need'} a reply` : 'Messages are caught up'}</p><p className="text-sm text-text-secondary mt-1">Read and answer your inbox</p></div><ChevronRight size={20} />
      </Link>
      <Link to="/parties" className="attention-tile">
        <span className="attention-number" aria-hidden="true">{partiesLoading ? '—' : requests.length}</span><div className="flex-1"><p className="font-semibold text-lg">{partiesLoading ? 'Checking bookings…' : requests.length ? `${requests.length} ${requests.length === 1 ? 'booking request' : 'booking requests'}` : 'Your private bookings'}</p><p className="text-sm text-text-secondary mt-1">Review requests and confirmed parties</p></div><ChevronRight size={20} />
      </Link>
    </section>
    <section className="overflow-hidden" aria-label="Events this week">
      <div className="py-5 flex items-center justify-between gap-3"><h2 className="day-section-title">Coming up</h2><Link to="/calendar" className="day-text-link">Full calendar</Link></div>
      {loading ? <p className="p-6 flex items-center gap-2" role="status"><Loader2 size={18} className="animate-spin" />Loading events…</p>
        : !schedule.length ? <div className="p-6"><p className="font-medium">No confirmed events in the next seven days.</p><p className="text-sm text-text-secondary mt-2">New requests are above. The calendar shows all dates and Google Calendar entries.</p></div>
        : <div className="day-calendar">{schedule.slice(0, 8).map((item) => <Link key={item.id} to={item.kind === 'party' ? `/parties/${item.party!.id}` : `/events/${item.event!.id}/edit`} className="day-calendar-row py-5 px-2 flex items-center gap-5 min-h-[104px]">
          <div className="day-date shrink-0"><p className="text-xs font-semibold text-text-secondary">{item.date === today ? 'TODAY' : safeFmtDate(item.date, 'EEE')}</p><strong className="block mt-1">{safeFmtDate(item.date, 'd')}</strong></div>
          <div className="flex-1 min-w-0"><h3 className="font-semibold break-words">{item.title}</h3><p className="text-sm text-text-secondary mt-1">{item.allDay ? 'All day' : item.startMin === null ? 'Time to confirm' : formatRange(item.startMin, item.endMin)}{item.space ? ` · ${item.space}` : ''}</p><p className="text-xs text-text-muted mt-1">{item.kind === 'party' ? 'Confirmed private booking' : 'Public event'}</p></div><ChevronRight size={20} className="shrink-0" />
        </Link>)}</div>}
    </section>
    {!!reminders.length && <Link to="/notifications" className="card-hover p-5 flex items-center gap-4"><Bell size={24} className="text-primary" /><span className="flex-1"><span className="block font-semibold">{reminders.length} event {reminders.length === 1 ? 'reminder' : 'reminders'}</span><span className="text-sm text-text-secondary">Review the dates and details</span></span><ChevronRight size={20} /></Link>}
    <div className="grid gap-4">
      <Link to="/tools" className="day-text-link py-3 border-t border-border"><ChevronRight size={24} className="text-primary" /><span><span className="block font-semibold">Something else?</span><span className="text-sm text-text-secondary">Stock, reports, staff and other tasks</span></span></Link>
    </div>
    <EventNotificationSettings />
    <p className="text-sm text-text-secondary pb-3">Need a hand? <Link to="/help" className="text-primary underline">Open the simple guide</Link>.</p>
  </div>;
}
