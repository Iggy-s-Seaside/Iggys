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
  starts_at: string | null;
  expires_at: string | null;
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
    starts_at: string;
    expires_at: string;
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
  /** 'contact_form' (website) or 'gmail' (synced from the inbox). */
  source?: string | null;
  /** Gmail message id when source='gmail'; dedupe key. */
  gmail_id?: string | null;
  /** Gmail thread id, for showing the full conversation. */
  gmail_thread_id?: string | null;
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

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = { unpaid: 'Owed', partial: 'Partial', paid: 'Paid' };

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
  run_of_show: { time: string; label: string }[] | null;
  follow_up_notes: string | null;
  last_contacted_at: string | null;
  follow_up_date: string | null;
  room_rate: number | null;
  room_hours: number | null;
  food_total: number | null;
  drink_total: number | null;
  gratuity_rate: number | null;
  deposit_amount: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  payment_status: PaymentStatus | null;
  paid_at: string | null;
  deposit_due_date: string | null;
  payment_intent_id: string | null;
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

// ── Luna insight actions (the `data` JSONB contract) ──
// Luna writes a finished draft + a one-tap action into luna_insights.data; the
// app renders a deep-link + Approve button and the human always triggers the act.
// Luna's own write surface stays least-privilege (she only touches the two Luna
// tables) — the app performs the real action under the manager's session.

export type InsightActionType =
  | 'navigate'      // just route to the relevant record
  | 'party_email'   // drafted follow-up/confirmation → PartyProfile
  | 'draft_special' // drafted special copy/layers → SpecialEditor
  | 'draft_po'      // drafted reorder → Inventory
  | 'draft_reply'   // drafted inbox reply → Messages
  | 'review_reply'  // drafted review reply → Reputation (future)
  | 'add_todo';     // suggested task → Todos

export interface InsightAction {
  type: InsightActionType;
  label?: string;                    // button label override
  deep_link?: string;                // route to open, e.g. "/parties/12"
  draft?: string;                    // ready-to-use text (email body, caption, PO, reply)
  payload?: Record<string, unknown>; // structured fields to pre-fill the target flow
}

export interface InsightData {
  deep_link?: string;
  sources?: string[];                // ["parties#12", "Tito's (inventory)"]
  action?: InsightAction;
  [key: string]: unknown;
}

export const INSIGHT_ACTION_DEFAULT_LABELS: Record<InsightActionType, string> = {
  navigate: 'Open',
  party_email: 'Review & send',
  draft_special: 'Open in Specials',
  draft_po: 'Review reorder',
  draft_reply: 'Review reply',
  review_reply: 'Review reply',
  add_todo: 'Add to-do',
};

/** Safely read the typed action/sources off an insight's free-form `data` JSONB. */
export function parseInsightData(data: Record<string, unknown> | null | undefined): InsightData {
  return (data && typeof data === 'object' ? data : {}) as InsightData;
}

/** Router-state shape a target page can read to pre-fill a Luna-drafted action. */
export interface LunaActionState {
  lunaDraft?: string;
  lunaPayload?: Record<string, unknown>;
  fromInsight?: number;
}

// ── Commerce / Stripe checkout rail ──
// Backs the merch storefront, private-party deposits, and gift cards through one
// Stripe Checkout rail. See scripts/add-commerce-tables.sql for the source schema.

/** Catalog row the website storefront sells. Price is the trusted server-side source. */
export interface MerchProductRow {
  id: string;                  // stable slug ("iggys-tee")
  created_at: string;
  name: string;
  description: string | null;
  price: number;               // USD; ×100 for Stripe unit_amount
  image: string | null;
  sizes: string[];
  sku: string | null;
  inventory: number | null;    // null = unlimited / not tracked
  active: boolean;
  sort_order: number;
}

