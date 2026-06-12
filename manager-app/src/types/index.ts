// ── Menu table types (mirrored from react-app) ──

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
  'description ': string | null; // trailing space matches Supabase column
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

// ── Events & Specials ──

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
  category: string | null;
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
}

// ── Canvas Editor types ──

export interface ImageFilters {
  brightness: number;   // 0-200, default 100
  contrast: number;     // 0-200, default 100
  saturation: number;   // 0-200, default 100
  blur: number;         // 0-20, default 0
  overlayColor: string; // rgba color for overlay
  overlayOpacity: number; // 0-1
  preset: string | null;  // name of active preset or null
}

export const DEFAULT_IMAGE_FILTERS: ImageFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  overlayColor: '#000000',
  overlayOpacity: 0,
  preset: null,
};

export interface TextLayer {
  id: string;
  elementType?: 'text' | 'divider' | 'image' | 'video'; // default 'text'
  text: string;
  x: number;
  y: number;
  width: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number; // 300-700, default 400
  fill: string;
  fontStyle: string; // 'normal', 'bold', 'italic', 'bold italic'
  textDecoration: string; // '' or 'underline'
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number; // unitless multiplier, default 1.3
  rotation: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  // Divider-specific fields (used when elementType === 'divider')
  dividerLabel?: string;        // Centered text between lines (e.g. "DRINKS")
  dividerLineColor?: string;    // Line color, default teal
  dividerLineOpacity?: number;  // 0-1, default 0.4
  dividerLineThickness?: number; // px, default 1
  dividerPadding?: number;       // Horizontal padding from edges, default 40
  dividerGap?: number;           // Gap between label and lines, default 16
  // Image-specific fields (used when elementType === 'image')
  imageSrc?: string;             // URL or data URL of the image
  imageHeight?: number;          // Explicit height (images have height, text doesn't)
  imageFilters?: ImageFilters;   // Per-layer image filters
  imageFit?: 'cover' | 'contain' | 'fill'; // How image fills its bounds
  imageCrop?: { top: number; right: number; bottom: number; left: number }; // CSS inset() percentages (0-100)
  blendMode?: string; // CSS mix-blend-mode (screen, multiply, overlay, etc.)
  // Video-specific fields (used when elementType === 'video')
  videoSrc?: string;             // URL, blob URL, or idb:// reference
  videoPosterSrc?: string;       // First frame as JPEG data URL (for thumbnails/layer panel)
  videoDuration?: number;        // Duration in seconds
  videoMuted?: boolean;          // Default true
  videoLoop?: boolean;           // Default true
}

export interface EditorState {
  backgroundImage: string | null;
  backgroundColor: string;
  backgroundGradient?: string;  // CSS gradient string, e.g. 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
  backgroundOverlay?: string;   // CSS color for darkening overlay, e.g. 'rgba(0,0,0,0.4)'
  imageFilters: ImageFilters;
  layers: TextLayer[];
  selectedLayerId: string | null;
  canvasWidth: number;
  canvasHeight: number;
}

export interface SpecialTemplate {
  id: string;
  name: string;
  category: string;
  backgroundColor: string;
  backgroundGradient?: string;
  canvasWidth: number;
  canvasHeight: number;
  defaultLayers: Omit<TextLayer, 'id'>[];
}

export interface UserTemplate {
  id: number;
  created_at: string;
  name: string;
  category: string;
  canvas_width: number;
  canvas_height: number;
  background_color: string;
  background_gradient: string | null;
  layers: Omit<TextLayer, 'id'>[];
  thumbnail_url: string | null;
}

// ── Media Library ──

export interface MediaItem {
  name: string;
  folder: string;
  url: string;
  created_at: string | null;
  size: number;
}

// ── Draft Persistence ──

export interface DraftState {
  editorState: EditorState;
  saveForm: {
    title: string;
    description: string;
    type: 'drink' | 'food' | 'seasonal';
    price: string;
  };
  updatedAt: string;
  specialId?: number;
}

// ── Filter Presets ──

