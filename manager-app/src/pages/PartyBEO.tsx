import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Printer, Users, Clock, MapPin, Utensils, Wine,
  Mail, Phone, Building2, CalendarDays, Wrench, Sparkles, StickyNote, Maximize2, Minimize2,
} from 'lucide-react';
import { useParty } from '../hooks/useParties';
import { usePartyPackages } from '../hooks/usePackages';
import { computeInvoice, partyToInvoiceInputs } from '../utils/invoice';
import { money as fmtMoney, safeFmtDate } from '../utils/format';
import { formatRange, spaceLabel, type Space } from '../lib/timeWindows';
import { PARTY_STATUS_LABELS, PAYMENT_STATUS_LABELS, type PartyStatus } from '../types';
import { RunOfShow, readRunOfShow } from '../components/parties/RunOfShow';
import { EmptyState } from '../components/ui/EmptyState';

const STATUS_BADGE: Record<PartyStatus, string> = {
  inquiry: 'badge-accent',
  confirmed: 'badge-success',
  cancelled: 'badge-danger',
};

// BEO renders every total to the cent, like an invoice. Route through the shared
// formatter (canonical thousands-separated currency) with cents forced on.
const money = (n: number) => fmtMoney(n, { cents: true });

function fmtDate(d: string | null, fmt = 'EEEE, MMMM d, yyyy') {
  if (!d) return null;
  return safeFmtDate(d, fmt);
}