export const ORDER_STATUSES = ['paid', 'refunded', 'partially_refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** One completed Stripe Checkout for merch. Written by the stripe-webhook function. */
export interface CustomerOrder {
  id: number;
  created_at: string;
  stripe_session_id: string | null;
  stripe_event_id: string | null;
  payment_intent_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  amount_total: number;
  currency: string;
  status: OrderStatus;
  amount_refunded: number;
  shipping: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  // joined when loaded with line items
  order_items?: OrderItem[];
}

/** Line item for a customer_order (price snapshot at purchase). */
export interface OrderItem {
  id: number;
  created_at: string;
  order_id: number;
  product_id: string | null;
  name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
}

export const GIFT_CARD_STATUSES = ['pending', 'active', 'redeemed', 'void'] as const;
export type GiftCardStatus = (typeof GIFT_CARD_STATUSES)[number];

/** A sold gift card, activated on payment. Balance decremented via transactions. */
export interface GiftCard {
  id: number;
  created_at: string;
  code: string;
  initial_amount: number;
  balance: number;
  currency: string;
  status: GiftCardStatus;
  purchaser_email: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  message: string | null;
  stripe_session_id: string | null;
  payment_intent_id: string | null;
  activated_at: string | null;
}

export const GIFT_CARD_TX_TYPES = ['activate', 'redeem', 'adjust', 'refund'] as const;
export type GiftCardTransactionType = (typeof GIFT_CARD_TX_TYPES)[number];

/** Ledger of gift-card activations/redemptions/adjustments. */
export interface GiftCardTransaction {
  id: number;
  created_at: string;
  gift_card_id: number;
  type: GiftCardTransactionType;
  amount: number;          // positive adds, negative spends
  balance_after: number;
  note: string | null;
  performed_by: string | null;
}

// ── Shift Cockpit (Wave 3) ──
// The shift spine: one shift_sessions row is one open->close bar shift. Every
// other shift reading (checklists, line checks, the log, the cash close) carries
// a nullable shift_id pointing back here. See scripts/add-shift-*.sql.

export const SHIFT_STATUSES = ['open', 'closed'] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

/** One open->close bar shift. NOTE: opened_at is the clock — there is no created_at. */
export interface ShiftSession {
  id: number;
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  status: ShiftStatus;
  notes: string | null;
  /** Service day (YYYY-MM-DD), 9am Pacific cutoff. Drives checklist/log day resolution. */
  business_day: string | null;
}

// ── Checklists (opening / closing / safety, photo-proof items) ──

export const CHECKLIST_KINDS = ['opening', 'closing', 'safety'] as const;
export type ChecklistKind = (typeof CHECKLIST_KINDS)[number];

export interface ChecklistTemplate {
  id: number;
  created_at: string;
  name: string;
  kind: ChecklistKind;
  sort_order: number;
  active: boolean;
}

export interface ChecklistTemplateItem {
  id: number;
  created_at: string;
  template_id: number;
  label: string;
  requires_photo: boolean;
  sort_order: number;
}

/** One walk-through of a checklist template during a shift. */
export interface ChecklistRun {
  id: number;
  created_at: string;
  shift_id: number | null;
  template_id: number;
  completed_by: string | null;
  completed_at: string | null;
}

export interface ChecklistRunItem {
  id: number;
  created_at: string;
  run_id: number;
  item_id: number;
  checked: boolean;
  photo_url: string | null;
  note: string | null;
  checked_at: string | null;
}

// ── Line check (numeric readings against a safe range) ──

export interface LineCheckTemplate {
  id: number;
  created_at: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface LineCheckTemplateItem {
  id: number;
  created_at: string;
  template_id: number;
  label: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  sort_order: number;
}

export interface LineCheckRun {
  id: number;
  created_at: string;
  shift_id: number | null;
  completed_by: string | null;
}

export interface LineCheckReading {
  id: number;
  created_at: string;
  run_id: number;
  item_id: number;
  value: number | null;
  in_range: boolean | null;
  note: string | null;
}

// ── Shift Log / mod journal (tagged, searchable floor record) ──

export const SHIFT_LOG_TAGS = ['86', 'incident', 'vip', 'maintenance', 'note'] as const;
export type ShiftLogTag = (typeof SHIFT_LOG_TAGS)[number];

export interface ShiftLogEntry {
  id: number;
  created_at: string;
  shift_id: number | null;
  author: string | null;
  tag: ShiftLogTag;
  body: string;
  item_ref: string | null;
  photo_url: string | null;
  resolved: boolean;
}

// ── Close-out (cash reconciliation + End-of-Night report) ──

/** One till count at close: counted - expected = over/short (all in cents). */
export interface CashCount {
  id: number;
  created_at: string;
  shift_id: number | null;
  counted_by: string | null;
  expected_cents: number;
  counted_cents: number;
  over_short_cents: number;            // counted - expected: + = over, - = short
  denominations: Record<string, number>; // { cents_denom: count }
  note: string | null;
}

/** One composed End-of-Night report per close (server-composed, emailed). */
export interface EonReport {
  id: number;
  created_at: string;
  shift_id: number | null;
  generated_by: string | null;
  summary: string;
  metrics: Record<string, unknown>;
  emailed_at: string | null;
}

// ── Reputation (Wave 4) ──
// Reviews inbox (external platforms) + table-side feedback QR.
// See scripts/add-reviews.sql for the source schema.

/** A platform we ingest reviews from / link out to (review_sources lookup). */
export interface ReviewSource {
  id: number;
  created_at: string;
  key: string;                 // 'google' | 'yelp' | 'facebook' | 'manual'
  label: string;
  review_url: string | null;   // public "write a review" deep link
  active: boolean;
}

/** One public review ingested from an external platform. */
export interface Review {
  id: number;
  created_at: string;
  source: string;              // review_sources.key
  author: string | null;
  rating: number;              // 1–5
  body: string | null;
  url: string | null;          // deep link back to the review
  replied: boolean;
  reply_text: string | null;
  sentiment: string | null;    // 'positive' | 'neutral' | 'negative'
  external_id: string | null;  // platform review id (dedupe)
}

/** Private table-side feedback from the /feedback QR page. */
export interface Feedback {
  id: number;
  created_at: string;
  area: string | null;         // 'food' | 'drinks' | 'service' | 'atmosphere' | 'other'
  rating: number | null;       // 1–5 (nullable)
  comment: string | null;
  contact_email: string | null;
  public_review_clicked: boolean;
}

// ── Marketing / CRM + Campaigns (Wave 4) ──
// See scripts/add-marketing.sql for the source schema.

export const CAMPAIGN_CHANNELS = ['email', 'sms'] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'cancelled'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  cancelled: 'Cancelled',
};

/** Per-channel consent (the gate reads sms_opt_in / email_opt_in). */
export type ConsentChannel = 'sms' | 'email';
export type ConsentSource = 'manager' | 'website' | 'sms_keyword' | 'import' | 'webhook';

/** The CRM contact, enriched with the marketing columns add-marketing.sql adds. */
export interface MarketingContact {
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
  // marketing enrichment + per-channel consent
  first_seen: string | null;
  last_visit: string | null;
  visit_count: number | null;
  total_spend: number | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  birthday_month: number | null;   // 1–12 (null = unknown)
  normalized_phone: string | null; // E.164, SMS dedupe key
}

/** A small JSON predicate the marketing UI evaluates client-side (segments.rule). */
export interface SegmentRule {
  type: 'all' | 'sms_opted_in' | 'email_opted_in' | 'birthday_this_month' | 'lapsed';
  days?: number;
}

/** One email/SMS blast (draft → scheduled → sending → sent). */
export interface Campaign {
  id: number;
  created_at: string;
  name: string;
  channel: CampaignChannel;
  subject: string | null;       // email only
  body: string;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_count: number;
}

// ── Labor / Scheduling (Wave 4) ──
// See scripts/add-labor.sql. Times are integer minutes-from-midnight.

/** A roster member. wage is dollars/hour; certs is a string array. */
export interface Staff {
  id: number;
  created_at: string;
  name: string;
  email: string | null;
  role: string;                 // 'bartender' | 'server' | 'barback' | 'kitchen' | 'manager'
  wage: number;
  certs: string[];
  active: boolean;
}

/** One assigned shift on the schedule grid (draft until published). */
export interface Shift {
  id: number;
  created_at: string;
  staff_id: number;
  date: string;                 // 'yyyy-MM-dd'
  start_min: number;            // minutes from midnight
  end_min: number;
  role: string | null;
  published: boolean;
}

/** A date-range PTO request. */
export interface TimeOffRequest {
  id: number;
  created_at: string;
  staff_id: number;
  date_from: string;            // inclusive DATE
  date_to: string;
  status: 'pending' | 'approved' | 'denied';
  reason: string | null;
}

/** A saved tip-pool run for a date (total + method + allocations snapshot). */
export interface TipPool {
  id: number;
  created_at: string;
  date: string;
  total_cents: number;
  method: string;               // 'hours' | 'even' | 'points'
  allocations: { staff_id: number; name: string; hours: number; share_cents: number }[];
}
