import { useSupabaseQuery } from './useSupabase';
import type { Appetizer, OnTapBeer, OffTapBeer, Cocktail, Shot, HappyHourItem, IggyEvent, Special } from '../types/menu';

export const useAppetizers = () => useSupabaseQuery<Appetizer>('appetizers');
export const useOnTap = () => useSupabaseQuery<OnTapBeer>('on_tap');
export const useOffTap = () => useSupabaseQuery<OffTapBeer>('off_tap');
export const useCocktails = () => useSupabaseQuery<Cocktail>('cocktails');
export const useShots = () => useSupabaseQuery<Shot>('shots');
export const useHappyHour = () => useSupabaseQuery<HappyHourItem>('happy_hour');
export const useEvents = () => useSupabaseQuery<IggyEvent>('events');
export const useSpecials = () => useSupabaseQuery<Special>('specials');
