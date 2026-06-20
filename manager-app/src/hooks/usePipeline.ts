import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useParties } from './useParties';
import { computeInvoice, partyToInvoiceInputs } from '../utils/invoice';
import type { Party, PartyPackage } from '../types';

/**
 * Pipeline stages — a derived sales funnel laid over the three real party statuses
 * (inquiry / confirmed / cancelled) plus signals already on the row:
 *   - new:      inquiry, nothing sent yet
 *   - proposal: inquiry with a proposal sent (proposals table) or a follow-up working
 *   - confirmed: status=confirmed, balance still owed (no deposit yet, OR a partial
 *               payment with a remaining balance) — money left to collect
 *   - paid:     status=confirmed and FULLY settled (payment_status === 'paid')
 * Cancelled parties are dropped from the board.
 */
export const PIPELINE_STAGES = ['new', 'proposal', 'confirmed', 'paid'] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New Inquiry',
  proposal: 'Proposal / Follow-up',
  confirmed: 'Confirmed',
  paid: 'Paid / Done',
};

export interface PipelineCard {
  party: Party;
  /** Estimated event value (computeInvoice grand total over saved lines + manual totals). */
  estValue: number;
  /** A follow-up is due today or earlier (inquiry-stage parties only). */
  followUpDue: boolean;
  /** Confirmed but no deposit collected yet — money still owed. */
  depositOwed: boolean;
  /** Confirmed with a partial payment — a balance is still outstanding. */
  balanceOwed: boolean;
}

export interface PipelineColumn {
  stage: PipelineStage;
  label: string;
  cards: PipelineCard[];
  count: number;
  /** Summed estimated value across the column. */
  total: number;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Derive the funnel stage for a single party from its status + existing signals. */
function stageFor(p: Party, hasProposal: boolean): PipelineStage | null {
  if (p.status === 'cancelled') return null;
  if (p.status === 'confirmed') {
    // Only a FULLY-paid party belongs in 'paid'. A partial payment still has a balance
    // owed, so it stays in 'confirmed' (with a "Balance owed" badge) where the manager
    // is prompted to collect the rest — never masquerading as settled in 'Paid / Done'.
    return p.payment_status === 'paid' ? 'paid' : 'confirmed';
  }
  // inquiry: split on whether a proposal/confirmation has gone out or a follow-up is working
  if (hasProposal || p.confirmation_sent_at || p.last_contacted_at) return 'proposal';
  return 'new';
}

/**
 * Build the kanban columns + per-column totals from all parties.
 * Loads party_packages for accurate est. values and (defensively) a `proposals`
 * table for the sub-stage signal — a missing proposals table never breaks the board.
 */
export function usePipeline() {
  const { parties, loading: partiesLoading } = useParties();
  const [linesByParty, setLinesByParty] = useState<Record<number, PartyPackage[]>>({});
  const [proposalPartyIds, setProposalPartyIds] = useState<Set<number>>(new Set());
  const [auxLoading, setAuxLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // Party packages → estimated values (one round trip, grouped client-side).
      const linesReq = supabase.from('party_packages').select('*');
      // Proposals are optional infrastructure; query defensively so a missing
      // table (or a permissions error) degrades to "no proposal signal".
      const proposalsReq = supabase.from('proposals').select('party_id, status');

      const [linesRes, proposalsRes] = await Promise.all([linesReq, proposalsReq]);
      if (!active) return;

      const grouped: Record<number, PartyPackage[]> = {};
      for (const row of (linesRes.data as PartyPackage[]) || []) {
        (grouped[row.party_id] ??= []).push(row);
      }
      setLinesByParty(grouped);

      const ids = new Set<number>();
      if (!proposalsRes.error && Array.isArray(proposalsRes.data)) {
        for (const row of proposalsRes.data as { party_id: number | null; status: string | null }[]) {
          // A row that isn't an abandoned draft counts as "a proposal went out".
          if (row.party_id != null && row.status !== 'draft') ids.add(row.party_id);
        }
      }
      setProposalPartyIds(ids);
      setAuxLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const columns = useMemo<PipelineColumn[]>(() => {
    const today = todayKey();
    const buckets: Record<PipelineStage, PipelineCard[]> = { new: [], proposal: [], confirmed: [], paid: [] };

    for (const p of parties) {
      const stage = stageFor(p, proposalPartyIds.has(p.id));
      if (!stage) continue;
      const lines = linesByParty[p.id] || [];
      const estValue = computeInvoice(partyToInvoiceInputs(p), lines).grandTotal;
      const followUpDue = p.status === 'inquiry' && !!p.follow_up_date && p.follow_up_date <= today;
      const depositOwed =
        p.status === 'confirmed' && (p.payment_status == null || p.payment_status === 'unpaid');
      // Partial payment = a balance is still outstanding; surface it so a confirmed
      // party with money still owed never reads as fully settled on the board.
      const balanceOwed = p.status === 'confirmed' && p.payment_status === 'partial';
      buckets[stage].push({ party: p, estValue, followUpDue, depositOwed, balanceOwed });
    }

    // Within a column, surface the most actionable first: follow-ups/deposits owed,
    // then by soonest event date, then by highest value.
    const rank = (c: PipelineCard) => (c.followUpDue || c.depositOwed || c.balanceOwed ? 0 : 1);
    for (const stage of PIPELINE_STAGES) {
      buckets[stage].sort((a, b) => {
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        const ad = a.party.event_date || '￿';
        const bd = b.party.event_date || '￿';
        if (ad !== bd) return ad.localeCompare(bd);
        return b.estValue - a.estValue;
      });
    }

    return PIPELINE_STAGES.map((stage) => ({
      stage,
      label: PIPELINE_STAGE_LABELS[stage],
      cards: buckets[stage],
      count: buckets[stage].length,
      total: buckets[stage].reduce((sum, c) => sum + c.estValue, 0),
    }));
  }, [parties, linesByParty, proposalPartyIds]);

  /** Open (non-paid, non-cancelled) pipeline value — the live revenue on the board. */
  const openValue = useMemo(
    () => columns.filter((c) => c.stage !== 'paid').reduce((sum, c) => sum + c.total, 0),
    [columns]
  );

  return { columns, openValue, loading: partiesLoading || auxLoading };
}
