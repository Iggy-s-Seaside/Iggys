import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EventNotificationSettings } from '../components/EventNotificationSettings';
import { useEventReminders } from '../hooks/useEventReminders';

export function Notifications() {
  const { reminders, error, loading, refresh } = useEventReminders();
  return <div className="max-w-3xl mx-auto">
    <PageHeader title="Reminders" subtitle="What is coming up, with a direct link to the details." />
    <EventNotificationSettings />
    <div className="mt-6 space-y-3">
      {error ? <div className="card p-5" role="alert"><p>Reminders could not be loaded.</p><button className="btn-secondary mt-3" onClick={refresh}>Try again</button></div>
        : loading ? <p role="status">Loading reminders…</p>
        : reminders.length ? reminders.map((r) => <Link key={r.id} to={r.url} className="card-hover p-5 flex items-center gap-4"><div className="flex-1"><p className="font-semibold">{r.title}</p><p className="text-sm text-text-secondary mt-1">{r.body}</p></div><ChevronRight size={20} /></Link>)
        : <div className="card p-6"><p className="font-medium">No event reminders due right now.</p><p className="text-sm text-text-secondary mt-2">Reminders appear from 9 AM on the scheduled day, or earlier for a morning event.</p><Link to="/calendar" className="btn-secondary mt-4">Open calendar</Link></div>}
    </div>
  </div>;
}
