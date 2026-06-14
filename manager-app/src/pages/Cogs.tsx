// Cogs.tsx — Inventory Depth + COGS truth (route: /cogs).
//
// Four panels, mobile-first, dark-mode aware:
//   1. COGS% summary — StatTrend KPI tiles + a Sparkline of recent observed unit
//      costs (price_history) and a BarChart of pour-cost % by drink.
//   2. Pour / recipe costing — every recipe with live cost per serving + pour-cost %.
//      A modal builds/edits a recipe from inventory ingredients.
//   3. Menu Profitability matrix (Stars / Dogs) — joins the live cocktails menu to
//      recipe cost; classifies each into a menu-engineering quadrant.
//   4. Draft Purchase-Order builder — below-par items grouped by vendor; save a draft
//      and "Send" it through the gated send-purchase-order edge function.
//
// All costing is pure (see useCogs helpers); the screen just composes + renders.

import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Send,
  Truck,
  ChefHat,
  Star,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  DollarSign,
  Percent,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { useInventoryItems } from '../hooks/useInventory';
import {
  useVendors,
  useVendorCatalog,
  useRecipes,
  usePurchaseOrders,
  usePriceHistory,
  useItemsById,
  recipeCost,
  pourCostPct,
  grossMargin,
  classifyMenuItem,
  buildReorderGroups,
  fmtMoney,
  fmtPct,
  QUADRANT_LABELS,
  PO_STATUS_LABELS,
  type Recipe,
  type RecipeIngredient,
  type DraftPoLine,
  type VendorReorderGroup,
  type MenuQuadrant,
} from '../hooks/useCogs';
import { StatTrend } from '../components/charts/StatTrend';
import { Sparkline } from '../components/charts/Sparkline';
import { BarChart } from '../components/charts/BarChart';
import Select from '../components/ui/Select';
import { Field } from '../components/ui/Field';
import type { InventoryItem } from '../types';

const TARGET_POUR_COST = 20; // % — bar industry rule of thumb for liquor pour cost

// Parse a text menu price ("$12", "12.00", "12 / 14") to a number, or null.
function parseMenuPrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

interface CocktailRow {
  id: number;
  name: string;
  price: string;
}

// ── Recipe form modal ──

interface RecipeFormProps {
  open: boolean;
  onClose: () => void;
  items: InventoryItem[];
  initial?: Recipe | null;
  onSubmitCreate: (
    recipe: Omit<Recipe, 'id' | 'created_at' | 'recipe_ingredients'>,
    ingredients: Omit<RecipeIngredient, 'id' | 'created_at' | 'recipe_id'>[]
  ) => Promise<boolean>;
  onSubmitUpdate: (
    id: number,
    fields: Partial<Omit<Recipe, 'recipe_ingredients'>>,
    ingredients: Omit<RecipeIngredient, 'id' | 'created_at' | 'recipe_id'>[]
  ) => Promise<boolean>;
}

type DraftIng = { item_id: number | null; qty: number; unit: string };

