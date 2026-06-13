import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** Lifecycle of a tokenized public proposal link (mirrors the manager hook). */
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'deposit_paid';

export interface PublicProposal {
  id: number;
  created_at: string;
  token: string;
  party_id: number;
  status: ProposalStatus;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  signer_name: string | null;
  deposit_paid_at: string | null;
}

/** Money-bearing fields of a party the public quote needs (subset of the manager Party). */
export interface ProposalParty {
  id: number;
  status: string;
  contact_name: string;
  title: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  guest_count: number | null;
  space_name: string | null;
  room_rate: number | null;
  room_hours: number | null;
  food_total: number | null;
  drink_total: number | null;
  gratuity_rate: number | null;
  deposit_amount: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  payment_status: 'unpaid' | 'partial' | 'paid' | null;
}

export type PackageCategory = 'food' | 'drink' | 'room' | 'addon' | 'other';
export type PackageUnit = 'flat' | 'per_person' | 'per_hour';

export interface ProposalPartyPackage {
  id: number;
  party_id: number;
  name: string;
  category: PackageCategory;
  unit: PackageUnit;
  quantity: number;
  unit_price: number;
}

export interface PublicProposalData {
  proposal: PublicProposal | null;
  party: ProposalParty | null;
  lines: ProposalPartyPackage[];
  loading: boolean;
  /** 'notfound' when the token resolves to nothing; 'error' on a real failure. */
  error: 'notfound' | 'error' | null;
  refresh: () => Promise<void>;
}

const PARTY_FIELDS =
  'id,status,contact_name,title,event_date,start_time,end_time,guest_count,space_name,' +
  'room_rate,room_hours,food_total,drink_total,gratuity_rate,' +
  'deposit_amount,amount_paid,balance_due,payment_status';

/** Fetch a proposal by its public token (anon), plus its party + package lines. */
export function usePublicProposal(token: string | undefined): PublicProposalData {
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [party, setParty] = useState<ProposalParty | null>(null);
  const [lines, setLines] = useState<ProposalPartyPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'notfound' | 'error' | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setProposal(null);
      setParty(null);
      setLines([]);
      setError('notfound');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: prop, error: propErr } = await supabase
      .from('proposals')
      .select('id,created_at,token,party_id,status,sent_at,viewed_at,signed_at,signer_name,deposit_paid_at')
      .eq('token', token)
      .maybeSingle();

    if (propErr) {
      console.error('[proposal] load error:', propErr.message);
      setError('error');
      setLoading(false);
      return;
    }
    if (!prop) {
      setProposal(null);
      setParty(null);
      setLines([]);
      setError('notfound');
      setLoading(false);
      return;
    }

    const typedProp = prop as PublicProposal;
    setProposal(typedProp);

    const [{ data: partyRow, error: partyErr }, { data: pkgRows, error: pkgErr }] = await Promise.all([
      supabase.from('parties').select(PARTY_FIELDS).eq('id', typedProp.party_id).maybeSingle(),
      supabase
        .from('party_packages')
        .select('id,party_id,name,category,unit,quantity,unit_price')
        .eq('party_id', typedProp.party_id)
        .order('id', { ascending: true }),
    ]);

    if (partyErr || pkgErr) {
      console.error('[proposal] party/packages error:', partyErr?.message || pkgErr?.message);
      setError('error');
      setLoading(false);
      return;
    }

    setParty((partyRow as unknown as ProposalParty) ?? null);
    setLines((pkgRows as unknown as ProposalPartyPackage[]) || []);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { proposal, party, lines, loading, error, refresh };
}
