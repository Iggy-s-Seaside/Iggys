import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useImageUpload } from './useImageUpload';
import { adjustQuantity } from './useInventory';
import toast from 'react-hot-toast';
import type { InventoryItem, ScannedLineItem } from '../types';

export type ScanState = 'idle' | 'uploading' | 'scanning' | 'reviewing' | 'confirming' | 'done' | 'error';

interface ScanResult {
  supplier: string | null;
  orderNumber: string | null;
  items: ScannedLineItem[];
  imageUrl: string;
  rawText?: string;
}

// ── Fuzzy matching ──

/** Jaccard token similarity — simple word overlap score (0-1). */
function fuzzyScore(needle: string, haystack: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/['']/g, '').split(/\s+/).filter(t => t.length > 1);

  const tokensA = new Set(normalize(needle));
  const tokensB = new Set(normalize(haystack));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;

  return intersection / union;
}

/** Match a scanned line item to the closest inventory item. */
function matchToInventory(
  item: { description: string; quantity: number; size: string; sku?: string },
  inventory: InventoryItem[]
): ScannedLineItem {
  let bestScore = 0;
  let bestMatch: InventoryItem | null = null;

  for (const inv of inventory) {
    const score = fuzzyScore(item.description, inv.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = inv;
    }
  }

  if (bestScore >= 0.4 && bestMatch) {
    return {
      ...item,
      matched_item_id: bestMatch.id,
      match_confidence: bestScore,
      proposed_name: bestMatch.name,
      status: 'matched',
    };
  }

  return {
    ...item,
    status: item.quantity > 0 ? 'new' : 'unreadable',
  };
}

// ── Hook ──

export function useOrderScanner(inventoryItems: InventoryItem[]) {
  const { user } = useAuth();
  const { upload } = useImageUpload();
  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startScan = useCallback(async (file: File) => {
    setError(null);

    // Upload image
    setState('uploading');
    const imageUrl = await upload(file, 'order-scans');
    if (!imageUrl) {
      setState('error');
      setError('Failed to upload image');
      return;
    }

    // Call scan-order edge function
    setState('scanning');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('scan-order', {
        body: { imageUrl },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const scannedItems: ScannedLineItem[] = (data.items || []).map(
        (item: { description: string; quantity: number; size: string; sku?: string }) =>
          matchToInventory(item, inventoryItems)
      );

      setResult({
        supplier: data.supplier,
        orderNumber: data.orderNumber,
        items: scannedItems,
        imageUrl,
        rawText: data.rawText,
      });
      setState('reviewing');
    } catch (err) {
      console.error('[scan-order]', err);
      setError(err instanceof Error ? err.message : 'Scan failed');
      setState('error');
      // Still set imageUrl so they can retry
      setResult((r) => r ? { ...r, imageUrl } : { supplier: null, orderNumber: null, items: [], imageUrl });
    }
  }, [upload, inventoryItems]);

  const updateItem = useCallback((index: number, changes: Partial<ScannedLineItem>) => {
    setResult((prev) => {
      if (!prev) return prev;
      const updated = [...prev.items];
      updated[index] = { ...updated[index], ...changes };
      return { ...prev, items: updated };
    });
  }, []);

  const updateSupplier = useCallback((supplier: string) => {
    setResult((prev) => prev ? { ...prev, supplier } : prev);
  }, []);

  const confirmOrder = useCallback(async () => {
    if (!result || !user?.email) return false;

    setState('confirming');
    const userEmail = user.email;

    try {
      let restocked = 0;
      let created = 0;
      let skipped = 0;

      for (const item of result.items) {
        if (item.status === 'skipped' || item.status === 'unreadable') {
          skipped++;
          continue;
        }

        if (item.status === 'matched' && item.matched_item_id) {
          // Restock existing item
          const existing = inventoryItems.find((i) => i.id === item.matched_item_id);
          if (existing) {
            const newQty = existing.current_quantity + item.quantity;
            await adjustQuantity(existing.id, existing.current_quantity, newQty, 'order_scan', userEmail);
            restocked++;
          }
        } else if (item.status === 'new') {
          // Create new inventory item
          const { error: createErr } = await supabase.from('inventory_items').insert({
            name: item.description,
            current_quantity: item.quantity,
            unit: 'bottles',
            par_level: item.quantity, // Default par to initial quantity
            supplier: result.supplier,
            active: true,
          });
          if (createErr) {
            console.error(`Failed to create "${item.description}":`, createErr.message);
          } else {
            created++;
          }
        }
      }

      // Save order record
      await supabase.from('orders').insert({
        supplier: result.supplier,
        order_number: result.orderNumber,
        image_url: result.imageUrl,
        items: result.items,
        scanned_by: userEmail,
        status: 'confirmed',
      });

      const parts: string[] = [];
      if (restocked > 0) parts.push(`${restocked} restocked`);
      if (created > 0) parts.push(`${created} new items`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      toast.success(`Order confirmed: ${parts.join(', ')}`);

      setState('done');
      return true;
    } catch (err) {
      console.error('[confirmOrder]', err);
      toast.error('Failed to process order. Please try again.');
      setState('reviewing');
      return false;
    }
  }, [result, user, inventoryItems]);

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
    confirmOrder,
    reset,
  };
}