export interface FilterPreset {
  id: string;
  name: string;
  filters: Partial<ImageFilters>;
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'none', name: 'Original', filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, overlayOpacity: 0, preset: null } },
  { id: 'moody', name: 'Moody', filters: { brightness: 80, contrast: 130, saturation: 60, blur: 0, overlayColor: '#1a1a2e', overlayOpacity: 0.2, preset: 'moody' } },
  { id: 'warm', name: 'Warm', filters: { brightness: 110, contrast: 105, saturation: 120, blur: 0, overlayColor: '#f59e0b', overlayOpacity: 0.1, preset: 'warm' } },
  { id: 'neon', name: 'Neon', filters: { brightness: 105, contrast: 140, saturation: 160, blur: 0, overlayColor: '#2dd4bf', overlayOpacity: 0.05, preset: 'neon' } },
  { id: 'vintage', name: 'Vintage', filters: { brightness: 95, contrast: 90, saturation: 50, blur: 0, overlayColor: '#92400e', overlayOpacity: 0.15, preset: 'vintage' } },
  { id: 'clean', name: 'Clean', filters: { brightness: 115, contrast: 110, saturation: 105, blur: 0, overlayOpacity: 0, preset: 'clean' } },
  { id: 'dark-overlay', name: 'Dark', filters: { brightness: 90, contrast: 110, saturation: 80, blur: 0, overlayColor: '#000000', overlayOpacity: 0.4, preset: 'dark-overlay' } },
  { id: 'dreamy', name: 'Dreamy', filters: { brightness: 110, contrast: 90, saturation: 110, blur: 1, overlayColor: '#8b5cf6', overlayOpacity: 0.08, preset: 'dreamy' } },
];

// ── Menu schema config ──

export interface ColumnConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  options?: string[];
  dynamicOptionsTable?: string;
  dynamicOptionsLabel?: string;
  required?: boolean;
}

// ── Food Menu (Supabase tables) ──

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
}

export interface FoodItemOption {
  id: number;
  created_at: string;
  item_id: number;
  label: string;
  price: string;
  sort_order: number;
}

export interface TableSchema {
  table: string;
  label: string;
  columns: ColumnConfig[];
}

export const EVENT_CATEGORIES = [
  'DJ Night',
  'Live Music',
  'Private Party',
  'Holiday Party',
  'Karaoke',
  'Trivia Night',
  'Themed Night',
] as const;

export const MENU_SCHEMAS: TableSchema[] = [
  {
    table: 'appetizers',
    label: 'Appetizers',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'price', label: 'Price', type: 'text', required: true },
    ],
  },
  {
    table: 'on_tap',
    label: 'On Tap',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'abv', label: 'ABV', type: 'text' },
      { key: 'price', label: 'Price', type: 'text', required: true },
      { key: 'brewery', label: 'Brewery', type: 'text', required: true },
    ],
  },
  {
    table: 'off_tap',
    label: 'Bottles & Cans',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'text', required: true },
      { key: 'description ', label: 'Description', type: 'textarea' },
      { key: 'abv', label: 'ABV', type: 'text' },
      { key: 'price', label: 'Price', type: 'text', required: true },
    ],
  },
  {
    table: 'cocktails',
    label: 'Cocktails',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'ingredients', label: 'Ingredients', type: 'textarea', required: true },
      { key: 'price', label: 'Price', type: 'text', required: true },
    ],
  },
  {
    table: 'shots',
    label: 'Shots',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'ingredients', label: 'Ingredients', type: 'textarea', required: true },
      { key: 'price', label: 'Price', type: 'text', required: true },
    ],
  },
  {
    table: 'happy_hour',
    label: 'Happy Hour',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'price', label: 'Price', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'select', options: ['drink', 'food', 'app'], required: true },
    ],
  },
  {
    table: 'menu_categories',
    label: 'Food Categories',
    columns: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'eyebrow', label: 'Eyebrow', type: 'text', required: true },
      { key: 'note', label: 'Note', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number', required: true },
      { key: 'menu_type', label: 'Menu Type', type: 'select', options: ['dinner', 'lunch', 'both'], required: true },
    ],
  },
  {
    table: 'menu_items',
    label: 'Food Items',
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'price', label: 'Price', type: 'text' },
      { key: 'category_id', label: 'Category', type: 'select', dynamicOptionsTable: 'menu_categories', dynamicOptionsLabel: 'title', required: true },
      { key: 'sort_order', label: 'Sort Order', type: 'number', required: true },
    ],
  },
  {
    table: 'menu_item_options',
    label: 'Item Options',
    columns: [
      { key: 'item_id', label: 'Item', type: 'select', dynamicOptionsTable: 'menu_items', dynamicOptionsLabel: 'name', required: true },
      { key: 'label', label: 'Label', type: 'text', required: true },
      { key: 'price', label: 'Price', type: 'text', required: true },
      { key: 'sort_order', label: 'Sort Order', type: 'number', required: true },
    ],
  },
];

