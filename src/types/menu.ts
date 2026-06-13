export interface Appetizer {
  id: number;
  created_at: string;
  name: string;
  description: string | null;
  price: string;
}

export interface OnTapBeer {
  id: number;
  created_at: string;
  name: string;
  type: string;
  description: string | null;
  abv: string;
  price: string;
  brewery: string;
}

export interface OffTapBeer {
  id: number;
  created_at: string;
  name: string;
  type: string;
  price: string;
  'description ': string | null;
  abv: string | null;
}

export interface Cocktail {
  id: number;
  created_at: string;
  name: string;
  ingredients: string;
  price: string;
}

export interface Shot {
  id: number;
  created_at: string;
  name: string;
  ingredients: string;
  price: string;
}

export interface HappyHourItem {
  id: number;
  created_at: string;
  name: string;
  description: string;
  price: string;
  type: 'drink' | 'food' | 'app';
}

export interface IggyEvent {
  id: number;
  created_at: string;
  title: string;
  description: string;
  date: string;
  time: string;
  image_url: string | null;
  is_recurring: boolean;
  recurring_day: string | null;
  active: boolean;
  start_min: number | null;
  end_min: number | null;
  all_day: boolean;
  space: string | null;
}

export interface Special {
  id: number;
  created_at: string;
  title: string;
  description: string;
  type: 'drink' | 'food' | 'seasonal';
  price: string | null;
  image_url: string | null;
  active: boolean;
  starts_at: string | null;
  expires_at: string | null;
}

export interface FoodCategory {
  id: number;
  created_at: string;
  title: string;
  eyebrow: string;
  note: string | null;
  sort_order: number;
  menu_type: 'dinner' | 'lunch' | 'both';
}

export interface FoodItem {
  id: number;
  created_at: string;
  category_id: number;
  name: string;
  description: string | null;
  price: string | null;
  sort_order: number;
  menu_item_options?: FoodItemOption[];
}

export interface FoodItemOption {
  id: number;
  created_at: string;
  item_id: number;
  label: string;
  price: string;
  sort_order: number;
}
