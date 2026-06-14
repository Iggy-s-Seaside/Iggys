import {
  Hourglass,
  ClipboardCheck,
  Package,
  ClipboardList,
  Shirt,
  PartyPopper,
  Receipt,
  Sparkles,
  Share2,
  Star,
  Users,
  ShieldCheck,
  KeyRound,
  Smartphone,
  MessageSquare,
  Mail,
  Instagram,
  BarChart3,
  Moon,
  Settings,
  type LucideIcon,
} from 'lucide-react';

/**
 * In-app Help & Guide content.
 *
 * Two audiences:
 *   - "all"   → friendly, task-based how-tos. Shown to EVERYONE, including
 *               employees. Plain steps, warm tone — the thing a nervous new
 *               hire opens on their first shift.
 *   - "owner" → advanced setup / admin. Gated behind useRole().isOwner.
 *
 * Each topic is a small, skimmable card. `steps` renders as a numbered list;
 * `body` renders as paragraphs. `link` deep-links to the live page so the
 * reader can jump straight in.
 *
 * This is intentionally a flat, declarative array so it's trivial to extend:
 * add an object, pick a category, done.
 */

export type HelpAudience = 'all' | 'owner';

export type HelpCategory =
  | 'tonight'
  | 'stock'
  | 'events'
  | 'marketing'
  | 'admin'
  | 'connect';

export interface HelpTopic {
  /** Stable id (used as React key + deep-link anchor). */
  id: string;
  /** Card title — the task, phrased the way staff would say it. */
  title: string;
  /** One friendly line under the title. */
  summary: string;
  /** Who sees it. "owner" topics are gated behind isOwner. */
  audience: HelpAudience;
  category: HelpCategory;
  /** Lucide icon for the card. */
  icon: LucideIcon;
  /** Numbered, plain-language steps (the common case). */
  steps?: string[];
  /** Free-form paragraphs (used for the advanced/explainer topics). */
  body?: string[];
  /** Optional deep-link into the app. */
  link?: { to: string; label: string };
  /** Search keywords beyond the title/summary text. */
  keywords?: string[];
}

export interface HelpCategoryMeta {
  id: HelpCategory;
  label: string;
  audience: HelpAudience;
  icon: LucideIcon;
}

/** Category chips, in display order. "admin"/"connect" only matter for owners. */
export const HELP_CATEGORIES: HelpCategoryMeta[] = [
  { id: 'tonight', label: 'Tonight', audience: 'all', icon: ClipboardCheck },
  { id: 'stock', label: 'Stock & Merch', audience: 'all', icon: Package },
  { id: 'events', label: 'Parties & Invoices', audience: 'all', icon: PartyPopper },
  { id: 'marketing', label: 'Specials & Posts', audience: 'all', icon: Sparkles },
  { id: 'admin', label: 'Owner Admin', audience: 'owner', icon: ShieldCheck },
  { id: 'connect', label: 'Connect Services', audience: 'owner', icon: Settings },
];