/** A labelled fact in the BEO grid; renders nothing when empty. */
function Spec({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="text-text-muted mt-0.5 shrink-0 beo-print-ink" />
      <div className="min-w-0">
        <p className="text-xs text-text-muted uppercase tracking-wide">{label}</p>
        <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="beo-section">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted border-b border-border pb-1.5 mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PartyBEO() {
  const { id } = useParams();
  const pid = id ? Number(id) : null;
  const navigate = useNavigate();
  const { party, loading, update } = useParty(pid);
  const { items } = usePartyPackages(pid);
  const [dayOf, setDayOf] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }
  if (!party) {
    return (
      <EmptyState
        title="Party not found"
        action={(
          <button onClick={() => navigate('/parties')} className="btn-secondary inline-flex">
            <ArrowLeft size={16} /> Back to Parties
          </button>
        )}
      />
    );
  }

  const title = party.title?.trim() || `Private Event — ${party.contact_name}`;
  const legacyRange = [party.start_time, party.end_time].filter(Boolean).join(' – ');
  const hasStructuredTime = party.all_day || party.start_min != null;
  const timeDisplay = hasStructuredTime
    ? formatRange(party.start_min, party.end_min, party.all_day)
    : (legacyRange || null);
  const spaceDisplay = [spaceLabel(party.space as Space | null), party.space_name].filter(Boolean).join(' — ');

  const breakdown = computeInvoice(partyToInvoiceInputs(party), items);
  const gratuityPct = Math.round((party.gratuity_rate ?? 0.18) * 100);

  const paid = party.amount_paid ?? 0;
  const balance = party.balance_due ?? Math.max(breakdown.grandTotal - paid, 0);
  const paymentStatus = party.payment_status ?? 'unpaid';

  const timeline = readRunOfShow(party);

  return (
    <div className="max-w-3xl">
      {/* Screen-only toolbar (hidden on print) */}
      <div className="beo-toolbar flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => navigate(`/parties/${party.id}`)} className="btn-ghost -ml-3">
          <ArrowLeft size={18} /> Back to party
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setDayOf((v) => !v)}
          className={dayOf ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
        >
          {dayOf ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          {dayOf ? 'Exit day-of view' : 'Day-of view'}
        </button>
        <button onClick={() => window.print()} className="btn-secondary text-sm">
          <Printer size={15} /> Print
        </button>
      </div>

      <div className={`beo-sheet card p-6 sm:p-8 ${dayOf ? 'beo-dayof' : ''}`}>
        {/* Letterhead */}
        <header className="border-b-2 border-primary pb-4 mb-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-text-muted">Banquet Event Order</p>
              <h1 className="text-2xl font-bold text-text-primary leading-tight beo-print-ink">{title}</h1>
            </div>
            <span className={STATUS_BADGE[party.status]}>{PARTY_STATUS_LABELS[party.status]}</span>
          </div>
          <p className="text-sm text-text-muted mt-1">Iggy's Bar in Seaside · 200 S Franklin St, Seaside, OR 97138</p>
        </header>

        {/* Event header grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <Spec icon={CalendarDays} label="Date" value={fmtDate(party.event_date)} />
          <Spec icon={Clock} label="Event time" value={timeDisplay} />
          <Spec icon={Wrench} label="Setup" value={party.setup_time} />
          <Spec icon={Users} label="Guest count" value={party.guest_count != null ? String(party.guest_count) : null} />
          <Spec icon={MapPin} label="Space" value={spaceDisplay} />
          <Spec icon={Users} label="Booking" value={party.is_private ? 'Private (exclusive)' : 'General (coexisting)'} />
        </div>

        {/* Contact */}
        <Section title="Contact">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <Spec icon={Users} label="Name" value={party.contact_name} />
            <Spec icon={Building2} label="Company / group" value={party.company} />
            <Spec icon={Mail} label="Email" value={party.contact_email} />
            <Spec icon={Phone} label="Phone" value={party.contact_phone} />
          </div>
        </Section>

        {/* Food & drink service */}
        <Section title="Food &amp; drink service">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <Spec icon={Utensils} label="Food service" value={party.food_service_type} />
            <Spec icon={Utensils} label="Food notes" value={party.food_notes} />
            <Spec icon={Wine} label="Drink notes" value={party.drink_notes} />
          </div>
          {!party.food_service_type && !party.food_notes && !party.drink_notes && (
            <p className="text-sm text-text-muted">No food or drink service specified.</p>
          )}
        </Section>

        {/* Packages & totals */}
        <Section title="Packages &amp; totals">
          {breakdown.packageLines.length > 0 ? (
            <table className="w-full text-sm mb-3">
              <tbody>
                {breakdown.packageLines.map((l, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-2 text-text-secondary">
                      {l.name} <span className="text-text-muted">({l.detail})</span>
                    </td>
                    <td className="py-1.5 text-right text-text-primary font-medium whitespace-nowrap">{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-text-muted mb-3">No packages attached.</p>
          )}

          <dl className="text-sm">
            <div className="flex justify-between py-1">
              <dt className="text-text-secondary">Food total</dt>
              <dd className="text-text-primary font-medium">{money(breakdown.foodTotal)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-text-secondary">Drink total</dt>
              <dd className="text-text-primary font-medium">{money(breakdown.drinkTotal)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-text-secondary">Gratuity ({gratuityPct}%)</dt>
              <dd className="text-text-primary font-medium">{money(breakdown.gratuity)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-text-muted">Subtotal (food + drink + gratuity)</dt>
              <dd className="text-text-secondary">{money(breakdown.subtotal)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-text-secondary">Room total</dt>
              <dd className="text-text-primary font-medium">{money(breakdown.roomTotal)}</dd>
            </div>
            {breakdown.addons > 0 && (
              <div className="flex justify-between py-1">
                <dt className="text-text-secondary">Add-ons</dt>
                <dd className="text-text-primary font-medium">{money(breakdown.addons)}</dd>
              </div>
            )}
            <div className="flex justify-between py-2.5 mt-1 border-t-2 border-border text-base font-bold text-text-primary beo-print-ink">
              <dt>Grand total</dt>
              <dd>{money(breakdown.grandTotal)}</dd>
            </div>
          </dl>
        </Section>

        {/* Deposit / balance */}
        <Section title="Deposit &amp; balance">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Paid</p>
                <p className="text-text-primary font-medium">{money(paid)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Balance due</p>
                <p className="text-text-primary font-medium">{money(balance)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Status</p>
                <p className="text-text-primary font-medium">{PAYMENT_STATUS_LABELS[paymentStatus]}</p>
              </div>
            </div>
            {party.deposit_due_date && (
              <p className="text-xs text-text-muted">Deposit due {fmtDate(party.deposit_due_date, 'MMM d, yyyy')}</p>
            )}
          </div>
        </Section>

        {/* Special requests */}
        {party.special_requests && (
          <Section title="Special requests">
            <p className="flex items-start gap-2.5 text-sm text-text-primary whitespace-pre-wrap break-words">
              <Sparkles size={15} className="text-text-muted mt-0.5 shrink-0 beo-print-ink" />
              {party.special_requests}
            </p>
          </Section>
        )}

        {/* Internal notes (printed for the team, never the customer) */}
        {party.internal_notes && (
          <Section title="Internal notes">
            <p className="flex items-start gap-2.5 text-sm text-text-primary whitespace-pre-wrap break-words">
              <StickyNote size={15} className="text-text-muted mt-0.5 shrink-0 beo-print-ink" />
              {party.internal_notes}
            </p>
          </Section>
        )}

        {/* Run of show — read-only checklist on the sheet / day-of, editable below */}
        <Section title="Run of show">
          {timeline.length > 0 ? (
            <ul className="space-y-2">
              {timeline.map((row, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="beo-check mt-0.5 inline-block rounded border-2 border-text-muted shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-text-primary whitespace-nowrap beo-cue-time">{row.time}</span>
                  <span className="text-text-secondary beo-cue-label">{row.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No run-of-show yet — add one below.</p>
          )}
        </Section>
      </div>

      {/* Editor (screen-only) */}
      <div className="beo-toolbar mt-5">
        <RunOfShow party={party} onSave={update} />
      </div>

      {/* BEO print + day-of styling. Scoped to .beo-* class hooks. */}
      <style>{`
        .beo-dayof { font-size: 1.25rem; }
        .beo-dayof .beo-cue-time { font-size: 1.5rem; }
        .beo-dayof .beo-cue-label { font-size: 1.35rem; }
        .beo-dayof .beo-check { width: 1.5rem; height: 1.5rem; }
        .beo-section { margin-bottom: 1.5rem; }
        .beo-check { width: 1rem; height: 1rem; }
        @media print {
          .beo-toolbar { display: none !important; }
          .beo-sheet { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: 100% !important; }
          .beo-print-ink { color: #111 !important; }
          .beo-section { break-inside: avoid; }
          .beo-check { border-color: #111 !important; }
          @page { margin: 14mm; }
        }
      `}</style>
    </div>
  );
}
