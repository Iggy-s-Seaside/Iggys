import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useImageUpload } from './useImageUpload';
import type { MerchProductWithVariants, UseMerch } from './useMerch';
import { variantLabel } from './useMerch';

// Reuses the EXISTING scan-order edge function OCR (the bar invoice scanner).
// That function returns { supplier, orderNumber, items: [{description, quantity,
// size, sku}], rawText }. We do NOT modify it — we just route its output to a
// merch-variant matcher instead of the bar-inventory matcher.

export type MerchScanState =
  | 'idle'
  | 'uploading'
  | 'scanning'
  | 'reviewing'
  | 'confirming'
  | 'done'
  | 'error';

export type MerchScanStatus = 'matched' | 'new_variant' | 'new_product' | 'skipped' | 'unreadable';

/** A scanned invoice line, resolved against the merch catalog. */
export interface MerchScanLine {
  description: string;
  quantity: number;
  size: string;
  sku?: string;
  /** When matched: the variant this line increments. */
  matched_variant_id?: number;
  /** Product the variant belongs to (for display + new-variant creation). */
  matched_product_id?: string;
  match_confidence?: number;
  /** Human label of the resolved target ("Classic Tee · L"). */
  proposed_label?: string;
  /** For new_variant: the size/label to create under matched_product_id. */
  new_size?: string | null;
  new_label?: string | null;
  status: MerchScanStatus;
}

interface MerchScanResult {
  supplier: string | null;
  orderNumber: string | null;
  items: MerchScanLine[];
  imageUrl: string;
  rawText?: string;
}

// ── Fuzzy matching ──

