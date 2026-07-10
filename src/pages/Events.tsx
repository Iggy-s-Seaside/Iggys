import { Link } from 'react-router-dom';
import {
    Calendar,
    Clock,
    MapPin,
    Sparkles,
    Repeat,
    Wine,
    UtensilsCrossed,
    Sun,
    Instagram,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import SectionHeader from '../components/layout/SectionHeader';
import LoadingSkeleton from '../components/menu/LoadingSkeleton';
import EventsCalendar from '../components/events/EventsCalendar';
import EventsJsonLd from '../components/events/EventsJsonLd';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { useEvents, useSpecials } from '../hooks/useMenuData';
import { usePublicCalendar } from '../hooks/usePublicCalendar';
import { eventDateKeys, todayKey } from '../lib/calendarDates';
import { isSpecialLive } from '../utils/specialsWindow';
import type { IggyEvent, Special } from '../types/menu';

function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return {
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        day: d.getDate(),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    };
}

/** Recurring events badge their NEXT occurrence, not the (stale) anchor date. */
function displayDateFor(event: IggyEvent): string {
    if (!event.is_recurring) return event.date;
    const from = todayKey();
    const [y, m, d] = from.split('-').map(Number);
    const to = new Date(y, m - 1, d + 13);
    const toKey = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(
        to.getDate(),
    ).padStart(2, '0')}`;
    return eventDateKeys(event, from, toKey)[0] ?? event.date;
}

function EventCard({ event }: { event: IggyEvent }) {
    const { ref, isVisible } = useScrollAnimation();
    const date = formatDate(displayDateFor(event));

    return (
        <div
            ref={ref}
            className={`glass-card-hover overflow-hidden ${
                isVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-6'
            }`}
        >
            <div className="flex flex-col md:flex-row">
                {/* Image */}
                {event.image_url && (
                    <div className="md:w-72 lg:w-80 shrink-0">
                        <img
                            src={event.image_url}
                            alt={event.title}
                            className="w-full h-48 md:h-full object-cover"
                            loading="lazy"
                        />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 p-6 flex gap-5">
                    {/* Date badge */}
                    <div className="shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/20">
                        <span className="text-primary text-xs font-bold uppercase">
                            {date.month}
                        </span>
                        <span className="text-white text-xl font-bold leading-none">
                            {date.day}
                        </span>
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-heading text-xl font-bold text-white">
                                {event.title}
                            </h3>
                            {event.is_recurring && (
                                <span className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs font-semibold px-2.5 py-0.5 rounded-full border border-accent/20">
                                    <Repeat className="w-3 h-3" />
                                    Every {event.recurring_day}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-text-muted mb-3">
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary/60" />
                                {event.time}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-primary/60" />
                                Iggy's Seaside
                            </span>
                        </div>

                        <p className="text-text-muted text-sm leading-relaxed">
                            {event.description}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

const SPECIAL_ICONS: Record<string, typeof Wine> = {
    drink: Wine,
    food: UtensilsCrossed,
    seasonal: Sun,
};

const SPECIAL_COLORS: Record<string, string> = {
    drink: 'bg-primary/10 text-primary border-primary/20',
    food: 'bg-accent/10 text-accent border-accent/20',
    seasonal: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

function SpecialCard({ special }: { special: Special }) {
    const { ref, isVisible } = useScrollAnimation();
    const Icon = SPECIAL_ICONS[special.type] ?? Sparkles;
    const colorClass = SPECIAL_COLORS[special.type] ?? SPECIAL_COLORS.drink;

    return (
        <div
            ref={ref}
            className={`glass-card-hover overflow-hidden ${
                isVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-6'
            }`}
        >
            {/* Designed graphic from the Specials maker, when present */}
            {special.image_url && (
                <img
                    src={special.image_url}
                    alt={special.title}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                />
            )}
            <div className="p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClass}`}
                        >
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-heading text-lg font-semibold text-white">
                                {special.title}
                            </h3>
                            <span
                                className={`text-xs font-semibold uppercase tracking-wider ${colorClass.split(' ')[1]}`}
                            >
                                {special.type}
                            </span>
                        </div>
                    </div>
                    {special.price && (
                        <span className="text-primary font-bold text-lg shrink-0">
                            {special.price}
                        </span>
                    )}
                </div>
                <p className="text-text-muted text-sm leading-relaxed">
                    {special.description}
                </p>
            </div>
        </div>
    );
}

