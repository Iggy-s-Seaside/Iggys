import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Printer, Send, Receipt, CalendarDays, Users, MapPin, Clock,
  Mail, Phone, Building2, CheckCircle2, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useParty } from '../hooks/useParties';
import { usePartyPackages } from '../hooks/usePackages';
import {
  computeInvoice, partyToInvoiceInputs, getInvoiceNumber, getInvoiceSentAt, makeInvoiceNumber,
} from '../utils/invoice';
import { money as fmtMoney, safeFmtDate } from '../utils/format';
import { formatRange, spaceLabel, type Space } from '../lib/timeWindows';
import { PARTY_STATUS_LABELS, PAYMENT_STATUS_LABELS, type PartyStatus } from '../types';
import { PackagePicker } from '../components/packages/PackagePicker';
import { InvoicePanel } from '../components/parties/InvoicePanel';
import { DepositPanel } from '../components/parties/DepositPanel';
import { EmptyState } from '../components/ui/EmptyState';

const STATUS_BADGE: Record<PartyStatus, string> = {
  inquiry: 'badge-accent',
  confirmed: 'badge-success',
  cancelled: 'badge-danger',
};

// Invoice sheet renders every total to the cent (thousands-separated), like the BEO.
const money = (n: number) => fmtMoney(n, { cents: true });

function fmtDate(d: string | null, fmt = 'EEEE, MMMM d, yyyy') {
  if (!d) return null;
  return safeFmtDate(d, fmt);
}
function fmtStamp(d: string | null) {
  if (!d) return null;
  return safeFmtDate(d, 'MMM d, yyyy h:mm a');
}

function Spec({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="text-text-muted mt-0.5 shrink-0 inv-print-ink" />
      <div className="min-w-0">
        <p className="text-xs text-text-muted uppercase tracking-wide">{label}</p>
        <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{value}</p>
      </div>
    </div>
  );
}

/**
 * Full-page invoice editor. The party IS the invoice — this page mirrors PartyBEO:
 * a polished printable "sheet" up top, then the editing tools (line items, totals,
 * deposit) below. The sheet prints to a clean PDF via the @media print rules.
 *
 * Lifecycle: the invoice number is generated lazily (INV-{id}-{yymm}) the first time
 * the invoice is printed or marked sent, and "sent" is stamped on demand. Nothing
 * is ever emailed automatically from here — the existing InvoicePanel email action
 * is unchanged and still requires an explicit click.
 */
