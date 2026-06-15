import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, PartyPopper, PackageX, Mail, Sparkles, Activity, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { useParties } from '../../hooks/useParties';
import { useWeather } from '../../hooks/useWeather';
import type { IggyEvent, Special, LunaInsight } from '../../types';

interface TodaysPulseProps {
  events: IggyEvent[];
  activeSpecials: Special[];
  lowStockCount: number;
  unreadCount: number;
  /** Luna's daily demand read (kind='pulse'); when present it replaces the canned line. */
  pulse?: LunaInsight | null;
  /** Forecast-vs-actual accuracy ("Luna's last N calls: X% right"). */
  accuracy?: { pct: number; n: number } | null;
}

// Map a Luna action type to the page that consumes its handoff draft.
const ACTION_ROUTE: Record<string, string> = {
  draft_special: '/specials/editor',
  add_todo: '/todos',
  draft_reply: '/messages',
  review_reply: '/messages',
  party_email: '/parties',
  draft_po: '/cogs',
};
const BAND_CLASS: Record<string, string> = {
  SLOW: 'bg-slate-600',
  STEADY: 'bg-emerald-600',
  BUSY: 'bg-amber-500',
  PACKED: 'bg-red-600',
};

function eventTime(e: IggyEvent): string {
  if (e.all_day) return 'all day';
  if (e.time) return e.time;
  if (e.start_min != null) {
    const h = Math.floor(e.start_min / 60) % 24;
    const m = e.start_min % 60;
    const ampm = h < 12 ? 'am' : 'pm';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${ampm}`;
  }
  return '';
}

/**
 * Today's Pulse — the 5-second "state of the bar" the owner sees over your
 * shoulder. Pure composition over data already loaded by the Dashboard plus one
 * (free, keyless) weather read. Weather is first-class for a coastal bar.
 */
export function TodaysPulse({ events, activeSpecials, lowStockCount, unreadCount, pulse, accuracy }: TodaysPulseProps) {
  const navigate = useNavigate();
  const { parties } = useParties();
  const { weather } = useWeather();

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const weekday = format(new Date(), 'EEEE');

  const tonight = useMemo(
    () =>
      events
        .filter((e) => e.active && (e.date === todayKey || (e.is_recurring && e.recurring_day === weekday)))
        .sort((a, b) => (a.start_min ?? 9999) - (b.start_min ?? 9999)),
    [events, todayKey, weekday]
  );

  const todaysParties = useMemo(
    () => parties.filter((p) => p.status === 'confirmed' && p.event_date === todayKey),
    [parties, todayKey]
  );
  const guestsTonight = todaysParties.reduce((sum, p) => sum + (p.guest_count ?? 0), 0);

  // A tiny opinionated read — the seed of what Luna will say with full context.
  const vibe = (() => {
    const busy = tonight.length > 0 || todaysParties.length > 0;
    if (weather?.goodBeachDay && !busy) return 'Sunny and open — good night to push happy hour on the deck.';
    if (weather && weather.precipProb >= 50 && !busy) return "Wet and quiet — a rainy-day special could pull a few in.";
    if (busy) return 'On the books tonight — make sure pars cover it.';
    return 'Quiet night ahead.';
  })();

  return (
    <div className="relative overflow-hidden rounded-xl mb-6 p-5 text-white shadow-card bg-gradient-to-br from-primary to-accent">
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80 flex items-center gap-1.5">
              <Activity size={13} /> Today's Pulse
            </p>
            <p className="text-lg font-bold leading-tight mt-0.5">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          {weather && (
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold leading-none">{weather.tempF}°</p>
              <p className="text-[11px] text-white/85 mt-0.5 whitespace-nowrap">{weather.summary}</p>
            </div>
          )}
        </div>

        {/* Glance chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link to="/events" className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1.5 text-xs font-medium">
            <Calendar size={13} />
            {tonight.length === 0
              ? 'No events tonight'
              : tonight.map((e) => `${e.title}${eventTime(e) ? ' ' + eventTime(e) : ''}`).slice(0, 2).join(' · ') +
                (tonight.length > 2 ? ` +${tonight.length - 2}` : '')}
          </Link>

          {todaysParties.length > 0 && (
            <Link to="/parties" className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1.5 text-xs font-medium">
              <PartyPopper size={13} />
              {todaysParties.length} part{todaysParties.length === 1 ? 'y' : 'ies'}
              {guestsTonight > 0 ? ` · ${guestsTonight} guests` : ''}
            </Link>
          )}

          {lowStockCount > 0 && (
            <Link to="/inventory" className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1.5 text-xs font-medium">
              <PackageX size={13} /> {lowStockCount} below par
            </Link>
          )}

          {unreadCount > 0 && (
            <Link to="/messages" className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1.5 text-xs font-medium">
              <Mail size={13} /> {unreadCount} unread
            </Link>
          )}

          {activeSpecials.length > 0 && (
            <Link to="/specials" className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1.5 text-xs font-medium">
              <Sparkles size={13} /> {activeSpecials.length} special{activeSpecials.length === 1 ? '' : 's'} live
            </Link>
          )}
        </div>

        {pulse ? (() => {
          const data = (pulse.data ?? {}) as Record<string, unknown>;
          const band = typeof data.band === 'string' ? data.band : null;
          const action = data.action as
            | { type?: string; label?: string; deep_link?: string; draft?: string; payload?: unknown }
            | undefined;
          const deepLink =
            action?.deep_link ??
            (typeof data.deep_link === 'string' ? (data.deep_link as string) : undefined) ??
            (action?.type ? ACTION_ROUTE[action.type] : undefined);
          return (
            <div className="mt-3.5">
              <div className="flex items-start gap-2">
                {band && (
                  <span className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-md ${BAND_CLASS[band] ?? 'bg-white/25'}`}>
                    {band}
                  </span>
                )}
                <p className="text-[13px] text-white/95 leading-snug whitespace-pre-line">{pulse.body}</p>
              </div>
              {action && deepLink && (
                <button
                  onClick={() => navigate(deepLink, { state: { lunaDraft: action.draft, lunaPayload: action.payload, fromInsight: pulse.id } })}
                  className="mt-2.5 inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:scale-[0.98] transition rounded-lg px-3 py-2 text-xs font-semibold"
                >
                  {action.label || 'Do it'} <ArrowRight size={13} />
                </button>
              )}
              {accuracy && accuracy.n >= 2 && (
                <p className="text-[11px] text-white/70 mt-2">
                  Luna's last {accuracy.n} calls: {accuracy.pct}% on the money
                </p>
              )}
            </div>
          );
        })() : (
          <p className="text-[13px] text-white/90 mt-3.5 leading-snug">{vibe}</p>
        )}
      </div>
    </div>
  );
}