export default function Events() {
    const { data: events, loading: eventsLoading } = useEvents();
    const { data: specials, loading: specialsLoading } = useSpecials();
    const {
        eventsByDay,
        reservedByDay,
        loading: calendarLoading,
    } = usePublicCalendar();

    const activeEvents = events.filter((e) => e.active);
    const activeSpecials = specials.filter((s) => isSpecialLive(s));

    return (
        <div>
            {/* Google event rich-results markup — data-driven from the same rows */}
            <EventsJsonLd events={events} />
            <PageHeader
                eyebrow="What's Happening"
                title="Events & Specials"
                subtitle="Live music, seasonal drinks, and more — there's always something going on at Iggy's"
            />

            {/* Calendar */}
            <section className="section-padding">
                <div className="section-container">
                    <SectionHeader eyebrow="Calendar" title="What's on" />

                    <div className="mt-8">
                        <EventsCalendar
                            eventsByDay={eventsByDay}
                            reservedByDay={reservedByDay}
                            loading={calendarLoading}
                        />
                    </div>
                </div>
            </section>

            {/* Upcoming Events */}
            <section className="section-padding">
                <div className="section-container">
                    <SectionHeader
                        eyebrow="Upcoming"
                        title="Events at Iggy's"
                    />

                    <div className="mt-8 space-y-6">
                        {eventsLoading ? (
                            <LoadingSkeleton count={3} />
                        ) : activeEvents.length > 0 ? (
                            activeEvents.map((event) => (
                                <EventCard key={event.id} event={event} />
                            ))
                        ) : (
                            <div className="glass-card p-12 text-center">
                                <Calendar className="w-10 h-10 text-primary/40 mx-auto mb-4" />
                                <h3 className="font-heading text-xl text-white mb-2">
                                    No upcoming events
                                </h3>
                                <p className="text-text-muted mb-6">
                                    Check back soon — we're always planning
                                    something fun.
                                </p>
                                <a
                                    href="https://www.instagram.com/iggysseaside/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-outline text-sm"
                                >
                                    <Instagram className="w-4 h-4" />
                                    Follow us for event announcements
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Current Specials */}
            <section className="section-padding bg-surface/30">
                <div className="section-container">
                    <SectionHeader
                        eyebrow="Limited Time"
                        title="Current specials"
                    />

                    <div className="mt-8">
                        {specialsLoading ? (
                            <LoadingSkeleton count={3} />
                        ) : activeSpecials.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activeSpecials.map((special) => (
                                    <SpecialCard
                                        key={special.id}
                                        special={special}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="glass-card p-12 text-center">
                                <Sparkles className="w-10 h-10 text-accent/40 mx-auto mb-4" />
                                <h3 className="font-heading text-xl text-white mb-2">
                                    No current specials
                                </h3>
                                <p className="text-text-muted mb-6">
                                    Our regular menu is always available. Happy
                                    hour is daily 3-5pm!
                                </p>
                                <Link to="/happy-hour" className="btn-primary text-sm">
                                    View Happy Hour Deals
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Happy Hour CTA */}
            <section className="section-padding">
                <div className="section-container">
                    <div className="glass-card p-8 text-center">
                        <h3 className="font-heading text-2xl font-bold text-white mb-3">
                            Don't forget happy hour
                        </h3>
                        <p className="text-text-muted mb-6">
                            Every day, 3pm to 5pm. Discounted drafts, wells, and
                            bar bites.
                        </p>
                        <Link to="/happy-hour" className="btn-primary">
                            View Happy Hour
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