export const EDITOR_FONTS = [
  'Inter',
  'Playfair Display',
  'Lobster',
  'Bebas Neue',
  'Oswald',
  'Pacifico',
  'Montserrat',
  'Raleway',
  'Poppins',
  'Anton',
] as const;

export const BRAND_COLORS = [
  '#2dd4bf', // Iggy's teal
  '#f59e0b', // Iggy's amber
  '#ffffff',
  '#000000',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#3b82f6',
  '#22c55e',
] as const;

// ── Inventory ──

export interface InventoryCategory {
  id: number;
  created_at: string;
  name: string;
  sort_order: number;
}

export interface InventoryItem {
  id: number;
  created_at: string;
  name: string;
  category_id: number | null;
  current_quantity: number;
  unit: string;
  par_level: number;
  cost_per_unit: number | null;
  supplier: string | null;
  notes: string | null;
  active: boolean;
  // Joined field
  inventory_categories?: { name: string } | null;
}

export interface InventoryLog {
  id: number;
  created_at: string;
  item_id: number;
  user_email: string;
  previous_quantity: number;
  new_quantity: number;
  change_amount: number;
  reason: string | null;
}

export const INVENTORY_UNITS = ['units', 'bottles', 'cases', 'lbs', 'oz', 'kegs', 'bags', 'cans'] as const;
export const LOG_REASONS = ['restock', 'usage', 'waste', 'count_adjustment', 'order_scan'] as const;

// ── Messages / Inbox ──

export interface Message {
  id: number;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  replied_at: string | null;
  reply_text: string | null;
  replied_by: string | null;
  notes: string | null;
}

export const MESSAGE_STATUSES = ['unread', 'read', 'replied', 'archived'] as const;

// ── Order Scanner ──

export interface ScannedLineItem {
  description: string;
  quantity: number;
  size: string;
  sku?: string;
  matched_item_id?: number;
  match_confidence?: number;
  proposed_name?: string;
  status: 'matched' | 'new' | 'skipped' | 'unreadable';
}

