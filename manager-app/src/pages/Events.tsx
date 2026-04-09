import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, Calendar, RefreshCw, Download } from 'lucide-react';
import { useSupabaseCRUD } from '../hooks/useSupabaseCRUD';
import { ConfirmDialog } from '../components/ui/Modal';
import { AddToCalendarButton } from '../components/events/AddToCalendarButton';
import { downloadBulkIcs } from '../utils/calendarSync';
import type { IggyEvent } from '../types';
import { format, parseISO } from 'date-fns';

function formatDate(dateStr: string, fmt = 'MMM d, yyyy') {
  try { return format(parseISO(dateStr), fmt); } catch { return dateStr; }
}

export function Events() {
  const { data: events, loading, update, remove } = useSupabaseCRUD<IggyEvent>('events');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Events</h1>
          <p className="text-sm text-text-muted mt-1">{events.length} total events</p>
        </div>
        <div className="flex gap-2">
          {events.filter(e => e.active).length > 0 && (
            <button
              onClick={() => downloadBulkIcs(events.filter(e => e.active))}
              className="btn-secondary"
              title="Export all active events as .ics"
            >
              <Download size={18} /> Export All
            </button>
          )}
          <Link to="/events/new" className="btn-primary">
            <Plus size={18} /> New Event
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-5 bg-surface-hover rounded w-1/3 mb-2" />
              <div className="h-4 bg-surface-hover rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No events yet</p>
          <p className="text-sm text-text-muted mt-1">Create your first event to get started</p>
          <Link to="/events/new" className="btn-primary mt-4 inline-flex">
            <Plus size={18} /> Create Event
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-hover/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Event</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Active</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((event) => (
                <tr key={event.id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {event.image_url ? (
                        <img src={event.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                          <Calendar size={16} className="text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-text-primary">{event.title}</p>
                        <p className="text-xs text-text-muted sm:hidden">
                          {formatDate(event.date, 'MMM d')}
                        </p>
                        {event.is_recurring && (
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            <RefreshCw size={10} /> {event.recurring_day}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <p className="text-sm text-text-secondary">
                      {formatDate(event.date)}
                    </p>
                    <p className="text-xs text-text-muted">{event.time}</p>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    {event.category ? <span className="badge-primary">{event.category}</span> : <span className="text-xs text-text-muted">--</span>}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => update(event.id, { active: !event.active })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        event.active ? 'bg-primary' : 'bg-surface-active'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                        event.active ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <AddToCalendarButton event={event} />
                      <Link to={`/events/${event.id}/edit`} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary transition-colors">
                        <Edit2 size={15} />
                      </Link>
                      <button onClick={() => setDeleteId(event.id)} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-danger transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId); }}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
