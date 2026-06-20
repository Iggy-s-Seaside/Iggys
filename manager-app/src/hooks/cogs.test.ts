import { describe, it, expect } from 'vitest';
import { recipeCost, pourCostPct, grossMargin, buildReorderGroups } from './useCogs';
import type { Recipe, Vendor, VendorCatalogRow } from './useCogs';
import type { InventoryItem } from '../types';

// Minimal fixtures — only the fields each function reads.
const item = (over: Partial<InventoryItem>) =>
  ({ id: 1, name: 'X', active: true, current_quantity: 0, par_level: 5, unit: 'unit', cost_per_unit: null, ...over } as unknown as InventoryItem);

describe('pourCostPct — cost / price * 100', () => {
  it('computes a normal pour cost', () => {
    expect(pourCostPct(2, 8)).toBe(25);
  });
  it('returns null for null, zero, or negative price (no divide-by-zero)', () => {
    expect(pourCostPct(2, null)).toBeNull();
    expect(pourCostPct(2, 0)).toBeNull();
    expect(pourCostPct(2, -5)).toBeNull();
  });
});

describe('grossMargin — price - cost', () => {
  it('computes profit and loss', () => {
    expect(grossMargin(3, 10)).toBe(7);
    expect(grossMargin(12, 10)).toBe(-2); // sells below cost
  });
  it('returns null when price is unknown', () => {
    expect(grossMargin(3, null)).toBeNull();
  });
});

describe('recipeCost — batch cost / servings', () => {
  const items = new Map<number, InventoryItem>([
    [1, item({ id: 1, cost_per_unit: 2 })],
    [2, item({ id: 2, cost_per_unit: 0.5 })],
  ]);
  it('sums ingredient costs and divides by yield', () => {
    const recipe = { yield: 2, recipe_ingredients: [{ item_id: 1, qty: 3 }, { item_id: 2, qty: 4 }] } as unknown as Recipe;
    // (2*3 + 0.5*4) / 2 = 8 / 2 = 4
    expect(recipeCost(recipe, items)).toBe(4);
  });
  it('treats yield 0/null as a single serving (no divide-by-zero)', () => {
    const recipe = { yield: 0, recipe_ingredients: [{ item_id: 1, qty: 2 }] } as unknown as Recipe;
    expect(recipeCost(recipe, items)).toBe(4); // 2*2 / 1
  });
  it('ignores unknown items and empty recipes', () => {
    expect(recipeCost({ yield: 1, recipe_ingredients: [{ item_id: 99, qty: 5 }] } as unknown as Recipe, items)).toBe(0);
    expect(recipeCost({ yield: 1, recipe_ingredients: [] } as unknown as Recipe, items)).toBe(0);
  });
  it('treats a NaN cost_per_unit as 0 instead of NaN-poisoning the recipe cost', () => {
    const bad = new Map<number, InventoryItem>([[1, item({ id: 1, cost_per_unit: NaN })], [2, item({ id: 2, cost_per_unit: 0.5 })]]);
    // ingredient 1 (NaN cost) contributes 0; (0 + 0.5*4) / 1 = 2
    const recipe = { yield: 1, recipe_ingredients: [{ item_id: 1, qty: 3 }, { item_id: 2, qty: 4 }] } as unknown as Recipe;
    const cost = recipeCost(recipe, bad);
    expect(Number.isFinite(cost)).toBe(true);
    expect(cost).toBe(2);
  });
});

describe('buildReorderGroups — never produces a NaN total (regression)', () => {
  const vendors = [{ id: 10, name: 'ACME' } as unknown as Vendor];

  it('computes a normal reorder total', () => {
    const catalog = [{ item_id: 1, vendor_id: 10, case_cost: 10, pack_size: 1 } as unknown as VendorCatalogRow];
    const groups = buildReorderGroups([item({ id: 1, current_quantity: 0, par_level: 5 })], vendors, catalog);
    // need = (5-0)+1 = 6, qty = ceil(6/1) = 6, total = 6 * 10 = 60
    expect(groups[0].total).toBe(60);
  });

  it('guards a NaN catalog case_cost (total stays finite, not NaN)', () => {
    const catalog = [{ item_id: 1, vendor_id: 10, case_cost: NaN, pack_size: 1 } as unknown as VendorCatalogRow];
    const groups = buildReorderGroups([item({ id: 1 })], vendors, catalog);
    expect(groups.every((g) => Number.isFinite(g.total))).toBe(true);
  });

  it('guards a NaN/null cost_per_unit when there is no catalog row', () => {
    const groupsNaN = buildReorderGroups([item({ id: 1, cost_per_unit: NaN })], vendors, []);
    const groupsNull = buildReorderGroups([item({ id: 1, cost_per_unit: null })], vendors, []);
    expect(groupsNaN.every((g) => Number.isFinite(g.total))).toBe(true);
    expect(groupsNull.every((g) => Number.isFinite(g.total))).toBe(true);
  });

  it('excludes items strictly above par', () => {
    const groups = buildReorderGroups([item({ id: 1, current_quantity: 9, par_level: 5 })], vendors, []);
    expect(groups).toEqual([]);
  });

  it('includes items at par (qty === par_level, <= boundary)', () => {
    // The impl uses current_quantity <= par_level, so at-par items ARE included.
    const groups = buildReorderGroups([item({ id: 1, current_quantity: 5, par_level: 5 })], vendors, []);
    expect(groups.length).toBeGreaterThan(0);
  });
});
