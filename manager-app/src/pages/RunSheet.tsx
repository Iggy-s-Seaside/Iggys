import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Calendar,
  PartyPopper,
  Sparkles,
  GlassWater,
  PackageX,
  Users,
  Clock,
  MapPin,
  Megaphone,
  Printer,
  Utensils,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  useRunSheet,
  eventTimeLabel,
  eventSpaceLabel,
  partySpaceLabel,
  type HuddleBullet,
} from '../hooks/useRunSheet';
import type { IggyEvent, Party, Special, HappyHourItem, InventoryItem } from '../types';

// ── Section shell ──

function Section({
  icon: Icon,
  title,
  count,
  accent,
  to,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  accent: string; // tailwind text color class for the icon
  to?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden print:border print:border-gray-300 print:shadow-none print:break-inside-avoid">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <Icon size={18} className={accent} />
          {title}
          {count != null && count > 0 && (
            <span className="badge bg-surface-hover text-text-muted">{count}</span>
          )}
        </h2>
        {to && (
          <Link
            to={to}
            className="text-sm text-primary hover:text-primary-hover print:hidden flex items-center gap-0.5"
          >
            Open <ChevronRight size={14} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="px-5 py-5 text-sm text-text-muted">{text}</div>;
}

// ── Huddle ──

const HUDDLE_DOT: Record<HuddleBullet['tone'], string> = {
  focus: 'bg-primary',
  push: 'bg-accent',
  watch: 'bg-danger',
  info: 'bg-text-muted',
};

function HuddleBlock({ bullets }: { bullets: HuddleBullet[] }) {
  return (
    <section className="relative overflow-hidden rounded-xl shadow-card text-white bg-gradient-to-br from-primary to-accent print:bg-none print:text-black print:border print:border-gray-400 print:shadow-none print:break-inside-avoid">
      <div className="absolute inset-0 bg-black/10 pointer-events-none print:hidden" />
      <div className="relative p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80 flex items-center gap-1.5 print:text-gray-600">
          <Megaphone size={14} /> Pre-Shift Huddle
        </p>
        <p className="text-lg font-bold leading-tight mt-1 print:text-black">Read this to the floor</p>

        <ul className="mt-4 space-y-3">
          {bullets.map((b) => (
            <li key={b.id} className="flex items-start gap-3">
              <span
                className={`mt-2 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white/40 print:ring-0 ${HUDDLE_DOT[b.tone]} print:bg-black`}
              />
              <p className="text-[15px] sm:text-base leading-snug text-white print:text-black">{b.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Events ──

function EventRow({ event }: { event: IggyEvent }) {
  const time = eventTimeLabel(event);
  const space = eventSpaceLabel(event);
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 min-h-[60px] print:break-inside-avoid">
      <div className="w-11 h-11 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 print:bg-gray-100">
        <Calendar size={18} className="text-primary print:text-black" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-text-primary truncate">{event.title}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted mt-0.5">
          {time && (
            <span className="flex items-center gap-1">
              <Clock size={12} /> {time}
            </span>
          )}
          {space && (
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {space}
            </span>
          )}
        </div>
      </div>
      {event.category && <span className="badge-primary shrink-0">{event.category}</span>}
    </div>
  );
}

// ── Parties ──

function PartyCard({ party }: { party: Party }) {
  const name = party.title?.trim() || party.contact_name;
  const space = partySpaceLabel(party);
  return (
    <Link
      to={`/parties/${party.id}`}
      className="block px-5 py-4 hover:bg-surface-hover transition-colors print:break-inside-avoid"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-text-primary truncate">{name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted mt-1">
            {party.guest_count != null && (
              <span className="flex items-center gap-1">
                <Users size={12} /> {party.guest_count} guests
              </span>
            )}
            {space && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {space}
              </span>
            )}
            {party.setup_time?.trim() && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> Set up {party.setup_time.trim()}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={18} className="text-text-muted shrink-0 mt-1 print:hidden" />
      </div>

      {(party.food_service_type || party.drink_notes?.trim() || party.food_notes?.trim()) && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {party.food_service_type && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-surface-hover text-text-secondary">
              <Utensils size={11} /> {party.food_service_type}
            </span>
          )}
          {party.drink_notes?.trim() && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-surface-hover text-text-secondary">
              <GlassWater size={11} /> {party.drink_notes.trim()}
            </span>
          )}
        </div>
      )}

      {party.special_requests?.trim() && (
        <p className="mt-2.5 text-sm text-text-secondary bg-warning-light rounded-lg px-3 py-2 leading-snug">
          <span className="font-semibold text-accent-hover">Requests: </span>
          {party.special_requests.trim()}
        </p>
      )}
    </Link>
  );
}

// ── Specials + Happy Hour ──

function SpecialRow({ special }: { special: Special }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 min-h-[56px] print:break-inside-avoid">
      <div className="w-10 h-10 rounded-lg bg-warning-light flex items-center justify-center shrink-0 print:bg-gray-100">
        <Sparkles size={16} className="text-accent print:text-black" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary truncate">{special.title}</p>
        {special.description && (
          <p className="text-xs text-text-muted line-clamp-1">{special.description}</p>
        )}
      </div>
      {special.price && (
        <span className="text-sm font-semibold text-text-primary shrink-0 tabular-nums">
          {special.price}
        </span>
      )}
    </div>
  );
}

function HappyHourRow({ item }: { item: HappyHourItem }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 min-h-[52px] print:break-inside-avoid">
      <span className="badge-accent shrink-0 capitalize">{item.type}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
        {item.description && <p className="text-xs text-text-muted line-clamp-1">{item.description}</p>}
      </div>
      <span className="text-sm font-semibold text-text-primary shrink-0 tabular-nums">{item.price}</span>
    </div>
  );
}

// ── Low stock ──

function LowStockRow({ item }: { item: InventoryItem }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 min-h-[52px] print:break-inside-avoid">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
        {item.inventory_categories?.name && (
          <p className="text-xs text-text-muted">{item.inventory_categories.name}</p>
        )}
      </div>
      <span className="badge-danger shrink-0 tabular-nums">
        {item.current_quantity} / {item.par_level} {item.unit}
      </span>
    </div>
  );
}

// ── Page ──

export function RunSheet() {
  const sheet = useRunSheet();

  if (sheet.loading) {
    return (
      <div className="card p-16 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const nothingTonight =
    sheet.events.length === 0 &&
    sheet.parties.length === 0 &&
    sheet.specials.length === 0 &&
    sheet.happyHour.length === 0 &&
    sheet.lowStock.length === 0;

  return (
    <div className="max-w-3xl mx-auto print:max-w-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2 print:text-black">
            <ClipboardList size={24} className="text-primary print:text-black" />
            Run Sheet
          </h1>
          <p className="text-sm text-text-muted mt-1">{sheet.dateLabel}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-secondary print:hidden shrink-0 min-h-[44px]"
          aria-label="Print or cast the run sheet"
        >
          <Printer size={16} />
          <span className="hidden sm:inline">Print / Cast</span>
        </button>
      </div>

      {/* At-a-glance strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 print:hidden">
        {[
          { label: 'Events', value: sheet.events.length, icon: Calendar, accent: 'text-primary' },
          { label: 'Parties', value: sheet.parties.length, icon: PartyPopper, accent: 'text-accent' },
          { label: 'Booked guests', value: sheet.guestsTonight, icon: Users, accent: 'text-blue-600 dark:text-blue-400' },
          { label: 'Below par', value: sheet.lowStock.length, icon: PackageX, accent: 'text-danger' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="card p-3 sm:p-4">
            <div className="flex items-center gap-2.5">
              <Icon size={18} className={accent} />
              <div className="min-w-0">
                <p className="text-xl font-bold text-text-primary leading-none">{value}</p>
                <p className="text-[11px] text-text-muted leading-tight mt-1 truncate">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Huddle — first, it's the deliverable */}
      <div className="mb-6">
        <HuddleBlock bullets={sheet.huddle} />
      </div>

      {nothingTonight && (
        <div className="card p-8 text-center mb-6 print:break-inside-avoid">
          <Sparkles size={28} className="mx-auto text-text-muted mb-2" />
          <p className="text-sm font-medium text-text-secondary">Nothing scheduled for tonight</p>
          <p className="text-xs text-text-muted mt-1">
            No events, parties, specials, or low-stock flags. Run the huddle and keep it tight.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Events tonight */}
        {sheet.events.length > 0 && (
          <Section icon={Calendar} title="Tonight's Events" count={sheet.events.length} accent="text-primary" to="/events">
            <div className="divide-y divide-border">
              {sheet.events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          </Section>
        )}

        {/* Confirmed parties today */}
        {sheet.parties.length > 0 && (
          <Section icon={PartyPopper} title="Private Bookings" count={sheet.parties.length} accent="text-accent" to="/parties">
            <div className="divide-y divide-border">
              {sheet.parties.map((p) => (
                <PartyCard key={p.id} party={p} />
              ))}
            </div>
          </Section>
        )}

        {/* Specials to push */}
        {sheet.specials.length > 0 && (
          <Section icon={Sparkles} title="Specials to Push" count={sheet.specials.length} accent="text-accent" to="/specials">
            <div className="divide-y divide-border">
              {sheet.specials.map((s) => (
                <SpecialRow key={s.id} special={s} />
              ))}
            </div>
          </Section>
        )}

        {/* Happy hour */}
        {sheet.happyHour.length > 0 && (
          <Section icon={GlassWater} title="Happy Hour" count={sheet.happyHour.length} accent="text-primary" to="/menu/happy_hour">
            <div className="divide-y divide-border">
              {sheet.happyHour.map((h) => (
                <HappyHourRow key={h.id} item={h} />
              ))}
            </div>
          </Section>
        )}

        {/* Low stock that matters tonight */}
        {sheet.lowStock.length > 0 ? (
          <Section icon={PackageX} title="Watch / Low Stock" count={sheet.lowStock.length} accent="text-danger" to="/inventory">
            <div className="divide-y divide-border">
              {sheet.lowStock.map((i) => (
                <LowStockRow key={i.id} item={i} />
              ))}
            </div>
          </Section>
        ) : (
          !nothingTonight && (
            <Section icon={PackageX} title="Watch / Low Stock" accent="text-text-muted">
              <EmptyRow text="Everything is above par — nothing at risk of running out tonight." />
            </Section>
          )
        )}
      </div>

      {/* Print footer */}
      <p className="hidden print:block text-xs text-gray-500 mt-6 text-center">
        Iggy's — Run Sheet for {sheet.dateLabel}
      </p>
    </div>
  );
}
