import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { undoableDelete, filterPendingDeletes } from './useUndoableDelete';
import type { Campaign, CampaignChannel, CampaignStatus, ConsentChannel, ConsentSource, MarketingContact } from '../types';

// ── Contacts (marketing view) ──────────────────────────────────────────────
// Reads the CRM list with the marketing columns added by scripts/add-marketing.sql.
// Dedupe + segmenting live in the page; this hook is the raw data + consent writes.

export function useMarketingContacts() {
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('last_visit', { ascending: false, nullsFirst: false });
    if (error) {
      toast.error('Failed to load customers');
      console.error('[contacts] load error:', error.message);
    } else {
      setContacts((data as MarketingContact[]) || []);
    }
    loadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Flip a contact's per-channel opt-in AND append an immutable consent_events
   * row (TCPA / CAN-SPAM audit trail). Both writes must land; we surface a toast
   * either way. The consent gate in the composer reads the contacts flag, so the
   * flag write is the source of truth — the event is the defensible "why/when".
   */
  const setConsent = useCallback(
    async (contactId: number, channel: ConsentChannel, optIn: boolean, source: ConsentSource = 'manager') => {
      const col = channel === 'sms' ? 'sms_opt_in' : 'email_opt_in';
      const { error: upErr } = await supabase
        .from('contacts')
        .update({ [col]: optIn })
        .eq('id', contactId);
      if (upErr) {
        toast.error('Failed to update consent');
        console.error('[contacts] consent update error:', upErr.message);
        return false;
      }
      // Append-only audit row. A failure here doesn't roll back the flag, but we
      // log it loudly — the flag is what gates sends, the event is the paper trail.
      const { error: evErr } = await supabase.from('consent_events').insert({
        contact_id: contactId,
        channel,
        action: optIn ? 'opt_in' : 'opt_out',
        source,
      });
      if (evErr) console.error('[consent_events] insert error:', evErr.message);

      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, [col]: optIn } : c)),
      );
      toast.success(optIn ? 'Opted in' : 'Opted out');
      return true;
    },
    [],
  );

  return { contacts, loading, refresh, setConsent };
}

// ── Campaigns ───────────────────────────────────────────────────────────────

export interface CampaignDraft {
  name: string;
  channel: CampaignChannel;
  subject: string | null;
  body: string;
  status?: CampaignStatus;
  scheduled_at?: string | null;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load campaigns');
      console.error('[campaigns] load error:', error.message);
    } else {
      setCampaigns(filterPendingDeletes('campaigns', (data as Campaign[]) || []));
    }
    loadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('campaigns-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const create = useCallback(
    async (draft: CampaignDraft): Promise<Campaign | null> => {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          name: draft.name,
          channel: draft.channel,
          subject: draft.channel === 'email' ? draft.subject : null,
          body: draft.body,
          status: draft.status ?? 'draft',
          scheduled_at: draft.scheduled_at ?? null,
        })
        .select('*')
        .single();
      if (error) {
        toast.error('Failed to save campaign');
        console.error('[campaigns] create error:', error.message);
        return null;
      }
      await refresh();
      return data as Campaign;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: number, fields: Partial<Campaign>): Promise<boolean> => {
      const { error } = await supabase.from('campaigns').update(fields).eq('id', id);
      if (error) {
        toast.error('Failed to update campaign');
        console.error('[campaigns] update error:', error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: number): Promise<boolean> => {
      const item = campaigns.find((c) => c.id === id);
      if (!item) {
        const { error } = await supabase.from('campaigns').delete().eq('id', id);
        if (error) {
          toast.error('Failed to delete campaign');
          console.error('[campaigns] delete error:', error.message);
          return false;
        }
        await refresh();
        return true;
      }
      undoableDelete('campaigns', id, item, setCampaigns, 'Campaign removed');
      return true;
    },
    [campaigns, refresh],
  );

  return { campaigns, loading, refresh, create, update, remove };
}
