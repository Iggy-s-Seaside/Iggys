import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

/** Lifecycle of a tokenized public proposal link. */
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'deposit_paid';

export interface Proposal {
  id: number;
  created_at: string;
  token: string;
  party_id: number;
  status: ProposalStatus;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_ip: string | null;
  deposit_paid_at: string | null;
}

/**
 * Proposals for one party — list + create the tokenized public link.
 * The public page (/p/:token) reads the row; the proposal-sign edge function
 * (service role) stamps viewed/signed; stripe-webhook stamps deposit_paid_at.
 * Realtime keeps the manager's status chips live as the client acts.
 */
export function useProposals(partyId: number | null) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (partyId == null) {
      setProposals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('party_id', partyId)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load proposals');
      console.error('[proposals] load error:', error.message);
    } else {
      setProposals((data as Proposal[]) || []);
    }
    setLoading(false);
  }, [partyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (partyId == null) return;
    const channel = supabase
      .channel(`proposals-realtime-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proposals', filter: `party_id=eq.${partyId}` },
        () => {
          refresh();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [partyId, refresh]);

  /** Create a fresh proposal link for this party (status 'sent', sent_at now). */
  const createProposal = async (): Promise<Proposal | null> => {
    if (partyId == null) return null;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          token: crypto.randomUUID(),
          party_id: partyId,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) {
        toast.error('Could not create proposal link');
        console.error('[proposals] create error:', error.message);
        return null;
      }
      await refresh();
      return data as Proposal;
    } finally {
      setCreating(false);
    }
  };

  /** Permanently revoke a proposal link (deletes the row → token 404s). */
  const removeProposal = async (id: number): Promise<boolean> => {
    const { error } = await supabase.from('proposals').delete().eq('id', id);
    if (error) {
      toast.error('Could not revoke link');
      console.error('[proposals] delete error:', error.message);
      return false;
    }
    toast.success('Link revoked');
    await refresh();
    return true;
  };

  return { proposals, loading, creating, refresh, createProposal, removeProposal };
}
