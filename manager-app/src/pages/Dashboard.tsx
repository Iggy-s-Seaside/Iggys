import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Sparkles, UtensilsCrossed, Plus, TrendingUp, Camera, MessageSquare } from 'lucide-react';
import { useSupabaseCRUD } from '../hooks/useSupabaseCRUD';
import { useInventoryItems, getLowStockItems } from '../hooks/useInventory';
import { useMessages } from '../hooks/useMessages';
import { QuickPostModal } from '../components/editor/QuickPostModal';
import { LowStockWidget } from '../components/inventory/LowStockWidget';
import { MessageWidget } from '../components/messages/MessageWidget';
import type { IggyEvent, Special } from '../types';
import { format, parseISO, isFuture } from 'date-fns';

export function Dashboard() {
  const { data: events } = useSupabaseCRUD<IggyEvent>('events');
  const { data: specials, refresh: refreshSpecials } = useSupabaseCRUD<Special>('specials');
  const { items: inventoryItems } = useInventoryItems();
  const lowStockItems = getLowStockItems(inventoryItems);
  const { messages, loading: messagesLoading } = useMessages();
  const [quickPostOpen, setQuickPostOpen] = useState(false);
  const unreadMessages = messages.filter(m => m.status === 'unread');

  const activeEvents = events.filter((e) => e.active);
  const activeSpecials = specials.filter((s) => s.active);
  const upcomingEvents = activeEvents
    .filter((e) => {
      try { return isFuture(parseISO(e.date)); } catch { return false; }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const stats = [
    { label: 'Unread Messages', value: unreadMessages.length, icon: MessageSquare, color: 'text-primary', bg: 'bg-primary-50' },
    { label: 'Active Events', value: activeEvents.length, icon: Calendar, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Active Specials', value: activeSpecials.length, icon: Sparkles, color: 'text-accent', bg: 'bg-warning-light' },
    { label: 'Total Events', value: events.length, icon: TrendingUp, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">
            {(() => {
              const h = new Date().getHours();
              const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
              return unreadMessages.length > 0
                ? `${greeting} — ${unreadMessages.length} unread message${unreadMessages.length === 1 ? '' : 's'}`
                : `${greeting}`;
            })()}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-3 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className={`p-2 sm:p-2.5 rounded-lg ${bg} w-fit`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-text-primary">{value}</p>
                <p className="text-[11px] sm:text-xs text-text-muted leading-tight">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Link to="/events/new" className="card-hover p-5 flex items-center gap-3 group active:scale-[0.98] transition-transform">
          <div className="p-2 rounded-lg bg-primary-50 group-hover:bg-primary/20 transition-colors">
            <Plus size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">New Event</p>
            <p className="text-xs text-text-muted hidden sm:block">Create an event</p>
          </div>
        </Link>
        <Link to="/specials/editor" className="card-hover p-5 flex items-center gap-3 group active:scale-[0.98] transition-transform">
          <div className="p-2 rounded-lg bg-warning-light group-hover:bg-accent/20 transition-colors">
            <Sparkles size={18} className="text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">New Special</p>
            <p className="text-xs text-text-muted hidden sm:block">Design a special</p>
          </div>
        </Link>
        <button onClick={() => setQuickPostOpen(true)} className="card-hover p-5 flex items-center gap-3 group text-left active:scale-[0.98] transition-transform">
          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20 transition-colors">
            <Camera size={18} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Quick Post</p>
            <p className="text-xs text-text-muted hidden sm:block">Photo → Post</p>
          </div>
        </button>
        <Link to="/menu" className="card-hover p-5 flex items-center gap-3 group active:scale-[0.98] transition-transform">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-colors">
            <UtensilsCrossed size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Edit Menu</p>
            <p className="text-xs text-text-muted hidden sm:block">Update menu items</p>
          </div>
        </Link>
      </div>

      <QuickPostModal
        open={quickPostOpen}
        onClose={() => setQuickPostOpen(false)}
        onSaved={refreshSpecials}
      />

      {/* Upcoming Events + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div className="card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">Upcoming Events</h2>
          <Link to="/events" className="text-sm text-primary hover:text-primary-hover">View all</Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">No upcoming events</div>
        ) : (
          <div className="divide-y divide-border">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}/edit`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-hover transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                  <Calendar size={18} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{event.title}</p>
                  <p className="text-xs text-text-muted">
                    {(() => { try { return format(parseISO(event.date), 'MMM d, yyyy'); } catch { return event.date; } })()}
                    {' '}at {event.time}
                  </p>
                </div>
                {event.category && <span className="badge-primary">{event.category}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Low Stock Widget */}
      <LowStockWidget items={lowStockItems} />
      </div>

      {/* Messages Widget */}
      <div className="mb-6">
        <MessageWidget messages={messages} loading={messagesLoading} />
      </div>
    </div>
  );
}
