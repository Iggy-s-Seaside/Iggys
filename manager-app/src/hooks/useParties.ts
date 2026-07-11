import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Party } from '../types';
import toast from 'react-hot-toast';
import { undoableDelete, filterPendingDeletes } from './useUndoableDelete';
import { uniqueTopic } from '../lib/realtimeTopic';

/** All parties, with realtime updates (used by the pipeline list + dashboard). */
export function useParties() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const { data, error } = await supabase
      .from('parties')
      .select('*')
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load parties');
      console.error(error);
      setError(error.message);
    } else {
      // filterPendingDeletes keeps a mid-undo-window row hidden if a realtime tick re-pulls it.
      setParties(filterPendingDeletes('parties', (data as Party[]) || []));
      setError(null);
    }
    loadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel(uniqueTopic('parties-realtime'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parties' }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const create = async (fields: Partial<Party>): Promise<Party | null> => {
    const { data, error } = await supabase.from('parties').insert(fields).select('*').single();
    if (error) {
      toast.error('Failed to create party');
      console.error(error);
      return null;
    }
    toast.success('Party created');
    await refresh();
    return data as Party;
  };

  const update = async (id: number, fields: Partial<Party>): Promise<boolean> => {
    const { error } = await supabase
      .from('parties')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update party');
      console.error(error);
      return false;
    }
    await refresh();
    return true;
  };

  const remove = async (id: number): Promise<boolean> => {
    const item = parties.find((r) => r.id === id);
    if (!item) {
      // Fallback: row not in local cache — delete directly.
      const { error } = await supabase.from('parties').delete().eq('id', id);
      if (error) {
        toast.error('Failed to delete party');
        return false;
      }
      await refresh();
      return true;
    }
    undoableDelete('parties', id, item, setParties, 'Party removed');
    return true;
  };

  return { parties, loading, error, refresh, create, update, remove };
}

/** A single party by id (used by the profile page) — fetched fresh, no realtime. */
export function useParty(id: number | null) {
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const partyLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (id == null) {
      setParty(null);
      setLoading(false);
      return;
    }
    if (!partyLoadedRef.current) setLoading(true);
    const { data, error } = await supabase.from('parties').select('*').eq('id', id).maybeSingle();
    if (error) {
      toast.error('Failed to load party');
      console.error(error);
    } else {
      setParty((data as Party) ?? null);
    }
    partyLoadedRef.current = true;
    setLoading(false);
  }, [id]);

  // Reset the first-load guard on a genuine party switch so the spinner shows
  // for the new party instead of flashing the previous party's row.
  useEffect(() => {
    partyLoadedRef.current = false;
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = async (fields: Partial<Party>): Promise<boolean> => {
    if (id == null) return false;
    const { error } = await supabase
      .from('parties')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update party');
      console.error(error);
      return false;
    }
    await refresh();
    return true;
  };

  return { party, loading, refresh, update };
}

/**
 * Standalone party create (no fetch/subscription) — for global Quick-Add, which is
 * mounted on every screen and shouldn't carry the full list hook's realtime channel.
 */
export async function createParty(fields: Partial<Party>): Promise<Party | null> {
  const { data, error } = await supabase.from('parties').insert(fields).select('*').single();
  if (error) {
    toast.error('Failed to create party');
    console.error(error);
    return null;
  }
  toast.success('Party created');
  return data as Party;
}
