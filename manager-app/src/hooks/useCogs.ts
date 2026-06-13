// useCogs.ts — data + costing engine for the /cogs (Inventory Depth + COGS truth) screen.
//
// Tables (see scripts/add-cogs.sql): vendors, vendor_catalog, purchase_orders,
// purchase_order_items, recipes, recipe_ingredients, price_history. All manager-only.
//
// The pure costing helpers (recipeCost, pourCostPct, classifyMenuItem, …) are exported
// standalone so the page can compute without re-fetching, and so they're unit-testable.
//
// NOTE on types: the COGS interfaces (Vendor, VendorCatalogRow, PurchaseOrder, …) are
// declared+exported here to keep this agent's files self-contained. The integration
// note asks for the same shapes to be promoted into src/types/index.ts; until then,
// import them from this module.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import type { InventoryItem } from '../types';

// ── Types ──

export interface Vendor {
  id: number;
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  rep: string | null;
  notes: string | null;
  active: boolean;
}

export interface VendorCatalogRow {
  id: number;
  created_at: string;
  vendor_id: number;
  item_id: number | null;
  sku: string | null;
  pack_size: number;
  case_cost: number;
}

export const PO_STATUSES = ['draft', 'sent', 'received', 'cancelled'] as const;
export type PurchaseOrderStatus = (typeof PO_STATUSES)[number];

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  received: 'Received',
  cancelled: 'Cancelled',
};

export interface PurchaseOrder {
  id: number;
  created_at: string;
  vendor_id: number | null;
  status: PurchaseOrderStatus;
  total: number;
  notes: string | null;
  created_by: string | null;
  sent_at: string | null;
  // joined when loaded with lines / vendor
  purchase_order_items?: PurchaseOrderItem[];
  vendors?: { name: string; email: string | null } | null;
}

export interface PurchaseOrderItem {
  id: number;
  created_at: string;
  po_id: number;
  item_id: number | null;
  name: string;
  unit: string | null;
  qty: number;
  unit_cost: number;
}

export interface Recipe {
  id: number;
  created_at: string;
  name: string;
  menu_ref: string | null;
  menu_price: number | null;
  category: string | null;
  yield: number;
  active: boolean;
  // joined when loaded
  recipe_ingredients?: RecipeIngredient[];
}

export interface RecipeIngredient {
  id: number;
  created_at: string;
  recipe_id: number;
  item_id: number | null;
  name: string | null;
  qty: number;
  unit: string | null;
}

export interface PriceHistoryRow {
  id: number;
  created_at: string;
  item_id: number | null;
  cost_per_unit: number;
  source: string | null;
  observed_at: string;
}

/** A drafted PO line built from a below-par item + its cheapest vendor. */
export interface DraftPoLine {
  item_id: number;
  name: string;
  unit: string | null;
  qty: number;        // packs/cases to order
  unit_cost: number;  // per pack/case
}

/** Below-par items grouped under the vendor that supplies them. */
export interface VendorReorderGroup {
  vendor: Vendor;
  lines: DraftPoLine[];
  total: number;
}

// ── Pure costing helpers ──

/** Cost of ONE serving of a recipe, reading live unit costs off inventory_items. */
export function recipeCost(recipe: Recipe, itemsById: Map<number, InventoryItem>): number {
  const ingredients = recipe.recipe_ingredients ?? [];
  const batchCost = ingredients.reduce((sum, ing) => {
    if (ing.item_id == null) return sum;
    const item = itemsById.get(ing.item_id);
    const unitCost = item?.cost_per_unit ?? 0;
    return sum + unitCost * (ing.qty || 0);
  }, 0);
  const servings = recipe.yield && recipe.yield > 0 ? recipe.yield : 1;
  return batchCost / servings;
}

/** Pour-cost % = cost / sell price * 100. Null price (or 0) returns null (unknown). */
export function pourCostPct(cost: number, price: number | null): number | null {
  if (price == null || price <= 0) return null;
  return (cost / price) * 100;
}

/** Gross profit per serving = price - cost. Null price returns null. */
export function grossMargin(cost: number, price: number | null): number | null {
  if (price == null) return null;
  return price - cost;
}

export type MenuQuadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog';

export const QUADRANT_LABELS: Record<MenuQuadrant, string> = {
  star: 'Star',
  plowhorse: 'Plowhorse',
  puzzle: 'Puzzle',
  dog: 'Dog',
};

/**
 * Menu-engineering quadrant. Profitability axis = margin vs the median margin;
 * popularity axis = a (caller-supplied) popularity flag. With no popularity signal
 * we still split Stars/Dogs purely on margin so the matrix is meaningful day one.
 */
export function classifyMenuItem(
  margin: number | null,
  highMargin: boolean,
  popular: boolean
): MenuQuadrant {
  if (margin == null) return popular ? 'plowhorse' : 'dog';
  if (highMargin && popular) return 'star';
  if (!highMargin && popular) return 'plowhorse';
  if (highMargin && !popular) return 'puzzle';
  return 'dog';
}