export interface Order {
  id: number;
  created_at: string;
  supplier: string | null;
  order_number: string | null;
  image_url: string;
  items: ScannedLineItem[];
  notes: string | null;
  scanned_by: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

// ── Private Events / Parties ──

export const PARTY_STATUSES = ['inquiry', 'confirmed', 'cancelled'] as const;
export type PartyStatus = (typeof PARTY_STATUSES)[number];

export const PARTY_STATUS_LABELS: Record<PartyStatus, string> = {
  inquiry: 'Request',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

export const PARTY_SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  email: 'Email',
  phone: 'Phone',
  in_person: 'In person',
  manual: 'Added manually',
};

export const FOOD_SERVICE_TYPES = [
  'Order as you go',
  'Buffet',
  'Limited menu',
  'Appetizers on arrival',
  'No food service',
] as const;

export interface Contact {
  id: number;
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  tags: string[] | null;
  marketing_opt_in: boolean;
  notes: string | null;
  last_event_date: string | null;
}

export interface Party {
  id: number;
  created_at: string;
  updated_at: string;
  status: PartyStatus;
  contact_id: number | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  title: string | null;
  is_private: boolean;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  start_min: number | null;
  end_min: number | null;
  all_day: boolean;
  setup_time: string | null;
  guest_count: number | null;
  space_name: string | null;
  space: string | null;
  food_service_type: string | null;
  food_notes: string | null;
  drink_notes: string | null;
  special_requests: string | null;
  internal_notes: string | null;
  follow_up_notes: string | null;
  last_contacted_at: string | null;
  follow_up_date: string | null;
  room_rate: number | null;
  room_hours: number | null;
  food_total: number | null;
  drink_total: number | null;
  gratuity_rate: number | null;
  google_calendar_event_id: string | null;
  confirmation_sent_at: string | null;
  cancelled_at: string | null;
  source: string | null;
  // joined when loaded via PartyProfile
  party_packages?: PartyPackage[];
}

// ── Packages (party offerings catalog) ──

export const PACKAGE_CATEGORIES = ['food', 'drink', 'room', 'addon', 'other'] as const;
export type PackageCategory = (typeof PACKAGE_CATEGORIES)[number];

export const PACKAGE_UNITS = ['flat', 'per_person', 'per_hour'] as const;
export type PackageUnit = (typeof PACKAGE_UNITS)[number];

export const PACKAGE_UNIT_LABELS: Record<PackageUnit, string> = {
  flat: 'flat',
  per_person: 'per person',
  per_hour: 'per hour',
};

export interface Package {
  id: number;
  created_at: string;
  name: string;
  description: string | null;
  category: PackageCategory;
  price: number;
  unit: PackageUnit;
  active: boolean;
  sort_order: number;
}

export interface PartyPackage {
  id: number;
  created_at: string;
  party_id: number;
  package_id: number | null;
  name: string;
  category: PackageCategory;
  unit: PackageUnit;
  quantity: number;
  unit_price: number;
  notes: string | null;
}

// ── Todos (owner ↔ manager board) ──

export const TODO_PRIORITIES = ['low', 'normal', 'high'] as const;
export type TodoPriority = (typeof TODO_PRIORITIES)[number];

export interface Todo {
  id: number;
  created_at: string;
  title: string;
  details: string | null;
  done: boolean;
  priority: TodoPriority;
  due_date: string | null;
  created_by: string | null;
  completed_at: string | null;
}

// ── Message Templates (prewritten responses) ──

export const TEMPLATE_CATEGORIES = ['follow_up', 'confirmation', 'cancellation', 'general'] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  follow_up: 'Follow-up',
  confirmation: 'Confirmation',
  cancellation: 'Cancellation',
  general: 'General',
};

export interface MessageTemplate {
  id: number;
  created_at: string;
  name: string;
  category: TemplateCategory;
  subject: string | null;
  body: string;
}

// ── Luna (AI assistant) ──

export const LUNA_MESSAGE_STATUSES = ['pending', 'processing', 'answered', 'error'] as const;
export type LunaMessageStatus = (typeof LUNA_MESSAGE_STATUSES)[number];

export interface LunaMessage {
  id: number;
  created_at: string;
  role: 'user' | 'luna';
  content: string;
  status: LunaMessageStatus;
  reply_to: number | null;
  author_email: string | null;
  error: string | null;
}

export const LUNA_INSIGHT_KINDS = ['briefing', 'alert', 'suggestion', 'note'] as const;
export type LunaInsightKind = (typeof LUNA_INSIGHT_KINDS)[number];

export const LUNA_INSIGHT_KIND_LABELS: Record<LunaInsightKind, string> = {
  briefing: 'Briefing',
  alert: 'Alert',
  suggestion: 'Suggestion',
  note: 'Note',
};

export interface LunaInsight {
  id: number;
  created_at: string;
  kind: LunaInsightKind;
  title: string;
  body: string;
  status: 'new' | 'seen' | 'dismissed';
  data: Record<string, unknown> | null;
}
