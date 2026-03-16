import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useSupabaseQuery<T>(table: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: result, error: err } = await supabase
        .from(table)
        .select('*');

      if (err) {
        setError(err.message);
      } else {
        setData((result as T[]) || []);
      }
      setLoading(false);
    }

    fetchData();
  }, [table]);

  return { data, loading, error };
}