const money = (n: number) => `$${(n || 0).toFixed(2)}`;
export const fmtMoney = money;
export const fmtPct = (n: number | null) => (n == null ? '—' : `${n.toFixed(1)}%`);

// ── Generic loader (mirrors useInventoryItems' shape) ──

function useTable<T>(table: string, select = '*', orderBy?: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(table).select(select);
    if (orderBy) query = query.order(orderBy);
    const { data: rows, error } = await query;
    if (error) {
      console.error(`[${table}] load error:`, error.message);
      toast.error(`Failed to load ${table.replace(/_/g, ' ')}`);
    } else {
      setData((rows as T[]) || []);
    }
    setLoading(false);
  }, [table, select, orderBy]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}

// ── Vendors ──

export function useVendors() {
  const { data, loading, refresh } = useTable<Vendor>('vendors', '*', 'name');

  const create = async (input: Omit<Vendor, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('vendors').insert(input as Record<string, unknown>);
    if (error) {
      toast.error(`Failed to add vendor: ${error.message}`);
      return false;
    }
    toast.success('Vendor added');
    await refresh();
    return true;
  };

  const update = async (id: number, fields: Partial<Vendor>) => {
    const { error } = await supabase.from('vendors').update(fields as Record<string, unknown>).eq('id', id);
    if (error) {
      toast.error(`Failed to update vendor: ${error.message}`);
      return false;
    }
    toast.success('Vendor updated');
    await refresh();
    return true;
  };

  const remove = async (id: number) => {
    const { error } = await supabase.from('vendors').delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete vendor: ${error.message}`);
      return false;
    }
    toast.success('Vendor deleted');
    await refresh();
    return true;
  };

  return { vendors: data, loading, refresh, create, update, remove };
}

export function useVendorCatalog() {
  const { data, loading, refresh } = useTable<VendorCatalogRow>('vendor_catalog');
  return { catalog: data, loading, refresh };
}

// ── Recipes (with ingredient join) ──

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .order('name');
    if (error) {
      console.error('[recipes] load error:', error.message);
      toast.error('Failed to load recipes');
    } else {
      setRecipes((data as Recipe[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createRecipe = async (
    input: Omit<Recipe, 'id' | 'created_at' | 'recipe_ingredients'>,
    ingredients: Omit<RecipeIngredient, 'id' | 'created_at' | 'recipe_id'>[]
  ) => {
    const { data: created, error } = await supabase
      .from('recipes')
      .insert(input as Record<string, unknown>)
      .select('id')
      .single();
    if (error || !created) {
      toast.error(`Failed to create recipe: ${error?.message ?? 'unknown error'}`);
      return false;
    }
    const recipeId = (created as { id: number }).id;
    if (ingredients.length) {
      const rows = ingredients.map((ing) => ({ ...ing, recipe_id: recipeId }));
      const { error: ingErr } = await supabase.from('recipe_ingredients').insert(rows as Record<string, unknown>[]);
      if (ingErr) {
        toast.error(`Recipe saved but ingredients failed: ${ingErr.message}`);
        await refresh();
        return false;
      }
    }
    toast.success('Recipe created');
    await refresh();
    return true;
  };

  const updateRecipe = async (
    id: number,
    fields: Partial<Omit<Recipe, 'recipe_ingredients'>>,
    ingredients?: Omit<RecipeIngredient, 'id' | 'created_at' | 'recipe_id'>[]
  ) => {
    const { recipe_ingredients: _drop, ...rest } = fields as Recipe;
    const { error } = await supabase.from('recipes').update(rest as Record<string, unknown>).eq('id', id);
    if (error) {
      toast.error(`Failed to update recipe: ${error.message}`);
      return false;
    }
    if (ingredients) {
      // Replace the ingredient set wholesale (simple + correct for a small recipe).
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
      if (ingredients.length) {
        const rows = ingredients.map((ing) => ({ ...ing, recipe_id: id }));
        const { error: ingErr } = await supabase.from('recipe_ingredients').insert(rows as Record<string, unknown>[]);
        if (ingErr) {
          toast.error(`Recipe saved but ingredients failed: ${ingErr.message}`);
          await refresh();
          return false;
        }
      }
    }
    toast.success('Recipe updated');
    await refresh();
    return true;
  };

  const removeRecipe = async (id: number) => {
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete recipe: ${error.message}`);
      return false;
    }
    toast.success('Recipe deleted');
    await refresh();
    return true;
  };

  return { recipes, loading, refresh, createRecipe, updateRecipe, removeRecipe };
}

// ── Purchase orders (with line + vendor join) ──

