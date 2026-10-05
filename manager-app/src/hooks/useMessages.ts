import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { uniqueTopic } from '../lib/realtimeTopic';
import type { Message } from '../types';
import { updateRow } from '../lib/rowMutations';
import toast from 'react-hot-toast';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const fetchMessages = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const rows: Message[] = [];
    let loadError: string | null = null;
    // Paging keeps older unanswered conversations visible as the inbox grows.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('messages').select('*')
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + 499);
      if (error) { loadError = error.message; break; }
      rows.push(...(data as Message[] || []));
      if (!data || data.length < 500) break;
    }
    if (loadError) {
      toast.error('Failed to load messages');
      setError(loadError);
    } else {
      setMessages(rows);
      setError(null);
    }
    loadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(uniqueTopic('messages-realtime'))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]));
          // Only announce genuinely-fresh mail — a Gmail backfill inserts rows
          // with their original (often old) date, which shouldn't toast.
          const ageMs = Date.now() - new Date(row.created_at).getTime();
          if (ageMs < 5 * 60 * 1000) {
            toast('New message received!', { icon: '📩' });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === (payload.new as Message).id ? payload.new as Message : m))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as { id: number }).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const patchMessage = useCallback(async (id: number, fields: Partial<Message>) => {
    const { error } = await updateRow(supabase, 'messages', id, fields);
    if (error) {
      toast.error('Message was not saved. Please try again.');
      return false;
    }
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, ...fields } : m));
    return true;
  }, []);

  const markAsRead = useCallback((id: number) => patchMessage(id, { status: 'read' }), [patchMessage]);
  const markAsReplied = useCallback((id: number, replyText: string) => patchMessage(id, {
    status: 'replied', reply_text: replyText, replied_at: new Date().toISOString(),
  }), [patchMessage]);
  const archiveMessage = useCallback((id: number) => patchMessage(id, { status: 'archived' }), [patchMessage]);
  const updateNotes = useCallback((id: number, notes: string) => patchMessage(id, { notes }), [patchMessage]);

  const setTriage = useCallback(async (message: Message, category: string, needsReply: boolean) => {
    const ok = await patchMessage(message.id, {
      ...(needsReply && (message.status === 'replied' || message.status === 'archived') ? { status: 'read' as const } : {}),
      category, needs_reply: needsReply, importance: needsReply ? 'high' : 'normal',
      luna_classified_at: new Date().toISOString(),
      luna_classification: {
        ...message.luna_classification, by: 'manager', category,
        needs_reply: needsReply, reason: 'Reviewed by a manager',
      },
    });
    if (ok) toast.success('Classification saved');
    return ok;
  }, [patchMessage]);

  const bulkMarkRead = useCallback(async (ids: number[]) => {
    const { error, count } = await supabase
      .from('messages')
      .update({ status: 'read' }, { count: 'exact' })
      .in('id', ids);
    if (error || count !== ids.length) { toast.error('Some messages could not be updated. Please refresh.'); await fetchMessages(); return false; }
    await fetchMessages();
    return true;
  }, []);

  const bulkArchive = useCallback(async (ids: number[]) => {
    const { error, count } = await supabase
      .from('messages')
      .update({ status: 'archived' }, { count: 'exact' })
      .in('id', ids);
    if (error || count !== ids.length) { toast.error('Some messages could not be archived. Please refresh.'); await fetchMessages(); return false; }
    await fetchMessages();
    return true;
  }, []);

  return {
    messages,
    loading,
    error,
    refresh: fetchMessages,
    markAsRead,
    markAsReplied,
    archiveMessage,
    updateNotes,
    setTriage,
    bulkMarkRead,
    bulkArchive,
  };
}

export function useUnreadCount() {
  const [count, setCount] = useState(0);
  const initialFetchDone = useRef(false);

  useEffect(() => {
    const fetchCount = async () => {
      const { count: c, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread');
      if (!error && c !== null) setCount(c);
    };

    fetchCount();
    initialFetchDone.current = true;

    // Realtime for count updates
    const channel = supabase
      .channel(uniqueTopic('unread-count'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => { fetchCount(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return count;
}
