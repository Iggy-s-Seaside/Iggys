import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// ── Types ──
// The supabase client is untyped, so these widened local types are runtime-safe.
// Integrator: lift MerchVariant / MerchProductWithVariants / MerchInventoryLog into
// src/types/index.ts (see integration_notes) and import from there instead.

/** One countable SKU of a merch product (a size for apparel, a label for hats). */
export interface MerchVariant {
  id: number;
  product_id: string;
  variant_type: 'size' | 'style' | string;
  size: string | null;
  variant_label: string | null;
  sku: string | null;
  stock: number;
  par_level: number;
  cost: number | null;
  image: string | null;
  active: boolean;
  created_at?: string;
}

/** A merch_products catalog row (subset the manager merch module reads). */
export interface MerchProduct {
  id: string;
  created_at?: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  sizes: string[] | null;
  sku: string | null;
  inventory: number | null;
  active: boolean;
  sort_order: number;
}

/** A product with its grouped variants + derived total stock. */
export interface MerchProductWithVariants extends MerchProduct {
  variants: MerchVariant[];
  /** Sum of stock across active variants — the product's true on-hand. */
  totalStock: number;
  /** True when any active variant is at/below its par level. */
  lowStock: boolean;
}

export interface MerchInventoryLog {
  id: number;
  variant_id: number;
  user_email: string | null;
  previous_stock: number | null;
  new_stock: number | null;
  change_amount: number | null;
  reason: string | null;
  created_at: string;
}

export const MERCH_LOG_REASONS = ['count', 'manual', 'scan_intake', 'wizard_create'] as const;
export type MerchLogReason = (typeof MERCH_LOG_REASONS)[number];

/** A variant draft used when creating a product (no id yet). */
export interface MerchVariantDraft {
  variant_type?: 'size' | 'style';
  size?: string | null;
  variant_label?: string | null;
  sku?: string | null;
  stock?: number;
  par_level?: number;
  cost?: number | null;
}

/** A product draft used by the Add-merch-type wizard. */
export interface MerchProductDraft {
  /** Optional explicit slug id; auto-derived from name when omitted. */
  id?: string;
  name: string;
  description?: string | null;
  /** Optional starting price (USD). Allowed on creation — not a price change. */
  price?: number;
  image?: string | null;
}

// ── Helpers ──

/** Stable slug id from a product name (matches merch_products.id slug convention). */
export function slugifyMerchId(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // Suffix keeps ids unique even if two products share a name.
  return `${base || 'merch'}-${Date.now().toString(36).slice(-4)}`;
}

/** Total on-hand for a product = sum of its active variants' stock. */
export function totalProductStock(variants: MerchVariant[]): number {
  return variants.reduce((sum, v) => sum + (v.active ? v.stock : 0), 0);
}

/** Human label for a variant ("L", "Black", or "—"). */
export function variantLabel(v: Pick<MerchVariant, 'size' | 'variant_label'>): string {
  return v.size ?? v.variant_label ?? '—';
}

function group(products: MerchProduct[], variants: MerchVariant[]): MerchProductWithVariants[] {
  const byProduct = new Map<string, MerchVariant[]>();
  for (const v of variants) {
    const arr = byProduct.get(v.product_id) ?? [];
    arr.push(v);
    byProduct.set(v.product_id, arr);
  }
  return products.map((p) => {
    const vs = (byProduct.get(p.id) ?? []).sort(sortVariants);
    return {
      ...p,
      variants: vs,
      totalStock: totalProductStock(vs),
      lowStock: vs.some((v) => v.active && v.stock <= v.par_level),
    };
  });
}

// Apparel sizes sort in run order; everything else alphabetical.
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL'];
function sortVariants(a: MerchVariant, b: MerchVariant): number {
  const ai = a.size ? SIZE_ORDER.indexOf(a.size.toUpperCase()) : -1;
  const bi = b.size ? SIZE_ORDER.indexOf(b.size.toUpperCase()) : -1;
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return variantLabel(a).localeCompare(variantLabel(b));
}

// ── Hook ──

