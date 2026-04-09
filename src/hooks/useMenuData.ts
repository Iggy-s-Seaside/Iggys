import { useEffect, useState } from 'react';
import { useSupabaseQuery } from './useSupabase';
import { supabase } from '../lib/supabase';
import type {
  Appetizer, OnTapBeer, OffTapBeer, Cocktail, Shot, HappyHourItem, IggyEvent, Special,
  FoodCategory, FoodItem, FoodItemOption,
} from '../types/menu';

export const useAppetizers = () => useSupabaseQuery<Appetizer>('appetizers');
export const useOnTap = () => useSupabaseQuery<OnTapBeer>('on_tap');
export const useOffTap = () => useSupabaseQuery<OffTapBeer>('off_tap');
export const useCocktails = () => useSupabaseQuery<Cocktail>('cocktails');
export const useShots = () => useSupabaseQuery<Shot>('shots');
export const useHappyHour = () => useSupabaseQuery<HappyHourItem>('happy_hour');
export const useEvents = () => useSupabaseQuery<IggyEvent>('events');
export const useSpecials = () => useSupabaseQuery<Special>('specials');

export interface MenuCategoryWithItems {
  title: string;
  eyebrow: string;
  note?: string;
  menu_type: 'dinner' | 'lunch' | 'both';
  items: {
    name: string;
    description?: string;
    price: string;
    options?: { label: string; price: string }[];
  }[];
}

export function useFoodMenu() {
  const [data, setData] = useState<MenuCategoryWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMenu() {
      setLoading(true);

      const [catRes, itemRes, optRes] = await Promise.all([
        supabase.from('menu_categories').select('*').order('sort_order'),
        supabase.from('menu_items').select('*').order('sort_order'),
        supabase.from('menu_item_options').select('*').order('sort_order'),
      ]);

      if (catRes.error || itemRes.error || optRes.error) {
        setError(catRes.error?.message || itemRes.error?.message || optRes.error?.message || 'Failed to load menu');
        setLoading(false);
        return;
      }

      const categories = catRes.data as FoodCategory[];
      const items = itemRes.data as FoodItem[];
      const options = optRes.data as FoodItemOption[];

      // Group options by item_id
      const optionsByItem = new Map<number, FoodItemOption[]>();
      for (const opt of options) {
        const arr = optionsByItem.get(opt.item_id) || [];
        arr.push(opt);
        optionsByItem.set(opt.item_id, arr);
      }

      // Group items by category_id
      const itemsByCategory = new Map<number, FoodItem[]>();
      for (const item of items) {
        const arr = itemsByCategory.get(item.category_id) || [];
        arr.push(item);
        itemsByCategory.set(item.category_id, arr);
      }

      // Assemble into final shape
      const result: MenuCategoryWithItems[] = categories.map((cat) => {
        const catItems = itemsByCategory.get(cat.id) || [];
        return {
          title: cat.title,
          eyebrow: cat.eyebrow,
          note: cat.note || undefined,
          menu_type: cat.menu_type,
          items: catItems.map((item) => {
            const itemOptions = optionsByItem.get(item.id);
            return {
              name: item.name,
              description: item.description || undefined,
              price: item.price || '',
              options: itemOptions?.map((o) => ({ label: o.label, price: o.price })),
            };
          }),
        };
      });

      setData(result);
      setLoading(false);
    }

    fetchMenu();
  }, []);

  return { data, loading, error };
}
