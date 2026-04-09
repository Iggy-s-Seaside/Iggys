import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Message } from '../types';
import toast from 'react-hot-toast';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load messages');
      console.error(error);
    } else {
      setMessages((data as Message[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => [payload.new as Message, ...prev]);
          toast('New message received!', { icon: '📩' });
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

  const markAsRead = useCallback(async (id: number) => {
    const { error } = await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('id', id);
    if (error) toast.error('Failed to update message');
  }, []);

  const markAsReplied = useCallback(async (id: number, replyText: string) => {
    // replied_by is set server-side by the send-reply edge function
    // using the authenticated JWT — never trust client-supplied identity
    const { error } = await supabase
      .from('messages')
      .update({
        status: 'replied',
        reply_text: replyText,
        replied_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update message');
      return false;
    }
    return true;
  }, []);

  const archiveMessage = useCallback(async (id: number) => {
    const { error } = await supabase
      .from('messages')
      .update({ status: 'archived' })
      .eq('id', id);
    if (error) toast.error('Failed to archive message');
  }, []);

  const updateNotes = useCallback(async (id: number, notes: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ notes })
      .eq('id', id);
    if (error) toast.error('Failed to update notes');
  }, []);

  const bulkMarkRead = useCallback(async (ids: number[]) => {
    const { error } = await supabase
      .from('messages')
      .update({ status: 'read' })
      .in('id', ids);
    if (error) toast.error('Failed to update messages');
  }, []);

  const bulkArchive = useCallback(async (ids: number[]) => {
    const { error } = await supabase
      .from('messages')
      .update({ status: 'archived' })
      .in('id', ids);
    if (error) toast.error('Failed to archive messages');
  }, []);

  return {
    messages,
    loading,
    refresh: fetchMessages,
    markAsRead,
    markAsReplied,
    archiveMessage,
    updateNotes,
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
      .channel('unread-count')
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
