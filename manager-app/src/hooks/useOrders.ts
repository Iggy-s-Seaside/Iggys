import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Order } from '../types';

/** Only fetches when `enabled` is true (e.g., when the drawer is open). */
export function useOrders(enabled: boolean) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[orders] load error:', error.message);
    } else {
      setOrders((data as Order[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { orders, loading, refresh };
}
