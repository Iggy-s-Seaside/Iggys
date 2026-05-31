import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Todo, TodoPriority } from '../types';
import toast from 'react-hot-toast';

const PRIORITY_RANK: Record<TodoPriority, number> = { high: 0, normal: 1, low: 2 };

/** Sort: open items first, then by priority (high→low), then due date, then newest. */
function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('todos').select('*');
    if (error) {
      toast.error('Failed to load todos');
      console.error(error);
    } else {
      setTodos(sortTodos((data as Todo[]) || []));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel('todos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const add = async (fields: {
    title: string;
    details?: string | null;
    priority?: TodoPriority;
    due_date?: string | null;
    created_by?: string | null;
  }) => {
    const { error } = await supabase.from('todos').insert({
      title: fields.title,
      details: fields.details ?? null,
      priority: fields.priority ?? 'normal',
      due_date: fields.due_date ?? null,
      created_by: fields.created_by ?? null,
    });
    if (error) {
      toast.error('Failed to add task');
      return false;
    }
    await refresh();
    return true;
  };

  const toggle = async (id: number, done: boolean) => {
    const { error } = await supabase
      .from('todos')
      .update({ done, completed_at: done ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update task');
      return false;
    }
    await refresh();
    return true;
  };

  const update = async (id: number, fields: Partial<Todo>) => {
    const { error } = await supabase.from('todos').update(fields).eq('id', id);
    if (error) {
      toast.error('Failed to update task');
      return false;
    }
    await refresh();
    return true;
  };

  const remove = async (id: number) => {
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete task');
      return false;
    }
    await refresh();
    return true;
  };

  return { todos, loading, refresh, add, toggle, update, remove };
}