export function useMerch() {
  const { user } = useAuth();
  const [products, setProducts] = useState<MerchProduct[]>([]);
  const [variants, setVariants] = useState<MerchVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [prodRes, varRes] = await Promise.all([
      supabase
        .from('merch_products')
        .select('id, created_at, name, description, price, image, sizes, sku, inventory, active, sort_order')
        .order('sort_order')
        .order('name'),
      supabase.from('merch_variants').select('*').order('id'),
    ]);

    if (prodRes.error || varRes.error) {
      setError(prodRes.error?.message ?? varRes.error?.message ?? 'Failed to load merch');
      toast.error('Failed to load merch');
    } else {
      setProducts((prodRes.data as MerchProduct[]) || []);
      setVariants((varRes.data as MerchVariant[]) || []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Products with grouped variants + derived totals. */
  const grouped = useMemo(() => group(products, variants), [products, variants]);

  const lowStockCount = useMemo(() => grouped.filter((p) => p.lowStock).length, [grouped]);

  /** Write an audit log row for a variant stock change (best-effort). */
  const logChange = useCallback(
    async (variantId: number, previous: number, next: number, reason: MerchLogReason | string) => {
      const { error: logErr } = await supabase.from('merch_inventory_logs').insert({
        variant_id: variantId,
        user_email: user?.email ?? 'unknown',
        previous_stock: previous,
        new_stock: next,
        change_amount: next - previous,
        reason,
      });
      if (logErr) console.error('[merch log]', logErr.message);
    },
    [user]
  );

  /**
   * Set a variant's stock to an absolute value. Optimistic: patches local state,
   * writes the row + a log entry, rolls back on error.
   */
  const setVariantStock = useCallback(
    async (variantId: number, newStock: number, reason: MerchLogReason | string = 'count') => {
      const target = variants.find((v) => v.id === variantId);
      if (!target) return false;
      const previous = target.stock;
      const next = Math.max(0, Math.round(newStock));
      if (next === previous) return true;

      // Optimistic.
      setVariants((vs) => vs.map((v) => (v.id === variantId ? { ...v, stock: next } : v)));

      const { error: updErr } = await supabase
        .from('merch_variants')
        .update({ stock: next })
        .eq('id', variantId);

      if (updErr) {
        // Roll back.
        setVariants((vs) => vs.map((v) => (v.id === variantId ? { ...v, stock: previous } : v)));
        toast.error(`Failed to update stock: ${updErr.message}`);
        return false;
      }

      await logChange(variantId, previous, next, reason);
      return true;
    },
    [variants, logChange]
  );

  /** Adjust a variant's stock by a delta (e.g. +1 / -1 from the count grid). */
  const adjustVariantStock = useCallback(
    async (variantId: number, delta: number, reason: MerchLogReason | string = 'manual') => {
      const target = variants.find((v) => v.id === variantId);
      if (!target) return false;
      return setVariantStock(variantId, target.stock + delta, reason);
    },
    [variants, setVariantStock]
  );

  /**
   * Increment a variant's stock (used by scan intake). Logs reason 'scan_intake'
   * by default. Returns the new stock, or null on failure.
   */
  const incrementVariantStock = useCallback(
    async (variantId: number, amount: number, reason: MerchLogReason | string = 'scan_intake') => {
      const target = variants.find((v) => v.id === variantId);
      if (!target) return null;
      const next = Math.max(0, target.stock + Math.round(amount));
      const ok = await setVariantStock(variantId, next, reason);
      return ok ? next : null;
    },
    [variants, setVariantStock]
  );

  /**
   * Create a product + its variants in one call. Inserts the merch_products row
   * (manager-created, so an initial price is allowed), then its variants, then a
   * 'wizard_create' log row per variant that starts with stock.
   */
  const createProductWithVariants = useCallback(
    async (product: MerchProductDraft, variantDrafts: MerchVariantDraft[]) => {
      const id = product.id || slugifyMerchId(product.name);

      const { error: prodErr } = await supabase.from('merch_products').insert({
        id,
        name: product.name.trim(),
        description: product.description ?? null,
        price: product.price ?? 0, // initial price on creation — not a price change
        image: product.image ?? null,
        // Mirror the apparel size run onto the legacy sizes[] column for display.
        sizes: variantDrafts.map((v) => v.size).filter((s): s is string => !!s),
        // Public store stays OFF this wave — new merch is inactive in the storefront.
        active: false,
        sort_order: 0,
      });

      if (prodErr) {
        toast.error(`Failed to create product: ${prodErr.message}`);
        return null;
      }

      const rows = variantDrafts.map((v) => ({
        product_id: id,
        variant_type: v.variant_type ?? (v.size ? 'size' : 'style'),
        size: v.size ?? null,
        variant_label: v.variant_label ?? null,
        sku: v.sku ?? null,
        stock: Math.max(0, Math.round(v.stock ?? 0)),
        par_level: Math.max(0, Math.round(v.par_level ?? 0)),
        cost: v.cost ?? null,
        active: true,
      }));

      const { data: inserted, error: varErr } = await supabase
        .from('merch_variants')
        .insert(rows)
        .select('*');

      if (varErr) {
        toast.error(`Product created but variants failed: ${varErr.message}`);
        await refresh();
        return id;
      }

      // Log the opening counts.
      const insertedVariants = (inserted as MerchVariant[]) || [];
      await Promise.all(
        insertedVariants
          .filter((v) => v.stock > 0)
          .map((v) => logChange(v.id, 0, v.stock, 'wizard_create'))
      );

      toast.success(`${product.name} added`);
      await refresh();
      return id;
    },
    [refresh, logChange]
  );

  /** Add variant rows to an existing product (used by scan intake "create variant"). */
  const addVariants = useCallback(
    async (productId: string, variantDrafts: MerchVariantDraft[]) => {
      const rows = variantDrafts.map((v) => ({
        product_id: productId,
        variant_type: v.variant_type ?? (v.size ? 'size' : 'style'),
        size: v.size ?? null,
        variant_label: v.variant_label ?? null,
        sku: v.sku ?? null,
        stock: Math.max(0, Math.round(v.stock ?? 0)),
        par_level: Math.max(0, Math.round(v.par_level ?? 0)),
        cost: v.cost ?? null,
        active: true,
      }));
      const { data: inserted, error: varErr } = await supabase
        .from('merch_variants')
        .insert(rows)
        .select('*');
      if (varErr) {
        toast.error(`Failed to add variants: ${varErr.message}`);
        return [];
      }
      const insertedVariants = (inserted as MerchVariant[]) || [];
      await Promise.all(
        insertedVariants
          .filter((v) => v.stock > 0)
          .map((v) => logChange(v.id, 0, v.stock, 'scan_intake'))
      );
      await refresh();
      return insertedVariants;
    },
    [refresh, logChange]
  );

  /** Update editable fields on a variant (par level, sku, cost, active). */
  const updateVariant = useCallback(
    async (variantId: number, fields: Partial<Pick<MerchVariant, 'par_level' | 'sku' | 'cost' | 'active' | 'variant_label'>>) => {
      const { error: updErr } = await supabase.from('merch_variants').update(fields).eq('id', variantId);
      if (updErr) {
        toast.error(`Failed to update variant: ${updErr.message}`);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh]
  );

  /** Delete a product (cascades its variants + logs). */
  const deleteProduct = useCallback(
    async (productId: string) => {
      const { error: delErr } = await supabase.from('merch_products').delete().eq('id', productId);
      if (delErr) {
        toast.error(`Failed to delete: ${delErr.message}`);
        return false;
      }
      toast.success('Merch deleted');
      await refresh();
      return true;
    },
    [refresh]
  );

  return {
    products: grouped,
    rawProducts: products,
    rawVariants: variants,
    loading,
    error,
    lowStockCount,
    refresh,
    setVariantStock,
    adjustVariantStock,
    incrementVariantStock,
    createProductWithVariants,
    addVariants,
    updateVariant,
    deleteProduct,
  };
}

export type UseMerch = ReturnType<typeof useMerch>;

// ── Logs for a specific variant (drawer) ──

export function useMerchVariantLogs(variantId: number | null) {
  const [logs, setLogs] = useState<MerchInventoryLog[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!variantId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('merch_inventory_logs')
      .select('*')
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false });
    if (err) {
      toast.error('Failed to load history');
    } else {
      setLogs((data as MerchInventoryLog[]) || []);
    }
    setLoading(false);
  }, [variantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { logs, loading, refresh };
}