/** Jaccard token similarity — word overlap score (0-1). Mirrors useOrderScanner. */
function fuzzyScore(needle: string, haystack: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/['']/g, '').split(/\s+/).filter((t) => t.length > 1);
  const a = new Set(normalize(needle));
  const b = new Set(normalize(haystack));
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((t) => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

/** Normalize a size token from OCR ("Large", "lg", "L ") → "L". */
function normalizeSize(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();
  const map: Record<string, string> = {
    'X-SMALL': 'XS', XSMALL: 'XS', XS: 'XS',
    SMALL: 'S', SM: 'S', S: 'S',
    MEDIUM: 'M', MED: 'M', M: 'M',
    LARGE: 'L', LG: 'L', L: 'L',
    'X-LARGE': 'XL', XLARGE: 'XL', XL: 'XL',
    'XX-LARGE': 'XXL', XXLARGE: 'XXL', XXL: 'XXL', '2XL': 'XXL',
    XXXL: 'XXXL', '3XL': 'XXXL',
  };
  return map[t] ?? (t.length <= 4 ? t : null);
}

/**
 * Resolve one scanned line against the merch catalog.
 *  1. Find the best-matching product by name (fuzzy on description).
 *  2. Within that product, match the variant by SKU first, then by size/label.
 *  3. Exact size/SKU under a known product but missing variant → new_variant.
 *  4. No product match → new_product (manager confirms a new merch type).
 */
function matchToMerch(
  line: { description: string; quantity: number; size: string; sku?: string },
  products: MerchProductWithVariants[]
): MerchScanLine {
  const base: MerchScanLine = {
    description: line.description,
    quantity: line.quantity,
    size: line.size,
    sku: line.sku,
    status: line.quantity > 0 ? 'new_product' : 'unreadable',
  };

  // SKU is the strongest signal — match a variant directly across all products.
  if (line.sku) {
    for (const p of products) {
      const bySku = p.variants.find(
        (v) => v.sku && v.sku.toLowerCase() === line.sku!.toLowerCase()
      );
      if (bySku) {
        return {
          ...base,
          matched_variant_id: bySku.id,
          matched_product_id: p.id,
          match_confidence: 1,
          proposed_label: `${p.name} · ${variantLabel(bySku)}`,
          status: 'matched',
        };
      }
    }
  }

  // Best product by name.
  let bestScore = 0;
  let bestProduct: MerchProductWithVariants | null = null;
  for (const p of products) {
    const score = fuzzyScore(line.description, p.name);
    if (score > bestScore) {
      bestScore = score;
      bestProduct = p;
    }
  }

  if (bestScore >= 0.4 && bestProduct) {
    const wantSize = normalizeSize(line.size);
    // Match the variant within the product by size, else by label token.
    const variant = bestProduct.variants.find((v) => {
      if (wantSize && v.size) return v.size.toUpperCase() === wantSize;
      if (v.variant_label) return fuzzyScore(line.size || line.description, v.variant_label) >= 0.5;
      return false;
    });

    if (variant) {
      return {
        ...base,
        matched_variant_id: variant.id,
        matched_product_id: bestProduct.id,
        match_confidence: bestScore,
        proposed_label: `${bestProduct.name} · ${variantLabel(variant)}`,
        status: 'matched',
      };
    }

    // Known product, unknown size → offer to create the variant.
    return {
      ...base,
      matched_product_id: bestProduct.id,
      match_confidence: bestScore,
      proposed_label: bestProduct.name,
      new_size: wantSize,
      new_label: wantSize ? null : line.size || null,
      status: line.quantity > 0 ? 'new_variant' : 'unreadable',
    };
  }

  return base;
}

// ── Hook ──

export function useMerchScanner(merch: UseMerch) {
  const { upload } = useImageUpload();
  const [state, setState] = useState<MerchScanState>('idle');
  const [result, setResult] = useState<MerchScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startScan = useCallback(
    async (file: File) => {
      setError(null);
      setState('uploading');
      const imageUrl = await upload(file, 'order-scans');
      if (!imageUrl) {
        setState('error');
        setError('Failed to upload image');
        return;
      }

      setState('scanning');
      try {
        const { data, error: fnError } = await supabase.functions.invoke('scan-order', {
          body: { imageUrl },
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        const items: MerchScanLine[] = (data.items || []).map(
          (item: { description: string; quantity: number; size: string; sku?: string }) =>
            matchToMerch(item, merch.products)
        );

        setResult({
          supplier: data.supplier ?? null,
          orderNumber: data.orderNumber ?? null,
          items,
          imageUrl,
          rawText: data.rawText,
        });
        setState('reviewing');
      } catch (err) {
        console.error('[merch scan-order]', err);
        setError(err instanceof Error ? err.message : 'Scan failed');
        setState('error');
        setResult((r) =>
          r ? { ...r, imageUrl } : { supplier: null, orderNumber: null, items: [], imageUrl }
        );
      }
    },
    [upload, merch.products]
  );

  const updateItem = useCallback((index: number, changes: Partial<MerchScanLine>) => {
    setResult((prev) => {
      if (!prev) return prev;
      const items = [...prev.items];
      items[index] = { ...items[index], ...changes };
      return { ...prev, items };
    });
  }, []);

  const updateSupplier = useCallback((supplier: string) => {
    setResult((prev) => (prev ? { ...prev, supplier } : prev));
  }, []);

  /**
   * Apply the reviewed scan: increment matched variants, create new variants on
   * known products, and create brand-new products (single starting variant) for
   * unmatched lines. All stock writes log reason 'scan_intake'.
   */
  const confirmIntake = useCallback(async () => {
    if (!result) return false;
    setState('confirming');

    try {
      let restocked = 0;
      let createdVariants = 0;
      let createdProducts = 0;
      let skipped = 0;

      // Pre-aggregate by target BEFORE applying so two invoice lines that hit the
      // same variant don't (a) lost-update each other off a stale stock read
      // [matched], or (b) collide on UNIQUE(product_id,size,variant_label)
      // [new_variant]. SKUs read by OCR are unreliable for uniqueness, so scan-
      // created rows are inserted with sku:null to avoid UNIQUE(sku) violations.
      const matchedTotals = new Map<number, number>();
      const newVariantGroups = new Map<string, { product_id: string; size: string | null; label: string | null; qty: number }>();
      const newProducts: typeof result.items = [];

      for (const line of result.items) {
        if (line.status === 'skipped' || line.status === 'unreadable' || line.quantity <= 0) {
          skipped++;
          continue;
        }
        if (line.status === 'matched' && line.matched_variant_id) {
          matchedTotals.set(line.matched_variant_id, (matchedTotals.get(line.matched_variant_id) ?? 0) + line.quantity);
        } else if (line.status === 'new_variant' && line.matched_product_id) {
          const size = line.new_size ?? null;
          const label = line.new_label ?? null;
          const key = `${line.matched_product_id}|${size ?? ''}|${label ?? ''}`;
          const g = newVariantGroups.get(key) ?? { product_id: line.matched_product_id, size, label, qty: 0 };
          g.qty += line.quantity;
          newVariantGroups.set(key, g);
        } else if (line.status === 'new_product') {
          newProducts.push(line);
        }
      }

      for (const [variantId, qty] of matchedTotals) {
        const ok = await merch.incrementVariantStock(variantId, qty, 'scan_intake');
        if (ok !== null) restocked++;
      }
      for (const g of newVariantGroups.values()) {
        const added = await merch.addVariants(g.product_id, [
          { variant_type: g.size ? 'size' : 'style', size: g.size, variant_label: g.label, sku: null, stock: g.qty, par_level: 0 },
        ]);
        if (added.length) createdVariants++;
      }
      for (const line of newProducts) {
        const wantSize = line.new_size ?? null;
        const id = await merch.createProductWithVariants(
          { name: line.description },
          [{ variant_type: wantSize ? 'size' : 'style', size: wantSize, variant_label: wantSize ? null : line.size || 'Default', sku: null, stock: line.quantity, par_level: 0 }]
        );
        if (id) createdProducts++;
      }

      const parts: string[] = [];
      if (restocked) parts.push(`${restocked} restocked`);
      if (createdVariants) parts.push(`${createdVariants} new sizes`);
      if (createdProducts) parts.push(`${createdProducts} new products`);
      if (skipped) parts.push(`${skipped} skipped`);
      toast.success(`Intake done: ${parts.join(', ') || 'no changes'}`);

      setState('done');
      return true;
    } catch (err) {
      console.error('[merch confirmIntake]', err);
      toast.error('Failed to process intake. Please try again.');
      setState('reviewing');
      return false;
    }
  }, [result, merch]);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
  }, []);

  return {
    state,
    result,
    error,
    startScan,
    updateItem,
    updateSupplier,
    confirmIntake,
    reset,
  };
}

export type UseMerchScanner = ReturnType<typeof useMerchScanner>;
