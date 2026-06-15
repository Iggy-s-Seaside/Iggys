import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MessageTemplate } from '../types';
import { DEFAULT_MESSAGE_TEMPLATES } from '../data/messageTemplates';
import { undoableDelete } from './useUndoableDelete';
import toast from 'react-hot-toast';

export function useMessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) {
      toast.error('Failed to load templates');
      console.error(error);
    } else {
      setTemplates((data as MessageTemplate[]) || []);
    }
    loadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (t: Omit<MessageTemplate, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('message_templates').insert(t);
    if (error) {
      toast.error('Failed to save template');
      return false;
    }
    toast.success('Template saved');
    await refresh();
    return true;
  };

  const update = async (id: number, fields: Partial<MessageTemplate>) => {
    const { error } = await supabase.from('message_templates').update(fields).eq('id', id);
    if (error) {
      toast.error('Failed to update template');
      return false;
    }
    toast.success('Template updated');
    await refresh();
    return true;
  };

  const remove = async (id: number) => {
    const item = templates.find((t) => t.id === id);
    if (!item) {
      const { error } = await supabase.from('message_templates').delete().eq('id', id);
      if (error) {
        toast.error('Failed to delete template');
        return false;
      }
      await refresh();
      return true;
    }
    undoableDelete('message_templates', id, item, setTemplates, 'Template removed');
    return true;
  };

  /** Insert the starter template set (offered from the empty state). */
  const seedDefaults = async () => {
    const { error } = await supabase.from('message_templates').insert(DEFAULT_MESSAGE_TEMPLATES);
    if (error) {
      toast.error('Failed to load starter templates');
      return false;
    }
    toast.success('Starter templates added');
    await refresh();
    return true;
  };

  return { templates, loading, refresh, create, update, remove, seedDefaults };
}
