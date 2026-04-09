import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useSupabaseCRUD<T extends { id: number }>(table: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: result, error: err } = await supabase.from(table).select('*');
    if (err) {
      setError(err.message);
      console.error(`[${table}] load error:`, err.message);
      toast.error('Failed to load data. Please refresh.');
    } else {
      setData((result as T[]) || []);
      setError(null);
    }
    setLoading(false);
  }, [table]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (item: Omit<T, 'id' | 'created_at'>) => {
    const { error: err } = await supabase.from(table).insert(item as Record<string, unknown>);
    if (err) {
      console.error(`[${table}] create error:`, err.message);
      toast.error('Failed to create. Please try again.');
      return false;
    }
    toast.success('Created successfully');
    await refresh();
    return true;
  };

  const update = async (id: number, fields: Partial<T>) => {
    const { error: err } = await supabase.from(table).update(fields as Record<string, unknown>).eq('id', id);
    if (err) {
      console.error(`[${table}] update error:`, err.message);
      toast.error('Failed to update. Please try again.');
      return false;
    }
    toast.success('Updated successfully');
    await refresh();
    return true;
  };

  const remove = async (id: number) => {
    const { error: err } = await supabase.from(table).delete().eq('id', id);
    if (err) {
      console.error(`[${table}] delete error:`, err.message);
      toast.error('Failed to delete. Please try again.');
      return false;
    }
    toast.success('Deleted successfully');
    await refresh();
    return true;
  };

  return { data, loading, error, create, update, remove, refresh };
}
