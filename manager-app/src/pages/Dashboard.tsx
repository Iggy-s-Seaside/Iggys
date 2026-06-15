import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Sparkles, UtensilsCrossed, Plus, TrendingUp, Camera, MessageSquare, Moon, ChevronRight, ClipboardCheck, Zap } from 'lucide-react';
import { useSupabaseCRUD } from '../hooks/useSupabaseCRUD';
import { useInventoryItems, getLowStockItems } from '../hooks/useInventory';
import { useMessages } from '../hooks/useMessages';
import { useTodos } from '../hooks/useTodos';
import { useLunaInsights } from '../hooks/useLuna';
import { useShift } from '../hooks/useShift';
import { useAutoOpenShift } from '../hooks/useAutoOpenShift';
import { QuickPostModal } from '../components/editor/QuickPostModal';
import { LowStockWidget } from '../components/inventory/LowStockWidget';
import { MessageWidget } from '../components/messages/MessageWidget';
import { PartiesTodayWidget } from '../components/parties/PartiesTodayWidget';
import { TodoWidget } from '../components/todos/TodoWidget';
import { TodaysPulse } from '../components/dashboard/TodaysPulse';
import { SpecialIdeaCard } from '../components/dashboard/SpecialIdeaCard';
import { CloseOutCard } from '../components/dashboard/CloseOutCard';
import { OwnerMoneyStrip } from '../components/dashboard/OwnerMoneyStrip';
import { useDemandLog } from '../hooks/useDemandLog';
import { useAuth } from '../context/AuthContext';
import { useWeather } from '../hooks/useWeather';
import { needsReplyNow } from '../utils/triage';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { PageHeader } from '../components/ui/PageHeader';
import type { IggyEvent, Special } from '../types';
import { format, parseISO, isFuture } from 'date-fns';

export function Dashboard() {
  // Auto-open the bar during posted business hours (renders nothing).
  useAutoOpenShift();
  const { data: events } = useSupabaseCRUD<IggyEvent>('events');
  const { data: specials, refresh: refreshSpecials } = useSupabaseCRUD<Special>('specials');
  const { items: inventoryItems } = useInventoryItems();
  const lowStockItems = getLowStockItems(inventoryItems);
  const { messages, loading: messagesLoading } = useMessages();
  const { todos, loading: todosLoading, toggle: toggleTodo } = useTodos();
  const { insights, latestPulse, latestSpecial } = useLunaInsights();
  const demand = useDemandLog();
  const { current: openShift } = useShift();
  const { firstName, role } = useAuth();
  const { weather } = useWeather();
  const [quickPostOpen, setQuickPostOpen] = useState(false);
  const unreadMessages = messages.filter(m => m.status === 'unread');
  const needsReplyMessages = messages.filter(needsReplyNow);
  const newInsights = insights.filter((i) => i.status === 'new');
  const latestInsight = newInsights[0] ?? null;

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

  // Personal, time- + weather-aware greeting — the app should feel like it knows
  // who's holding the phone and what the day outside looks like.
  const h = new Date().getHours();
  const timeGreeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const greetingTitle = firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;
  const stateLine = (() => {
    if (weather?.goodBeachDay) return "Beach weather — the deck's gonna fill.";
    if (weather && weather.precipProb >= 60) return 'Grey and wet — a good day for a cozy special.';
    if (unreadMessages.length > 0) return `${unreadMessages.length} unread message${unreadMessages.length === 1 ? '' : 's'} waiting.`;
    if (weather) return `${weather.summary}.`;
    return 'Welcome back.';
  })();

  return (
    <div>
      <OnboardingChecklist />
      <PageHeader title={greetingTitle} subtitle={stateLine} />

      {/* Owner-only money strip — for the owner, the money leads; for everyone
          else the ops cockpit (shift/low-stock/messages) is what matters. */}
      {role === 'owner' && <OwnerMoneyStrip />}

      {/* Today's Pulse — the 5-second state of the bar + weather */}
      <TodaysPulse
        events={events}
        activeSpecials={activeSpecials}
        lowStockCount={lowStockItems.length}
        unreadCount={unreadMessages.length}
        pulse={latestPulse}
        accuracy={demand.accuracy}
      />

      {/* Luna's creative special-of-the-day */}
      <SpecialIdeaCard special={latestSpecial} />

      {/* Nightly close-out — teaches Luna's forecast */}
      <CloseOutCard todayRow={demand.todayRow} saving={demand.saving} onLog={demand.logActual} />

      {/* Needs your attention — parties surfaced first */}
      <PartiesTodayWidget />

      {/* Needs a reply — reservations & requests Luna flagged in the inbox */}
      {needsReplyMessages.length > 0 && (
        <Link
          to="/messages"
          className="card-hover p-4 mb-6 flex items-center gap-3 group active:scale-[0.99] transition-transform border-amber-500/30 bg-amber-500/5"
        >
          <div className="p-2.5 rounded-lg bg-amber-500/15 shrink-0">
            <Zap size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">
              {needsReplyMessages.length} email{needsReplyMessages.length === 1 ? '' : 's'} need a reply
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Reservations &amp; requests waiting — Luna flagged these as high priority.
            </p>
          </div>
          <ChevronRight size={18} className="text-text-muted shrink-0 group-hover:text-text-primary transition-colors" />
        </Link>
      )}

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

      {/* Shift status — quick link to the Service cockpit (no longer leads the page) */}
      <Link
        to="/shift"
        className="card-hover p-4 mb-6 flex items-center gap-3 group active:scale-[0.99] transition-transform"
      >
        <div className={`p-2.5 rounded-lg shrink-0 ${openShift ? 'bg-green-50 dark:bg-green-500/10' : 'bg-surface-hover'}`}>
          <ClipboardCheck size={20} className={openShift ? 'text-green-600 dark:text-green-400' : 'text-text-muted'} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">Shift</p>
            <span className={openShift ? 'badge-success' : 'badge'}>
              {openShift ? 'Bar is OPEN' : 'Bar is closed'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {openShift
              ? 'Run line checks, log the floor, close out the night.'
              : 'Open the bar to start checks, the log, and close-out.'}
          </p>
        </div>
        <ChevronRight size={18} className="text-text-muted shrink-0 group-hover:text-text-primary transition-colors" />
      </Link>

      {/* Luna */}
      <Link
        to="/luna"
        className="card-hover p-5 mb-8 flex items-center gap-4 group active:scale-[0.99] transition-transform"
      >
        <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20 transition-colors shrink-0 self-start">
          <Moon size={20} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">Luna</p>
            {newInsights.length > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {newInsights.length} new
              </span>
            )}
          </div>
          {latestInsight ? (
            <>
              <p className="text-sm font-medium text-text-primary mt-1 truncate">{latestInsight.title}</p>
              <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{latestInsight.body}</p>
            </>
          ) : (
            <p className="text-xs text-text-muted mt-1">
              Ask Luna anything about the bar — sales, inventory, parties, ideas.
            </p>
          )}
        </div>
        <ChevronRight size={18} className="text-text-muted shrink-0 group-hover:text-text-primary transition-colors" />
      </Link>

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

      {/* Messages + To-Do Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <MessageWidget messages={messages} loading={messagesLoading} />
        <TodoWidget todos={todos} loading={todosLoading} onToggle={toggleTodo} />
      </div>
    </div>
  );
}