export function PartyInvoice() {
  const { id } = useParams();
  const pid = id ? Number(id) : null;
  const navigate = useNavigate();
  const { party, loading, update } = useParty(pid);
  const { items, addPackage, addCustomLine, updateLine, removeLine } = usePartyPackages(pid);
  const [markingSent, setMarkingSent] = useState(false);

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
  const breakdown = computeInvoice(partyToInvoiceInputs(party), items);
  const gratuityPct = Math.round((party.gratuity_rate ?? 0.18) * 100);

  const paid = party.amount_paid ?? 0;
  // Live balance + status from the current grand total — never the stale stored value
  // (it drifts the moment the invoice is edited after a payment). Deriving the status
  // here too keeps the document from ever printing "Paid" beside a nonzero balance.
  const balance = Math.max(breakdown.grandTotal - paid, 0);
  const paymentStatus = paid <= 0 ? 'unpaid' : balance <= 0.005 ? 'paid' : 'partial';

  const legacyRange = [party.start_time, party.end_time].filter(Boolean).join(' – ');
  const hasStructuredTime = party.all_day || party.start_min != null;
  const timeDisplay = hasStructuredTime
    ? formatRange(party.start_min, party.end_min, party.all_day)
    : (legacyRange || null);
  const spaceDisplay = [spaceLabel(party.space as Space | null), party.space_name].filter(Boolean).join(' — ');

  const existingNumber = getInvoiceNumber(party);
  const sentAt = getInvoiceSentAt(party);

  // Lazily assign + persist an invoice number, returning whatever number is in force.
  // `invoice_number` / `invoice_sent_at` aren't in the shared Party type yet
  // (integrator owns types/index.ts), so updates go through a widened cast. The
  // Supabase client is untyped, so the write itself is fine.
  const ensureInvoiceNumber = async (): Promise<string> => {
    if (existingNumber) return existingNumber;
    const next = makeInvoiceNumber(party);
    await update({ invoice_number: next } as unknown as Partial<typeof party>);
    return next;
  };

  const handlePrint = async () => {
    // Make sure the sheet shows a real invoice number before the print snapshot.
    await ensureInvoiceNumber();
    // Defer to let React paint the number, then print the on-page sheet.
    setTimeout(() => window.print(), 60);
  };

  const handleMarkSent = async () => {
    setMarkingSent(true);
    await ensureInvoiceNumber();
    const ok = await update({ invoice_sent_at: new Date().toISOString() } as unknown as Partial<typeof party>);
    if (ok) toast.success('Invoice marked as sent');
    setMarkingSent(false);
  };

  const displayNumber = existingNumber ?? makeInvoiceNumber(party);

  return (
    <div className="max-w-3xl">
      {/* Screen-only toolbar (hidden on print) */}
      <div className="inv-toolbar flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => navigate(`/parties/${party.id}`)} className="btn-ghost -ml-3">
          <ArrowLeft size={18} /> Back to party
        </button>
        <div className="flex-1" />
        <button onClick={() => navigate(`/parties/${party.id}/beo`)} className="btn-secondary text-sm">
          <FileText size={15} /> View BEO
        </button>
        <button onClick={handleMarkSent} disabled={markingSent} className="btn-secondary text-sm">
          {markingSent ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Mark sent
        </button>
        <button onClick={handlePrint} className="btn-primary text-sm">
          <Printer size={15} /> Print / PDF
        </button>
      </div>

      {/* ── Printable invoice sheet ── */}
      <div className="inv-sheet card p-6 sm:p-8">
        {/* Letterhead */}
        <header className="border-b-2 border-primary pb-4 mb-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-text-muted">Invoice</p>
              <h1 className="text-2xl font-bold text-text-primary leading-tight inv-print-ink">{title}</h1>
            </div>
            <div className="text-right">
              <span className={STATUS_BADGE[party.status]}>{PARTY_STATUS_LABELS[party.status]}</span>
              <p className="text-sm font-mono text-text-secondary mt-1.5 inv-print-ink">{displayNumber}</p>
            </div>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Iggy's Bar in Seaside · 200 S Franklin St, Seaside, OR 97138 · (503) 738-0672
          </p>
        </header>

        {/* Event + contact grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <Spec icon={CalendarDays} label="Event date" value={fmtDate(party.event_date)} />
          <Spec icon={Clock} label="Event time" value={timeDisplay} />
          <Spec icon={Users} label="Guest count" value={party.guest_count != null ? String(party.guest_count) : null} />
          <Spec icon={MapPin} label="Space" value={spaceDisplay} />
          <Spec icon={Users} label="Bill to" value={party.contact_name} />
          <Spec icon={Building2} label="Company / group" value={party.company} />
          <Spec icon={Mail} label="Email" value={party.contact_email} />
          <Spec icon={Phone} label="Phone" value={party.contact_phone} />
        </div>

        {/* Line items */}
        <section className="inv-section mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted border-b border-border pb-1.5 mb-3">
            Line items
          </h3>
          {breakdown.packageLines.length > 0 ? (
            <table className="w-full text-sm">
              <tbody>
                {breakdown.packageLines.map((l, i) => (
                  <tr key={i} className="border-b border-border last:border-0 align-top">
                    <td className="py-1.5 pr-2">
                      <span className="text-text-secondary">{l.name}</span>{' '}
                      <span className="text-text-muted">({l.detail})</span>
                      {l.notes?.trim() && (
                        <span className="block text-xs text-text-muted italic">{l.notes.trim()}</span>
                      )}
                    </td>
                    <td className={`py-1.5 text-right font-medium whitespace-nowrap ${l.amount < 0 ? 'text-danger' : 'text-text-primary'}`}>
                      {money(l.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-text-muted">No line items — add packages or custom lines below.</p>
          )}
        </section>

        {/* Totals */}
        <section className="inv-section mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted border-b border-border pb-1.5 mb-3">
            Totals
          </h3>
          <dl className="text-sm max-w-md ml-auto">
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
            {breakdown.addons !== 0 && (
              <div className="flex justify-between py-1">
                <dt className="text-text-secondary">Add-ons</dt>
                <dd className="text-text-primary font-medium">{money(breakdown.addons)}</dd>
              </div>
            )}
            <div className="flex justify-between py-2.5 mt-1 border-t-2 border-border text-base font-bold text-text-primary inv-print-ink">
              <dt>Grand total</dt>
              <dd>{money(breakdown.grandTotal)}</dd>
            </div>
            <div className="flex justify-between py-1 mt-2">
              <dt className="text-text-secondary">Paid</dt>
              <dd className="text-text-primary font-medium">{money(paid)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-text-secondary">Balance due</dt>
              <dd className="text-text-primary font-medium">{money(balance)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-text-secondary">Status</dt>
              <dd className="text-text-primary font-medium">{PAYMENT_STATUS_LABELS[paymentStatus]}</dd>
            </div>
          </dl>
        </section>

        {party.deposit_due_date && (
          <p className="text-xs text-text-muted">
            Deposit due {fmtDate(party.deposit_due_date, 'MMMM d, yyyy')}
          </p>
        )}
        {sentAt && (
          <p className="inv-toolbar text-xs text-text-muted mt-1 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-primary" /> Invoice sent {fmtStamp(sentAt)}
          </p>
        )}

        <p className="text-sm text-text-muted mt-7 border-t border-border pt-4">
          Thank you for choosing Iggy's Bar in Seaside!
        </p>
      </div>

      {/* ── Editor (screen-only) ── */}
      <div className="inv-toolbar mt-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Receipt size={15} /> Edit invoice
        </div>

        <PackagePicker
          items={items}
          guestCount={party.guest_count}
          roomHours={party.room_hours}
          onAdd={addPackage}
          onAddCustom={addCustomLine}
          onUpdateLine={updateLine}
          onRemoveLine={removeLine}
        />

        <InvoicePanel party={party} lines={items} onSave={update} />

        <DepositPanel party={party} lines={items} onSave={update} />
      </div>

      {/* Invoice print styling — scoped to .inv-* hooks (mirrors PartyBEO). */}
      <style>{`
        .inv-section { margin-bottom: 1.5rem; }
        @media print {
          .inv-toolbar { display: none !important; }
          .inv-sheet { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: 100% !important; }
          .inv-print-ink { color: #111 !important; }
          .inv-section { break-inside: avoid; }
          @page { margin: 14mm; }
        }
      `}</style>
    </div>
  );
}