function RecipeFormModal({ open, onClose, items, initial, onSubmitCreate, onSubmitUpdate }: RecipeFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<string>(initial?.category ?? 'drink');
  const [menuPrice, setMenuPrice] = useState<string>(initial?.menu_price != null ? String(initial.menu_price) : '');
  const [yieldQty, setYieldQty] = useState<number>(initial?.yield ?? 1);
  const [ingredients, setIngredients] = useState<DraftIng[]>(
    (initial?.recipe_ingredients ?? []).map((ing) => ({ item_id: ing.item_id, qty: ing.qty, unit: ing.unit ?? 'oz' }))
  );
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const addIngredient = () =>
    setIngredients((prev) => [...prev, { item_id: items[0]?.id ?? null, qty: 1, unit: 'oz' }]);
  const removeIngredient = (idx: number) => setIngredients((prev) => prev.filter((_, i) => i !== idx));
  const patchIngredient = (idx: number, patch: Partial<DraftIng>) =>
    setIngredients((prev) => prev.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const recipePayload = {
      name: name.trim(),
      category,
      menu_ref: initial?.menu_ref ?? null,
      menu_price: menuPrice.trim() ? Number(menuPrice) : null,
      yield: yieldQty > 0 ? yieldQty : 1,
      active: initial?.active ?? true,
    };
    const ingPayload = ingredients
      .filter((ing) => ing.item_id != null)
      .map((ing) => ({
        item_id: ing.item_id,
        name: items.find((it) => it.id === ing.item_id)?.name ?? null,
        qty: ing.qty || 0,
        unit: ing.unit || null,
      }));
    const ok = initial
      ? await onSubmitUpdate(initial.id, recipePayload, ingPayload)
      : await onSubmitCreate(recipePayload, ingPayload);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface">
          <h2 className="font-semibold text-text-primary">{initial ? 'Edit Recipe' : 'New Recipe'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Name *">
            <input className="input-field" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Type">
              <Select<string>
                variant="manager"
                value={category}
                onChange={setCategory}
                options={[
                  { value: 'drink', label: 'Drink' },
                  { value: 'food', label: 'Food' },
                ]}
              />
            </Field>
            <Field label="Menu price ($)">
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={menuPrice}
                onChange={(e) => setMenuPrice(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Yield (servings)">
              <input
                type="number"
                step="any"
                min="1"
                className="input-field"
                value={yieldQty}
                onChange={(e) => setYieldQty(Number(e.target.value))}
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Ingredients</label>
              <button type="button" onClick={addIngredient} className="btn-ghost text-xs flex items-center gap-1">
                <Plus size={14} /> Add
              </button>
            </div>
            {ingredients.length === 0 ? (
              <p className="text-sm text-text-muted">No ingredients yet. Add one to start costing.</p>
            ) : (
              <div className="space-y-2">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Select<number>
                        variant="manager"
                        value={ing.item_id}
                        onChange={(v) => patchIngredient(idx, { item_id: v })}
                        options={items.map((it) => ({ value: it.id, label: it.name }))}
                        placeholder="Select item"
                      />
                    </div>
                    <input
                      type="number"
                      step="any"
                      className="input-field w-20 shrink-0"
                      value={ing.qty}
                      onChange={(e) => patchIngredient(idx, { qty: Number(e.target.value) })}
                      aria-label="Quantity"
                    />
                    <input
                      className="input-field w-16 shrink-0"
                      value={ing.unit}
                      onChange={(e) => patchIngredient(idx, { unit: e.target.value })}
                      aria-label="Unit"
                    />
                    <button
                      type="button"
                      onClick={() => removeIngredient(idx)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-danger shrink-0"
                      aria-label="Remove ingredient"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Quadrant chip ──

const QUADRANT_TONE: Record<MenuQuadrant, string> = {
  star: 'badge-success',
  plowhorse: 'badge-primary',
  puzzle: 'badge-accent',
  dog: 'badge-danger',
};

// ── Main page ──

export function Cogs() {
  const { user } = useAuth();
  const { items, loading: itemsLoading } = useInventoryItems();
  const itemsById = useItemsById(items);
  const { recipes, loading: recipesLoading, createRecipe, updateRecipe, removeRecipe } = useRecipes();
  const { vendors } = useVendors();
  const { catalog } = useVendorCatalog();
  const { orders, refresh: refreshOrders, createDraft, remove: removePo } = usePurchaseOrders();
  const { history } = usePriceHistory();
  const confirm = useConfirm();
  const [cocktails, setCocktails] = useState<CocktailRow[]>([]);

  const [recipeModal, setRecipeModal] = useState<{ open: boolean; initial: Recipe | null }>({ open: false, initial: null });
  const [sendingPoId, setSendingPoId] = useState<number | null>(null);
  const [savingGroup, setSavingGroup] = useState<number | null>(null);

  // Load cocktails for the profitability matrix (menu price lives there as text).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('cocktails').select('id, name, price').order('name');
      if (!cancelled && data) setCocktails(data as CocktailRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Derived: costed recipes ──
  const costedRecipes = useMemo(
    () =>
      recipes.map((r) => {
        const cost = recipeCost(r, itemsById);
        const pct = pourCostPct(cost, r.menu_price);
        const margin = grossMargin(cost, r.menu_price);
        return { recipe: r, cost, pct, margin };
      }),
    [recipes, itemsById]
  );

  // ── COGS% summary metrics ──
  const avgPourCost = useMemo(() => {
    const valid = costedRecipes.map((c) => c.pct).filter((p): p is number => p != null);
    if (!valid.length) return null;
    return valid.reduce((s, p) => s + p, 0) / valid.length;
  }, [costedRecipes]);

  const totalMenuValue = useMemo(
    () => costedRecipes.reduce((s, c) => s + (c.recipe.menu_price ?? 0), 0),
    [costedRecipes]
  );
  const totalRecipeCost = useMemo(() => costedRecipes.reduce((s, c) => s + c.cost, 0), [costedRecipes]);

  // Recent observed unit costs (price_history) for the trend sparkline.
  const costTrend = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.observed_at.localeCompare(b.observed_at));
    return sorted.slice(-24).map((h) => h.cost_per_unit);
  }, [history]);

  // Pour-cost % per drink (bar chart).
  const pourCostBars = useMemo(
    () =>
      costedRecipes
        .filter((c) => c.pct != null)
        .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
        .slice(0, 8)
        .map((c) => ({
          label: c.recipe.name,
          value: Number((c.pct ?? 0).toFixed(1)),
          color: (c.pct ?? 0) > TARGET_POUR_COST ? '#ef4444' : '#2dd4bf',
          hint: `${c.recipe.name}: ${fmtPct(c.pct)} pour cost`,
        })),
    [costedRecipes]
  );

  // ── Menu profitability matrix (cocktails ⨯ recipe cost) ──
  const matrix = useMemo(() => {
    // Map a recipe to a cocktail by exact (case-insensitive) name match.
    const recipeByName = new Map(recipes.map((r) => [r.name.trim().toLowerCase(), r] as const));

    const rows = cocktails.map((c) => {
      const price = parseMenuPrice(c.price);
      const recipe = recipeByName.get(c.name.trim().toLowerCase());
      const cost = recipe ? recipeCost(recipe, itemsById) : null;
      const margin = cost != null && price != null ? price - cost : null;
      return { id: c.id, name: c.name, price, cost, margin };
    });

    const margins = rows.map((r) => r.margin).filter((m): m is number => m != null).sort((a, b) => a - b);
    const medianMargin = margins.length ? margins[Math.floor(margins.length / 2)] : 0;

    return rows.map((r) => {
      const highMargin = r.margin != null && r.margin >= medianMargin;
      // No real sales feed yet → treat anything that HAS a costed recipe as "tracked/popular"
      // so the matrix is meaningful day one; refine when POS sales land.
      const popular = r.cost != null;
      const quadrant = classifyMenuItem(r.margin, highMargin, popular);
      return { ...r, quadrant };
    });
  }, [cocktails, recipes, itemsById]);

  const quadrantCounts = useMemo(() => {
    const counts: Record<MenuQuadrant, number> = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };
    for (const row of matrix) counts[row.quadrant]++;
    return counts;
  }, [matrix]);

  // ── Reorder groups (below-par → vendor) ──
  const reorderGroups = useMemo(
    () => buildReorderGroups(items, vendors, catalog),
    [items, vendors, catalog]
  );

  // ── Actions ──
  const handleSaveDraft = async (group: VendorReorderGroup) => {
    if (group.vendor.id === -1) {
      toast.error('Map these items to a vendor in vendor_catalog before creating a PO.');
      return;
    }
    setSavingGroup(group.vendor.id);
    await createDraft(group.vendor.id, group.lines, user?.email ?? null);
    setSavingGroup(null);
  };

  const handleSendPo = async (poId: number) => {
    setSendingPoId(poId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated. Please log in again.');
        return;
      }
      const { data, error } = await supabase.functions.invoke('send-purchase-order', { body: { poId } });
      if (error) {
        // Surface the function's JSON error message when present (e.g. 503 gated).
        let message = error.message;
        try {
          const ctx = await (error as { context?: Response }).context?.json();
          if (ctx?.error) message = ctx.error;
        } catch { /* keep generic */ }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      toast.success(`Purchase order sent to ${data?.sentTo ?? 'vendor'}`);
      await refreshOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send purchase order');
    } finally {
      setSendingPoId(null);
    }
  };

  const handleDeleteRecipe = async (r: Recipe) => {
    const ok = await confirm({
      title: 'Delete recipe',
      message: `Delete recipe "${r.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await removeRecipe(r.id);
  };

  const loading = itemsLoading || recipesLoading;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Calculator size={22} className="text-primary" />
          <h1 className="text-2xl font-bold text-text-primary">COGS</h1>
          <span className="badge text-text-muted">{recipes.length} recipes</span>
        </div>
        <button
          onClick={() => setRecipeModal({ open: true, initial: null })}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Recipe</span>
        </button>
      </div>

      {/* ── 1. COGS% SUMMARY ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatTrend
          label="Avg pour cost"
          value={fmtPct(avgPourCost)}
          icon={<Percent size={15} />}
          caption={avgPourCost != null && avgPourCost > TARGET_POUR_COST ? 'Above target' : 'On target'}
          benchmark={`Bar target ${TARGET_POUR_COST}%`}
        />
        <StatTrend
          label="Recipe cost (total)"
          value={fmtMoney(totalRecipeCost)}
          icon={<DollarSign size={15} />}
          caption="Across all recipes"
        />
        <StatTrend
          label="Menu value (total)"
          value={fmtMoney(totalMenuValue)}
          icon={<DollarSign size={15} />}
          caption="Listed sell price sum"
        />
        <StatTrend
          label="Below par"
          value={reorderGroups.reduce((s, g) => s + g.lines.length, 0)}
          icon={<AlertTriangle size={15} />}
          caption="Items to reorder"
          invertDelta
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-4 sm:p-5">
          <p className="text-sm text-text-muted mb-1">Observed unit-cost trend</p>
          <p className="text-xs text-text-muted mb-3">Last {costTrend.length} cost observations (price history)</p>
          {costTrend.length >= 2 ? (
            <Sparkline values={costTrend} area showLast height={48} />
          ) : (
            <p className="text-sm text-text-muted py-4">Not enough price history yet.</p>
          )}
        </div>
        <div className="card p-4 sm:p-5">
          <p className="text-sm text-text-muted mb-1">Pour cost % by drink</p>
          <p className="text-xs text-text-muted mb-3">Red bars exceed the {TARGET_POUR_COST}% target</p>
          <BarChart data={pourCostBars} formatValue={(n) => `${n}%`} height={140} />
        </div>
      </div>

      {loading ? (
        <div className="card p-16 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── 2. POUR / RECIPE COSTING ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ChefHat size={18} className="text-text-secondary" />
              <h2 className="text-lg font-semibold text-text-primary">Pour &amp; recipe costing</h2>
            </div>
            {recipes.length === 0 ? (
              <div className="card p-12 text-center">
                <ChefHat size={40} className="mx-auto text-text-muted mb-3" />
                <p className="text-text-muted">No recipes yet — add one to start costing drinks.</p>
                <button onClick={() => setRecipeModal({ open: true, initial: null })} className="btn-primary mt-4">
                  Add your first recipe
                </button>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide">
                        <th className="px-5 py-3 font-medium">Recipe</th>
                        <th className="px-5 py-3 font-medium text-center">Yield</th>
                        <th className="px-5 py-3 font-medium text-right">Cost / serving</th>
                        <th className="px-5 py-3 font-medium text-right">Menu price</th>
                        <th className="px-5 py-3 font-medium text-right">Margin</th>
                        <th className="px-5 py-3 font-medium text-right">Pour cost</th>
                        <th className="px-5 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {costedRecipes.map(({ recipe, cost, pct, margin }) => (
                        <tr key={recipe.id} className="hover:bg-surface-hover transition-colors">
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-text-primary">{recipe.name}</p>
                            <p className="text-xs text-text-muted">
                              {(recipe.recipe_ingredients?.length ?? 0)} ingredient{(recipe.recipe_ingredients?.length ?? 0) === 1 ? '' : 's'}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-center text-sm text-text-secondary tabular-nums">{recipe.yield}</td>
                          <td className="px-5 py-3 text-right text-sm text-text-primary tabular-nums">{fmtMoney(cost)}</td>
                          <td className="px-5 py-3 text-right text-sm text-text-secondary tabular-nums">
                            {recipe.menu_price != null ? fmtMoney(recipe.menu_price) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums">
                            {margin != null ? (
                              <span className={margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-danger'}>
                                {fmtMoney(margin)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {pct != null ? (
                              <span className={pct > TARGET_POUR_COST ? 'badge-danger' : 'badge-success'}>{fmtPct(pct)}</span>
                            ) : (
                              <span className="text-xs text-text-muted">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setRecipeModal({ open: true, initial: recipe })}
                                className="p-2 rounded-lg hover:bg-surface-active text-text-muted hover:text-text-primary"
                                title="Edit"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteRecipe(recipe)}
                                className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-danger"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {costedRecipes.map(({ recipe, cost, pct, margin }) => (
                    <div key={recipe.id} className="card p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{recipe.name}</p>
                          <p className="text-xs text-text-muted">
                            Cost {fmtMoney(cost)} · {recipe.menu_price != null ? fmtMoney(recipe.menu_price) : '—'}
                          </p>
                        </div>
                        {pct != null && (
                          <span className={pct > TARGET_POUR_COST ? 'badge-danger' : 'badge-success'}>{fmtPct(pct)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm tabular-nums ${margin != null && margin < 0 ? 'text-danger' : 'text-text-secondary'}`}>
                          Margin {margin != null ? fmtMoney(margin) : '—'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setRecipeModal({ open: true, initial: recipe })}
                            className="p-2 rounded-lg hover:bg-surface-active text-text-muted"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteRecipe(recipe)}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-danger"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* ── 3. MENU PROFITABILITY MATRIX ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-text-secondary" />
              <h2 className="text-lg font-semibold text-text-primary">Menu profitability</h2>
              <span className="badge text-text-muted">Stars vs Dogs</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="card p-4 flex items-center gap-3">
                <Star size={18} className="text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-lg font-bold text-text-primary tabular-nums">{quadrantCounts.star}</p>
                  <p className="text-xs text-text-muted">Stars</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <TrendingDown size={18} className="text-primary" />
                <div>
                  <p className="text-lg font-bold text-text-primary tabular-nums">{quadrantCounts.plowhorse}</p>
                  <p className="text-xs text-text-muted">Plowhorses</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <Sparkles size={18} className="text-amber-500" />
                <div>
                  <p className="text-lg font-bold text-text-primary tabular-nums">{quadrantCounts.puzzle}</p>
                  <p className="text-xs text-text-muted">Puzzles</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <AlertTriangle size={18} className="text-danger" />
                <div>
                  <p className="text-lg font-bold text-text-primary tabular-nums">{quadrantCounts.dog}</p>
                  <p className="text-xs text-text-muted">Dogs</p>
                </div>
              </div>
            </div>

            {matrix.length === 0 ? (
              <div className="card p-12 text-center">
                <Sparkles size={40} className="mx-auto text-text-muted mb-3" />
                <p className="text-text-muted">No cocktails on the menu yet. Add cocktails + name-matched recipes to see profitability.</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide">
                      <th className="px-5 py-3 font-medium">Menu item</th>
                      <th className="px-5 py-3 font-medium text-right">Price</th>
                      <th className="px-5 py-3 font-medium text-right hidden sm:table-cell">Cost</th>
                      <th className="px-5 py-3 font-medium text-right">Margin</th>
                      <th className="px-5 py-3 font-medium text-right">Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {matrix.map((row) => (
                      <tr key={row.id} className="hover:bg-surface-hover transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-text-primary">{row.name}</td>
                        <td className="px-5 py-3 text-right text-sm text-text-secondary tabular-nums">
                          {row.price != null ? fmtMoney(row.price) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-text-secondary tabular-nums hidden sm:table-cell">
                          {row.cost != null ? fmtMoney(row.cost) : <span className="text-text-muted">no recipe</span>}
                        </td>
                        <td className="px-5 py-3 text-right text-sm tabular-nums">
                          {row.margin != null ? (
                            <span className={row.margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-danger'}>
                              {fmtMoney(row.margin)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={QUADRANT_TONE[row.quadrant]}>{QUADRANT_LABELS[row.quadrant]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── 4. DRAFT PURCHASE-ORDER BUILDER ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Truck size={18} className="text-text-secondary" />
              <h2 className="text-lg font-semibold text-text-primary">Reorder &amp; purchase orders</h2>
              <span className="badge text-text-muted">Below par by vendor</span>
            </div>

            {reorderGroups.length === 0 ? (
              <div className="card p-12 text-center">
                <Truck size={40} className="mx-auto text-text-muted mb-3" />
                <p className="text-text-muted">Everything is at or above par. Nothing to reorder.</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {reorderGroups.map((group) => (
                  <div key={group.vendor.id} className="card p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{group.vendor.name}</p>
                        <p className="text-xs text-text-muted">
                          {group.lines.length} item{group.lines.length === 1 ? '' : 's'} · est. {fmtMoney(group.total)}
                          {group.vendor.email ? ` · ${group.vendor.email}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSaveDraft(group)}
                        disabled={savingGroup === group.vendor.id || group.vendor.id === -1}
                        className="btn-secondary flex items-center gap-2 shrink-0 disabled:opacity-50"
                        title={group.vendor.id === -1 ? 'Map these items to a vendor first' : 'Save as draft PO'}
                      >
                        {savingGroup === group.vendor.id ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        <span className="hidden sm:inline">Draft PO</span>
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {group.lines.map((line: DraftPoLine) => (
                        <div key={line.item_id} className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary truncate">{line.name}</span>
                          <span className="text-text-muted tabular-nums shrink-0 ml-3">
                            {line.qty} {line.unit ?? ''} × {fmtMoney(line.unit_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Saved purchase orders */}
            {orders.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-text-secondary mb-2">Purchase orders</h3>
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide">
                        <th className="px-5 py-3 font-medium">PO</th>
                        <th className="px-5 py-3 font-medium">Vendor</th>
                        <th className="px-5 py-3 font-medium text-center">Status</th>
                        <th className="px-5 py-3 font-medium text-right hidden sm:table-cell">Total</th>
                        <th className="px-5 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orders.map((po) => (
                        <tr key={po.id} className="hover:bg-surface-hover transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-text-primary">#{po.id}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{po.vendors?.name ?? '—'}</td>
                          <td className="px-5 py-3 text-center">
                            <span
                              className={
                                po.status === 'sent'
                                  ? 'badge-success'
                                  : po.status === 'cancelled'
                                    ? 'badge-danger'
                                    : po.status === 'received'
                                      ? 'badge-primary'
                                      : 'badge-accent'
                              }
                            >
                              {PO_STATUS_LABELS[po.status]}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-text-secondary tabular-nums hidden sm:table-cell">
                            {fmtMoney(po.total)}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {po.status === 'draft' && (
                                <button
                                  onClick={() => handleSendPo(po.id)}
                                  disabled={sendingPoId === po.id}
                                  className="btn-primary flex items-center gap-1.5 text-xs py-1.5 disabled:opacity-50"
                                  title={po.vendors?.email ? `Email ${po.vendors.email}` : 'No vendor email on file'}
                                >
                                  {sendingPoId === po.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Send size={14} />
                                  )}
                                  Send
                                </button>
                              )}
                              <button
                                onClick={() => removePo(po.id)}
                                className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-danger"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <RecipeFormModal
        open={recipeModal.open}
        onClose={() => setRecipeModal({ open: false, initial: null })}
        items={items}
        initial={recipeModal.initial}
        onSubmitCreate={createRecipe}
        onSubmitUpdate={updateRecipe}
      />
    </div>
  );
}

export default Cogs;
