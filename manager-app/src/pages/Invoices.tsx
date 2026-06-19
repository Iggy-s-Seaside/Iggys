import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, ChevronRight, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useParties } from '../hooks/useParties';
import { computeInvoice, partyToInvoiceInputs, getInvoiceSentAt } from '../utils/invoice';
import { money, safeFmtDate } from '../utils/format';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { PARTY_STATUS_LABELS, type Party, type PartyPackage, type PartyStatus } from '../types';

const STATUS_BADGE: Record<PartyStatus, string> = {
  inquiry: 'badge-accent',
  confirmed: 'badge-success',
  cancelled: 'badge-danger',
};

/** Paid is derived from the stored payment_status (no second source of truth). */
function isPaid(p: Party): boolean {
  return p.payment_status === 'paid';
}
function isPartial(p: Party): boolean {
  return p.payment_status === 'partial';
}

export function Invoices() {
  const { parties, loading } = useParties();
  const navigate = useNavigate();
  const [linesByParty, setLinesByParty] = useState<Record<number, PartyPackage[]>>({});
  const [linesLoading, setLinesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from('party_packages').select('*');
      if (!active) return;
      const grouped: Record<number, PartyPackage[]> = {};
      for (const row of (data as PartyPackage[]) || []) {
        (grouped[row.party_id] ??= []).push(row);
      }
      setLinesByParty(grouped);
      setLinesLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => {
    return parties
      .map((p) => {
        const lines = linesByParty[p.id] || [];
        const breakdown = computeInvoice(partyToInvoiceInputs(p), lines);
        return { party: p, breakdown, hasData: breakdown.grandTotal > 0 || lines.length > 0 };
      })
      .filter((r) => r.hasData)
      .sort((a, b) => (b.party.event_date || '').localeCompare(a.party.event_date || ''));
  }, [parties, linesByParty]);

  const confirmedTotal = rows
    .filter((r) => r.party.status === 'confirmed')
    .reduce((sum, r) => sum + r.breakdown.grandTotal, 0);

  const busy = loading || linesLoading;

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Every party with billing details — open one to edit or send it"
      />

      {!busy && rows.length > 0 && (
        <div className="card p-5 mb-5 flex items-center justify-between">
          <span className="text-sm text-text-secondary">Confirmed events total</span>
          <span className="text-xl font-bold text-text-primary">{money(confirmedTotal, { cents: true })}</span>
        </div>
      )}

      {busy ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="Add packages or totals to a party and it'll show up here."
        />
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {rows.map(({ party, breakdown }) => {
            const sent = getInvoiceSentAt(party);
            const paid = isPaid(party);
            const partial = isPartial(party);
            return (
              <button
                key={party.id}
                onClick={() => navigate(`/parties/${party.id}/invoice`)}
                className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-surface-hover transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                  <Receipt size={18} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-text-primary truncate">{party.title?.trim() || party.contact_name}</p>
                    <span className={STATUS_BADGE[party.status]}>{PARTY_STATUS_LABELS[party.status]}</span>
                    {paid ? (
                      <span className="badge-success inline-flex items-center gap-1">
                        <CheckCircle2 size={11} /> Paid
                      </span>
                    ) : partial ? (
                      <span className="badge-accent">Partial</span>
                    ) : null}
                    {sent && (
                      <span className="badge-accent inline-flex items-center gap-1" title={`Sent ${safeFmtDate(sent, 'MMM d, yyyy')}`}>
                        <Send size={10} /> Sent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {party.title?.trim() ? `${party.contact_name} · ` : ''}{safeFmtDate(party.event_date) || 'No date'}
                  </p>
                </div>
                <span className="text-base font-bold text-text-primary shrink-0">{money(breakdown.grandTotal, { cents: true })}</span>
                <ChevronRight size={16} className="text-text-muted shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