export const HELP_TOPICS: HelpTopic[] = [
  // ───────────────────────────── TONIGHT (all roles) ─────────────────────────────
  {
    id: 'waitlist',
    title: 'Run the waitlist & text a guest when their table is ready',
    summary: 'We don’t take reservations — this is the live walk-up list at the host stand.',
    audience: 'all',
    category: 'tonight',
    icon: Hourglass,
    steps: [
      'Open Waitlist. Type the guest’s name, their phone (so we can text them), and bump the party size up or down.',
      'The app suggests a wait time automatically based on how many groups are ahead. Tell the guest that number and tap “Add to waitlist.”',
      'When a table frees up, find their card and tap Notify — that texts them “your table is ready.” (No phone on file? It just marks them as notified so the next host knows.)',
      'When you walk them to their table, tap Seat. Their card clears off the board.',
      'If they never showed, tap No-show. If you added them by mistake, tap Cancel.',
      'Big group (6+)? You’ll see a “Start a party” nudge — that turns them into a private-event lead without losing their spot.',
    ],
    link: { to: '/waitlist', label: 'Open Waitlist' },
    keywords: ['host', 'walk-in', 'walk up', 'table ready', 'notify', 'seat', 'reservation', 'wait quote', 'no show'],
  },
  {
    id: 'open-close-bar',
    title: 'Open & close the bar + run the checklists',
    summary: 'Start the shift, work through your checks, count the drawer at the end of the night.',
    audience: 'all',
    category: 'tonight',
    icon: ClipboardCheck,
    steps: [
      'Open Service. If the bar is closed you’ll see one big “Open the Bar” button — tap it. It drops you straight onto the opening checks.',
      'Work the Checklists & Line Check tile. Tap the big circle to check off each item; some items ask for a quick photo or a temperature — add it right there.',
      'Use the Shift Log tile for anything the next shift needs to know — incidents, 86’d items, who covered what.',
      'At the end of the night tap Cash & End-of-Night to count the drawer and close out.',
      'Tap “Close the Bar” when you’re done. The night is saved and shows up under Recent shifts.',
    ],
    body: [
      'Heads-up on timing: checklists roll over at 9am, not midnight. So a late close after midnight still counts toward the same business day — you won’t accidentally start tomorrow’s opening list at 1am.',
    ],
    link: { to: '/shift', label: 'Open Service' },
    keywords: ['shift', 'service', 'line check', 'opening', 'closing', 'safety', 'drawer', 'cash', 'checklist', '9am'],
  },

  // ───────────────────────────── STOCK & MERCH (all roles) ─────────────────────────────
  {
    id: 'mark-low-86',
    title: 'Mark something low or 86 it',
    summary: 'One tap when you notice you’re running out — no counting required.',
    audience: 'all',
    category: 'stock',
    icon: Package,
    steps: [
      'Open Inventory and find the item (search by name at the top, or pick a category).',
      'Tap the chip for what you see: Out (we’re 86’d), 1 left, or Low. The dot turns red or amber so everyone can see it at a glance.',
      'Anything flagged jumps to the “Needs attention” board at the top of the page, so the next person ordering knows.',
      'Once it’s restocked, tap “Mark OK” on that item and it drops off the board.',
    ],
    body: [
      'You don’t have to type a number to flag something — that’s what the chips are for. The exact recount happens later during a Count (see “Count stock”).',
    ],
    link: { to: '/inventory', label: 'Open Inventory' },
    keywords: ['86', 'eighty-six', 'out of stock', 'low stock', 'restock', 'mark ok', 'par', 'needs attention'],
  },
  {
    id: 'count-stock',
    title: 'Count stock',
    summary: 'The slow-time exact recount that reconciles what’s really on the shelf.',
    audience: 'all',
    category: 'stock',
    icon: ClipboardList,
    steps: [
      'Open Count Stock. Pick a category (or All) and tap Start — that snapshots the current numbers.',
      'Walk the list and enter the real counted quantity for each line. That’s the only thing you have to type per item.',
      'You can leave and come back — an open count is saved until you close it.',
      'When you’re done, tap Close count. You’ll get a summary (“apply N adjustments, $X variance?”) before anything is written.',
      'Confirm, and the counted numbers become the new stock levels — with each change logged.',
    ],
    link: { to: '/inventory/count', label: 'Open Count Stock' },
    keywords: ['count', 'recount', 'inventory count', 'variance', 'shrink', 'reconcile', 'par level'],
  },
  {
    id: 'merch',
    title: 'Add a merch type & count it',
    summary: 'Track shirts, hats and hoodies by size and style.',
    audience: 'all',
    category: 'stock',
    icon: Shirt,
    steps: [
      'Open Merch and tap “Add merch.” The wizard walks you through naming the item and adding its variants (sizes / colors).',
      'Back on the list, tap a product row to expand it — you’ll see a tile for each variant.',
      'Set or adjust the count right on each tile. Low variants are highlighted so they’re easy to spot.',
      'Got a delivery? Use Scan to snap the packing slip and let the app pull in the quantities for you to review.',
      'Tap the little history icon on a variant to see every change that’s been logged.',
    ],
    link: { to: '/merch', label: 'Open Merch' },
    keywords: ['merch', 'shirts', 'apparel', 'variants', 'sizes', 'scan', 'packing slip', 'sku'],
  },

  // ───────────────────────────── PARTIES & INVOICES (all roles) ─────────────────────────────
  {
    id: 'log-party',
    title: 'Log a party inquiry & send an invoice',
    summary: 'Capture a private-event request, then build and send the invoice.',
    audience: 'all',
    category: 'events',
    icon: PartyPopper,
    steps: [
      'Open Parties and tap “New Party.” Fill in the contact, the date, and the headcount — it lands in the Inquiry column.',
      'Open the party to see its profile. Add notes, packages, and anything the host asked for.',
      'When you’re ready to bill, open the Invoice tab. Add line items and the deposit — every total recalculates to the cent.',
      'Tap Print for a clean PDF you can hand over or attach.',
      'Tap “Mark sent” once you’ve sent it so everyone knows it’s out. (Nothing is emailed automatically — you’re always in control of the send.)',
    ],
    body: [
      'A big walk-up on the waitlist can become a party in one tap — see the “Start a party” nudge on the waitlist.',
    ],
    link: { to: '/parties', label: 'Open Parties' },
    keywords: ['party', 'private event', 'inquiry', 'lead', 'invoice', 'deposit', 'beo', 'booking', 'quote'],
  },
  {
    id: 'invoices-overview',
    title: 'Find an invoice you already started',
    summary: 'All party invoices in one place.',
    audience: 'all',
    category: 'events',
    icon: Receipt,
    steps: [
      'Open Invoices to see everything across all parties at a glance.',
      'Tap one to jump straight to that party’s invoice editor.',
      'From there you can edit line items, update the deposit, reprint, or mark it sent.',
    ],
    link: { to: '/invoices', label: 'Open Invoices' },
    keywords: ['invoice', 'billing', 'deposit', 'paid', 'receipt'],
  },

  // ───────────────────────────── SPECIALS & POSTS (all roles) ─────────────────────────────
  {
    id: 'special',
    title: 'Make a special / quick post',
    summary: 'Spin up a special graphic or drop a quick social post.',
    audience: 'all',
    category: 'marketing',
    icon: Sparkles,
    steps: [
      'Open Specials and tap “New Special” — or pick a template to start from something polished.',
      'In the editor, set the headline, price, and image. The preview updates as you go.',
      'Save it. Drafts hang around so you can finish later.',
      'Want it on Instagram/Facebook? Use the social post option to draft a caption and queue it.',
    ],
    body: [
      'Heads-up: posts are drafted and queued here. Auto-publishing to Instagram/Facebook turns on once the owner finishes the Meta connection (see the owner section).',
    ],
    link: { to: '/specials', label: 'Open Specials' },
    keywords: ['special', 'promo', 'graphic', 'flyer', 'social', 'post', 'instagram', 'facebook', 'caption', 'template'],
  },
  {
    id: 'social-queue',
    title: 'See what’s queued to post',
    summary: 'The pipeline of drafts and scheduled social posts.',
    audience: 'all',
    category: 'marketing',
    icon: Share2,
    steps: [
      'Open Social to see every draft, scheduled, and posted item.',
      'Tap a card to edit the caption or the target platforms.',
      'Drafts wait safely until they’re approved — nothing goes out on its own.',
    ],
    link: { to: '/social', label: 'Open Social' },
    keywords: ['social', 'queue', 'schedule', 'draft', 'instagram', 'facebook'],
  },
  {
    id: 'reviews',
    title: 'Add a review to the wall',
    summary: 'Drop in a Google / Yelp / Facebook review by hand.',
    audience: 'all',
    category: 'marketing',
    icon: Star,
    steps: [
      'Open Reviews. Tap to add a review manually — paste the text, the stars, and where it came from.',
      'It shows up on the reputation wall right away.',
    ],
    body: [
      'Automatic review sync from Google turns on once the owner connects the Google Business listing (see the owner section).',
    ],
    link: { to: '/reputation', label: 'Open Reviews' },
    keywords: ['review', 'reputation', 'google', 'yelp', 'facebook', 'stars', 'rating'],
  },

  // ───────────────────────────── OWNER ADMIN (owner only) ─────────────────────────────
  {
    id: 'roles',
    title: 'Roles & what each person can see',
    summary: 'Owner, manager, employee — the three access tiers.',
    audience: 'owner',
    category: 'admin',
    icon: ShieldCheck,
    body: [
      'There are three roles. Owner (you / family): full access to everything, including Team and all the connection settings. Manager: full operational access — bookings, stock, marketing, reports, scheduling — everything except owner-only admin.',
      'Employee: the limited, fail-closed default. They only see Service (open/close + checklists), the Waitlist, and this Help page. Everything else is hidden, and if they hit an ops-only link directly they’re bounced back to the Waitlist.',
      'The role is resolved server-side, so it can’t be faked from the browser. If a new login hasn’t been assigned a role yet, the app treats them as an employee until you say otherwise.',
    ],
    keywords: ['role', 'permission', 'rbac', 'access', 'owner', 'manager', 'employee', 'security'],
  },
  {
    id: 'employee-logins',
    title: 'Add an employee login',
    summary: 'Give a new hire their own limited account.',
    audience: 'owner',
    category: 'admin',
    icon: Users,
    steps: [
      'Open Team (owner-only).',
      'Add the staff member and set their role — keep front-line staff as Employee so they only get Service + Waitlist.',
      'Bump someone to Manager when you want them running the full operation; reserve Owner for family.',
      'Hand them the install QR / link so they can put the app on their phone and sign in to their view.',
    ],
    link: { to: '/team', label: 'Open Team' },
    keywords: ['team', 'staff', 'login', 'account', 'new hire', 'employee', 'invite', 'role'],
  },
  {
    id: 'install-pwa',
    title: 'Put the app on phones & iPads',
    summary: 'It installs to the home screen — no App Store needed.',
    audience: 'owner',
    category: 'admin',
    icon: Smartphone,
    body: [
      'This is a PWA (an installable web app). On iPhone/iPad: open the app in Safari, tap the Share button, then “Add to Home Screen.” On Android: open in Chrome and tap “Install app” from the menu.',
      'Once installed it opens full-screen like a native app, with the Iggy’s icon. Staff sign in to their own role-limited view.',
      'For onboarding a whole team, print the install QR poster so people scan, install, and sign in — no typing a URL.',
    ],
    keywords: ['install', 'pwa', 'home screen', 'iphone', 'ipad', 'android', 'add to home screen', 'qr', 'app'],
  },
  {
    id: 'luna',
    title: 'How Luna works',
    summary: 'Your AI manager that watches the numbers and surfaces what matters.',
    audience: 'owner',
    category: 'admin',
    icon: Moon,
    body: [
      'Luna is the AI assistant baked into the manager app. She reads the same data you do — sales, stock, bookings, reviews — and turns it into plain-language insights and nudges so you don’t have to go digging.',
      'New insights show as a badge on the Luna item in the sidebar. Open Luna to read them, ask follow-up questions, and act on suggestions.',
      'She never sends a text, email, or social post on her own — anything outbound still goes through you. She’s a co-pilot, not autopilot.',
    ],
    link: { to: '/luna', label: 'Open Luna' },
    keywords: ['luna', 'ai', 'assistant', 'insights', 'co-pilot', 'reports'],
  },
  {
    id: 'reports',
    title: 'Where to read the numbers',
    summary: 'Sales, trends, and COGS at a glance.',
    audience: 'owner',
    category: 'admin',
    icon: BarChart3,
    body: [
      'Reports is your sales and trend dashboard. COGS breaks down cost-of-goods so you can see margin. Both pull from live data — the more you log (counts, invoices, shifts), the sharper they get.',
      'Compliance tracks the licensing / safety items you need to stay on top of, and Schedule covers staffing.',
    ],
    link: { to: '/reports', label: 'Open Reports' },
    keywords: ['reports', 'cogs', 'sales', 'margin', 'analytics', 'numbers', 'compliance', 'schedule'],
  },

  // ───────────────────────────── CONNECT SERVICES (owner only) ─────────────────────────────
  {
    id: 'connect-overview',
    title: 'Connecting the gated features (overview)',
    summary: 'Texting, email, reviews, social, ads — what to wire up and in what order.',
    audience: 'owner',
    category: 'connect',
    icon: Settings,
    body: [
      'A handful of features are built and waiting on external accounts only you can create. The full plain-English walkthrough lives in docs/OWNER-SETUP-GUIDE.md — the cards below are the short version.',
      'Order by lead time: start the slow approvals first (Meta business verification, Twilio A2P registration), because those take days. Email (Resend), Google Ads, and Google reviews are faster.',
      'Each one is flipped on by setting a secret in the Supabase dashboard — never paste credentials into chat. Once the secret is set, the feature goes live with zero code changes.',
    ],
    keywords: ['setup', 'connect', 'integrations', 'secrets', 'env', 'supabase', 'owner setup guide', 'credentials'],
  },
  {
    id: 'connect-sms',
    title: 'Connect texting (SMS)',
    summary: 'Powers the “table ready” text and promo texts — via Twilio.',
    audience: 'owner',
    category: 'connect',
    icon: MessageSquare,
    body: [
      'Today the “Text table is ready” button and the marketing texter are safe-stubbed: they log the message and mark the guest notified, but send nothing until Twilio is connected.',
      'Trial (instant): a free Twilio trial can text only verified numbers — great for proving the loop end-to-end on your own phone.',
      'Production: register an A2P 10DLC Brand + Campaign in the Twilio Trust Hub (needs Iggy’s legal name, address, EIN). Approval takes ~1–3 business days, so start early. STOP/HELP opt-out handling is already built in.',
      'Then set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, and SMS_ENABLED=true in Supabase secrets and texting goes live.',
    ],
    keywords: ['sms', 'text', 'twilio', 'a2p', '10dlc', 'table ready', 'notify', 'opt-out', 'stop'],
  },
  {
    id: 'connect-email',
    title: 'Connect marketing email',
    summary: 'Send campaigns to your consent-gated list — via Resend.',
    audience: 'owner',
    category: 'connect',
    icon: Mail,
    body: [
      'The campaign composer can build emails, but there’s no sender wired yet. The site’s consent-gated signup is what grows a legally-emailable list (separate SMS/email checkboxes + a consent log).',
      'Recommended sender: Resend (cheap, one domain to verify, good deliverability for a small list).',
      'Create the account, verify a sending domain (e.g. mail.iggysseaside.com) with the DNS records it gives you, then set RESEND_API_KEY and MARKETING_FROM in Supabase. Test to your own inbox first.',
    ],
    keywords: ['email', 'resend', 'campaign', 'marketing', 'newsletter', 'consent', 'opt-in', 'unsubscribe'],
  },
  {
    id: 'connect-reviews',
    title: 'Connect Google reviews',
    summary: 'Auto-pull reviews onto the wall and fix the “leave a review” link.',
    audience: 'owner',
    category: 'connect',
    icon: Star,
    body: [
      'Manual review entry works today (see the staff “Add a review” card). Auto-sync needs Google Business Profile API access (OAuth) plus your real Google Place ID.',
      'Send your Google Business listing URL — the Place ID gets extracted from it, which also fixes the public “leave us a review” link (currently a placeholder). The OAuth handoff is the same as the Calendar token.',
    ],
    keywords: ['reviews', 'google', 'place id', 'business profile', 'oauth', 'reputation', 'sync'],
  },
  {
    id: 'connect-social',
    title: 'Connect Instagram / Facebook auto-posting',
    summary: 'The longest lead time — a Meta app review. Start it ASAP.',
    audience: 'owner',
    category: 'connect',
    icon: Instagram,
    body: [
      'Nothing has been submitted to Meta yet. The social composer drafts posts but auto-publish is gated until a Meta app is approved.',
      'Quick win (no Meta review): connect Iggy’s IG once at behold.so and embed the live feed on the website for instant social proof.',
      'Full auto-posting: create a Facebook Page, switch IG to a Business account and link it, complete Business Verification at business.facebook.com, then create a Business-type app at developers.facebook.com and request the content-publish permissions via App Review. Business Verification is the bottleneck — begin it today.',
      'After approval, set IG_ACCESS_TOKEN, FB_PAGE_ID, IG_USER_ID, and SOCIAL_PUBLISH_ENABLED=true in Supabase.',
    ],
    keywords: ['instagram', 'facebook', 'meta', 'auto-post', 'social', 'app review', 'business verification', 'behold'],
  },
  {
    id: 'connect-ads',
    title: 'Connect Google Ads & analytics',
    summary: 'Conversion tracking + session replay for the booking funnel.',
    audience: 'owner',
    category: 'connect',
    icon: BarChart3,
    body: [
      'First-party conversion plumbing already fires on high-intent actions (bookings, signups). To let Google optimize toward real bookings, create a Google Ads account and a Conversion action — it gives you an AW-XXXXXX/label ID.',
      'Hand over the AW- ID and it’s dropped into gtag (guarded by an env var). Add VITE_CLARITY_ID to turn on Microsoft Clarity session replay + heatmaps of the funnel (built, inert until set).',
      'The full Seaside-targeted campaign plan (keywords, geo radius, budget tiers, ad copy) lives in docs/GOOGLE-ADS-PLAN.md.',
    ],
    keywords: ['google ads', 'conversion', 'gtag', 'clarity', 'analytics', 'heatmap', 'tracking'],
  },
  {
    id: 'env-vars',
    title: 'Env vars & secrets, in one place',
    summary: 'What each secret unlocks — set them in Supabase, never in chat.',
    audience: 'owner',
    category: 'connect',
    icon: KeyRound,
    body: [
      'The app reads two public client vars from .env: VITE_SUPABASE_URL and VITE_SUPABASE_KEY (the anon key — safe to ship). VITE_CLARITY_ID is the optional analytics one.',
      'Everything sensitive lives as Supabase Edge Function secrets, set in the Supabase dashboard: SMS — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, SMS_ENABLED. Email — RESEND_API_KEY, MARKETING_FROM. Social — IG_ACCESS_TOKEN, FB_PAGE_ID, IG_USER_ID, SOCIAL_PUBLISH_ENABLED.',
      'Rule of thumb: anything that could send a message or spend money is a server secret, set once in Supabase. Setting it flips the matching feature on with no code change.',
    ],
    keywords: ['env', 'environment', 'secrets', 'supabase', 'twilio', 'resend', 'config', 'feature flag'],
  },
];
