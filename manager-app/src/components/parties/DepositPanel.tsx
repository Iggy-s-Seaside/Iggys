import { useState } from 'react';
import { Loader2, CreditCard, Link2, Copy, Check, CheckCircle2, CalendarClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type { Party, PartyPackage, PaymentStatus } from '../../types';
import { computeInvoice, partyToInvoiceInputs } from '../../utils/invoice';
import { money as fmtMoney } from '../../utils/format';
import { usePayments } from '../../hooks/usePayments';

interface DepositPanelProps {
  party: Party;
  lines: PartyPackage[];
  onSave: (fields: Partial<Party>) => Promise<boolean>;
}

// Deposit/balance amounts render to the cent through the shared formatter.
const money = (n: number) => fmtMoney(n, { cents: true });

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
}
function fmtStamp(d: string | null): string | null {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d, yyyy h:mm a'); } catch { return d; }
}

const STATUS_META: Record<PaymentStatus, { label: string; badge: string }> = {
  paid: { label: 'Paid', badge: 'badge-success' },
  partial: { label: 'Partial', badge: 'badge-accent' },
  unpaid: { label: 'Owed', badge: 'badge-danger' },
};

export function DepositPanel({ party, lines, onSave }: DepositPanelProps) {
  const { requestCheckoutLink, markPaid, requesting, marking } = usePayments();

  const breakdown = computeInvoice(partyToInvoiceInputs(party), lines);
  const grandTotal = breakdown.grandTotal;

  const depositAmount = party.deposit_amount ?? 0;
  const amountPaid = party.amount_paid ?? 0;
  // Trust the stored balance when present; otherwise derive from the live grand total.
  const balanceDue = party.balance_due ?? Math.max(0, grandTotal - amountPaid);
  // Trust the stored status when present; otherwise derive it from what's been paid.
  const resolvedStatus: PaymentStatus =
    party.payment_status ?? (amountPaid <= 0 ? 'unpaid' : balanceDue <= 0.005 ? 'paid' : 'partial');
  const chip = STATUS_META[resolvedStatus] ?? STATUS_META.unpaid;

  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Manual "mark paid" inputs — default to clearing the balance.
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAmount, setManualAmount] = useState(
    String((depositAmount > 0 && amountPaid <= 0 ? depositAmount : balanceDue).toFixed(2))
  );

  const handleRequest = async () => {
    try {
      const res = await requestCheckoutLink({ partyId: party.id, purpose: 'party_deposit' });
      setLink(res.url);
      setCopied(false);
      if (res.paymentIntentId && res.paymentIntentId !== party.payment_intent_id) {
        await onSave({ payment_intent_id: res.paymentIntentId });
      }
      toast.success('Payment link ready');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create payment link');
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy — long-press the link to copy.');
    }
  };

  const handleMarkPaid = async () => {
    const entered = parseFloat(manualAmount);
    if (!Number.isFinite(entered) || entered < 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    const newPaid = amountPaid + entered;
    const ok = await markPaid({
      partyId: party.id,
      amountPaid: newPaid,
      depositAmount,
      grandTotal,
    });
    if (ok) {
      await onSave({});
      setManualOpen(false);
      toast.success('Payment recorded');
    } else {
      toast.error('Could not record payment');
    }
  };

  const row = (label: string, value: number, opts?: { strong?: boolean; muted?: boolean }) => (
    <div className={`flex items-center justify-between py-1.5 ${opts?.strong ? 'border-t border-border mt-1 pt-2.5 text-base font-bold text-text-primary' : ''}`}>
      <span className={opts?.muted ? 'text-sm text-text-muted' : 'text-sm text-text-secondary'}>{label}</span>
      <span className={opts?.strong ? '' : 'text-sm font-medium text-text-primary'}>{money(value)}</span>
    </div>
  );

  const dueDate = fmtDate(party.deposit_due_date);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <CreditCard size={14} /> Deposit &amp; payment
        </h3>
        <span className={chip.badge}>{chip.label}</span>
      </div>

      {/* Lifecycle summary */}
      <div className="mb-4">
        {row('Deposit due', depositAmount)}
        {row('Amount paid', amountPaid)}
        {row('Balance due', balanceDue, { strong: true })}
      </div>

      {(dueDate || party.paid_at) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
          {dueDate && (
            <span className="flex items-center gap-1.5">
              <CalendarClock size={13} /> Deposit due by {dueDate}
            </span>
          )}
          {party.paid_at && (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-primary" /> Last payment {fmtStamp(party.paid_at)}
            </span>
          )}
        </div>
      )}

      {/* Returned payment link */}
      {link && (
        <div className="mb-4 rounded-lg bg-surface-hover/50 border border-border p-3">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            <Link2 size={13} /> Share this secure Stripe link with the customer
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="input-field text-xs flex-1 min-w-0"
            />
            <button onClick={handleCopy} className="btn-secondary text-xs shrink-0" type="button">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-2 inline-block">
            Open checkout page
          </a>
        </div>
      )}

      {/* Manual payment entry */}
      {manualOpen && (
        <div className="mb-4 rounded-lg bg-surface-hover/50 border border-border p-3">
          <label className="label">Amount received ($)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="any"
              className="input-field flex-1"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
            />
            <button onClick={handleMarkPaid} disabled={marking} className="btn-primary text-sm shrink-0" type="button">
              {marking ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Record
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Adds to the {money(amountPaid)} already paid. Use for cash or card-on-file taken offline.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleRequest} disabled={requesting} className="btn-primary text-sm" type="button">
          {requesting ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />} Request deposit
        </button>
        <button
          onClick={() => setManualOpen((v) => !v)}
          className="btn-secondary text-sm"
          type="button"
        >
          <Check size={15} /> Mark paid
        </button>
      </div>
    </div>
  );
}
