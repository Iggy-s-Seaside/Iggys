import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useParties } from '../hooks/useParties';
import { computeInvoice, partyToInvoiceInputs } from '../utils/invoice';
import { PARTY_STATUS_LABELS, type PartyPackage, type PartyStatus } from '../types';

const money = (n: number) => `$${(n || 0).toFixed(2)}`;

const STATUS_BADGE: Record<PartyStatus, string> = {
  inquiry: 'badge-accent',
  confirmed: 'badge-success',
  cancelled: 'badge-danger',
};

function fmtDate(d: string | null) {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Invoices</h1>
        <p className="text-sm text-text-muted mt-1">Every party with billing details — open one to edit or send it</p>
      </div>

      {!busy && rows.length > 0 && (
        <div className="card p-5 mb-5 flex items-center justify-between">
          <span className="text-sm text-text-secondary">Confirmed events total</span>
          <span className="text-xl font-bold text-text-primary">{money(confirmedTotal)}</span>
        </div>
      )}

      {busy ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse h-16" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-12 text-center">
          <Receipt size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No invoices yet</p>
          <p className="text-sm text-text-muted mt-1">Add packages or totals to a party and it'll show up here.</p>
        </div>
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {rows.map(({ party, breakdown }) => (
            <button
              key={party.id}
              onClick={() => navigate(`/parties/${party.id}`)}
              className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-surface-hover transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <Receipt size={18} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary truncate">{party.title?.trim() || party.contact_name}</p>
                  <span className={STATUS_BADGE[party.status]}>{PARTY_STATUS_LABELS[party.status]}</span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {party.title?.trim() ? `${party.contact_name} · ` : ''}{fmtDate(party.event_date) || 'No date'}
                </p>
              </div>
              <span className="text-base font-bold text-text-primary shrink-0">{money(breakdown.grandTotal)}</span>
              <ChevronRight size={16} className="text-text-muted shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
