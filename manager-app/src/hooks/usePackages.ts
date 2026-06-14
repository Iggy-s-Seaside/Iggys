import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Package, PartyPackage } from '../types';
import toast from 'react-hot-toast';

/** The editable package catalog. */
export function usePackages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) {
      toast.error('Failed to load packages');
      console.error(error);
    } else {
      setPackages((data as Package[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (p: Omit<Package, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('packages').insert(p);
    if (error) {
      toast.error('Failed to add package');
      return false;
    }
    toast.success('Package added');
    await refresh();
    return true;
  };

  const update = async (id: number, fields: Partial<Package>) => {
    const { error } = await supabase.from('packages').update(fields).eq('id', id);
    if (error) {
      toast.error('Failed to update package');
      return false;
    }
    await refresh();
    return true;
  };

  const remove = async (id: number) => {
    const { error } = await supabase.from('packages').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete package');
      return false;
    }
    toast.success('Package deleted');
    await refresh();
    return true;
  };

  return { packages, loading, refresh, create, update, remove };
}

/** The packages attached to one party (party_packages join rows). */
export function usePartyPackages(partyId: number | null) {
  const [items, setItems] = useState<PartyPackage[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (partyId == null) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('party_packages')
      .select('*')
      .eq('party_id', partyId)
      .order('id', { ascending: true });
    if (!error) setItems((data as PartyPackage[]) || []);
    setLoading(false);
  }, [partyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Snapshot the package's name/category/unit/price onto the join row at add-time. */
  const addPackage = async (pkg: Package, quantity: number) => {
    if (partyId == null) return false;
    const { error } = await supabase.from('party_packages').insert({
      party_id: partyId,
      package_id: pkg.id,
      name: pkg.name,
      category: pkg.category,
      unit: pkg.unit,
      quantity,
      unit_price: pkg.price,
    });
    if (error) {
      toast.error('Failed to add package');
      return false;
    }
    await refresh();
    return true;
  };

  /**
   * Insert a one-off custom line (not from the catalog): package_id stays null
   * and the manager types the name/category/unit/price/quantity/notes directly.
   * computeInvoice buckets it by category exactly like a catalog line, so a
   * 'food'/'drink' line feeds gratuity while 'room'/'addon'/'other' don't.
   * A discount/comp is just a line with a negative unit_price (or a non-gratuity
   * category to keep gratuity off it).
   */
  const addCustomLine = async (fields: Partial<PartyPackage> = {}) => {
    if (partyId == null) return false;
    const { error } = await supabase.from('party_packages').insert({
      party_id: partyId,
      package_id: null,
      name: fields.name ?? 'Custom line',
      category: fields.category ?? 'other',
      unit: fields.unit ?? 'flat',
      quantity: fields.quantity ?? 1,
      unit_price: fields.unit_price ?? 0,
      notes: fields.notes ?? null,
    });
    if (error) {
      toast.error('Failed to add line');
      return false;
    }
    await refresh();
    return true;
  };

  const updateLine = async (id: number, fields: Partial<PartyPackage>) => {
    const { error } = await supabase.from('party_packages').update(fields).eq('id', id);
    if (!error) await refresh();
    return !error;
  };

  const removeLine = async (id: number) => {
    const { error } = await supabase.from('party_packages').delete().eq('id', id);
    if (!error) await refresh();
    return !error;
  };

  return { items, loading, refresh, addPackage, addCustomLine, updateLine, removeLine };
}