export function usePurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*), vendors(name, email)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[purchase_orders] load error:', error.message);
      toast.error('Failed to load purchase orders');
    } else {
      setOrders((data as PurchaseOrder[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Persist a draft PO (header + lines). Returns the new PO id, or null on failure. */
  const createDraft = async (
    vendorId: number,
    lines: DraftPoLine[],
    createdBy: string | null,
    notes?: string | null
  ): Promise<number | null> => {
    const total = lines.reduce((sum, l) => sum + l.qty * l.unit_cost, 0);
    const { data: po, error } = await supabase
      .from('purchase_orders')
      .insert({ vendor_id: vendorId, status: 'draft', total, created_by: createdBy, notes: notes ?? null })
      .select('id')
      .single();
    if (error || !po) {
      toast.error(`Failed to create PO: ${error?.message ?? 'unknown error'}`);
      return null;
    }
    const poId = (po as { id: number }).id;
    const rows = lines.map((l) => ({
      po_id: poId,
      item_id: l.item_id,
      name: l.name,
      unit: l.unit,
      qty: l.qty,
      unit_cost: l.unit_cost,
    }));
    const { error: lineErr } = await supabase.from('purchase_order_items').insert(rows as Record<string, unknown>[]);
    if (lineErr) {
      toast.error(`PO created but lines failed: ${lineErr.message}`);
      await refresh();
      return poId;
    }
    toast.success('Draft purchase order saved');
    await refresh();
    return poId;
  };

  const updateStatus = async (id: number, status: PurchaseOrderStatus) => {
    const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', id);
    if (error) {
      toast.error(`Failed to update PO: ${error.message}`);
      return false;
    }
    await refresh();
    return true;
  };

  const remove = async (id: number) => {
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete PO: ${error.message}`);
      return false;
    }
    toast.success('Purchase order deleted');
    await refresh();
    return true;
  };

  return { orders, loading, refresh, createDraft, updateStatus, remove };
}

// ── Price history ──

export function usePriceHistory() {
  const { data, loading, refresh } = useTable<PriceHistoryRow>('price_history', '*', 'observed_at');
  return { history: data, loading, refresh };
}

// ── Reorder grouping (below-par items → vendor groups) ──

/**
 * Build the suggested reorder: every active item at/below par, grouped under the
 * cheapest vendor in vendor_catalog (by case_cost). Items with no catalog mapping
 * fall under a synthetic "Unassigned" group (vendor id -1) so they're still visible.
 * qty = how many packs/cases to bring stock up to (par + 1 cushion) of par level.
 */
export function buildReorderGroups(
  items: InventoryItem[],
  vendors: Vendor[],
  catalog: VendorCatalogRow[]
): VendorReorderGroup[] {
  const vendorsById = new Map(vendors.map((v) => [v.id, v]));

  // Cheapest catalog row per item.
  const bestByItem = new Map<number, VendorCatalogRow>();
  for (const row of catalog) {
    if (row.item_id == null) continue;
    const existing = bestByItem.get(row.item_id);
    if (!existing || row.case_cost < existing.case_cost) bestByItem.set(row.item_id, row);
  }

  const groups = new Map<number, VendorReorderGroup>();
  const UNASSIGNED: Vendor = {
    id: -1,
    created_at: '',
    name: 'Unassigned (no vendor mapped)',
    email: null,
    phone: null,
    rep: null,
    notes: null,
    active: true,
  };

  const below = items.filter((i) => i.active && i.current_quantity <= i.par_level);

  for (const item of below) {
    const best = bestByItem.get(item.id);
    const vendor = best ? vendorsById.get(best.vendor_id) ?? UNASSIGNED : UNASSIGNED;
    const packSize = best && best.pack_size > 0 ? best.pack_size : 1;
    const unitCost = best ? best.case_cost : (item.cost_per_unit ?? 0) * packSize;

    // Bring up to par + 1-unit cushion, ceil to whole packs/cases.
    const need = Math.max(item.par_level - item.current_quantity, 0) + 1;
    const qty = Math.max(1, Math.ceil(need / packSize));

    const line: DraftPoLine = {
      item_id: item.id,
      name: item.name,
      unit: best ? 'case' : item.unit,
      qty,
      unit_cost: unitCost,
    };

    const key = vendor.id;
    const group = groups.get(key);
    if (group) {
      group.lines.push(line);
      group.total += qty * unitCost;
    } else {
      groups.set(key, { vendor, lines: [line], total: qty * unitCost });
    }
  }

  // Real vendors first (sorted by name), Unassigned last.
  return Array.from(groups.values()).sort((a, b) => {
    if (a.vendor.id === -1) return 1;
    if (b.vendor.id === -1) return -1;
    return a.vendor.name.localeCompare(b.vendor.name);
  });
}

// ── Aggregate convenience hook for the page ──

/** Index inventory items by id (memo-friendly) for live ingredient costing. */
export function useItemsById(items: InventoryItem[]): Map<number, InventoryItem> {
  return useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
}
