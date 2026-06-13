// supabase/functions/luna-snapshot/index.ts
//
// BRIDGE CONTRACT — Luna's "state of Iggy's right now" feed.
// ---------------------------------------------------------------------------
// The in-app Luna is NOT an LLM call. The home-lab Luna bridge polls this
// endpoint with the SERVICE-ROLE key once per cycle and gets back ONE compact,
// denormalized JSON blob describing the live state of the bar: upcoming events,
// confirmed/inquiry parties, low-stock inventory, unread mail, today's specials
// + happy hour, and open todos. The bridge reasons over this, then writes back
// ONLY to the two luna_* tables (luna_messages replies + proactive luna_insights
// carrying the one-tap InsightAction contract). It never mutates business data;
// the app performs any real action under the manager's authenticated session.
//
// This endpoint is READ-ONLY. It is meant for the bridge (service-role); there
// is no public-facing reason to call it, but CORS is kept for manual testing
// from the manager app / localhost.
//
// Resilience: each query runs in its own try/catch and contributes its own slice
// of the payload. A single failing query degrades that slice (empty + an error
// note in `errors`) rather than failing the whole snapshot — the bridge always
// gets partial, usable state.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggysseaside.com",
  "https://www.iggysseaside.com",
  "https://iggy-s-manager.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".netlify.app") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
function dateKey(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d: Date, days: number) { return new Date(d.getTime() + days * 24 * 60 * 60 * 1000); }

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  // Anchor every window to "today" so the bridge gets a coherent snapshot.
  const now = new Date();
  const todayKey = dateKey(now);
  const in7Key = dateKey(addDays(now, 7));
  const in14Key = dateKey(addDays(now, 14));

  // Collected non-fatal failures, keyed by slice, so the bridge can tell a
  // genuinely-empty slice from one that errored.
  const errors: Record<string, string> = {};

  let admin: ReturnType<typeof createClient>;
  try {
    admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
  } catch (error) {
    console.error("luna-snapshot client init error:", error);
    return json({ error: "Could not initialize Supabase client" }, 500);
  }

  // ── Events: today + next 7 days, active only ────────────────────────────
  let events: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await admin
      .from("events")
      .select("id,title,date,time,category,space,start_min,end_min,all_day,is_recurring,recurring_day")
      .eq("active", true)
      .gte("date", todayKey)
      .lte("date", in7Key)
      .order("date", { ascending: true });
    if (error) throw new Error(error.message);
    events = (data || []) as Array<Record<string, unknown>>;
  } catch (error) {
    errors.events = error instanceof Error ? error.message : String(error);
  }

  // ── Parties: confirmed (next 14 days) + inquiries due for follow-up ──────
  let confirmedParties: Array<Record<string, unknown>> = [];
  let followUpInquiries: Array<Record<string, unknown>> = [];
  const partyFields =
    "id,status,title,contact_name,contact_email,contact_phone,event_date,start_time,end_time,guest_count,space,space_name,is_private,food_service_type,follow_up_date,last_contacted_at,room_rate,room_hours,food_total,drink_total,gratuity_rate,confirmation_sent_at,source";
  try {
    const { data, error } = await admin
      .from("parties")
      .select(partyFields)
      .eq("status", "confirmed")
      .not("event_date", "is", null)
      .gte("event_date", todayKey)
      .lte("event_date", in14Key)
      .order("event_date", { ascending: true });
    if (error) throw new Error(error.message);
    confirmedParties = (data || []) as Array<Record<string, unknown>>;
  } catch (error) {
    errors.confirmedParties = error instanceof Error ? error.message : String(error);
  }
  try {
    const { data, error } = await admin
      .from("parties")
      .select(partyFields)
      .eq("status", "inquiry")
      .not("follow_up_date", "is", null)
      .lte("follow_up_date", todayKey)
      .order("follow_up_date", { ascending: true });
    if (error) throw new Error(error.message);
    followUpInquiries = (data || []) as Array<Record<string, unknown>>;
  } catch (error) {
    errors.followUpInquiries = error instanceof Error ? error.message : String(error);
  }

  // ── Inventory: active items at or below par, with supplier ───────────────
  let lowStock: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await admin
      .from("inventory_items")
      .select("id,name,current_quantity,unit,par_level,supplier,cost_per_unit,inventory_categories(name)")
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    type InvRow = {
      current_quantity: number;
      par_level: number;
      inventory_categories?: { name: string } | null;
      [key: string]: unknown;
    };
    lowStock = ((data || []) as InvRow[])
      .filter((i) => i.current_quantity <= i.par_level)
      .map((i) => ({
        id: i.id,
        name: i.name,
        current_quantity: i.current_quantity,
        unit: i.unit,
        par_level: i.par_level,
        supplier: i.supplier,
        cost_per_unit: i.cost_per_unit,
        category: i.inventory_categories?.name ?? null,
      }));
  } catch (error) {
    errors.lowStock = error instanceof Error ? error.message : String(error);
  }

  // ── Messages: unread count + latest 5 subjects ───────────────────────────
  let unreadCount = 0;
  let latestUnread: Array<Record<string, unknown>> = [];
  try {
    const { count, error } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "unread");
    if (error) throw new Error(error.message);
    unreadCount = count ?? 0;
  } catch (error) {
    errors.unreadCount = error instanceof Error ? error.message : String(error);
  }
  try {
    const { data, error } = await admin
      .from("messages")
      .select("id,name,subject,created_at,source")
      .eq("status", "unread")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    latestUnread = (data || []) as Array<Record<string, unknown>>;
  } catch (error) {
    errors.latestUnread = error instanceof Error ? error.message : String(error);
  }

  // ── Specials: today's active specials ────────────────────────────────────
  let specials: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await admin
      .from("specials")
      .select("id,title,description,type,price")
      .eq("active", true)
      .order("type", { ascending: true });
    if (error) throw new Error(error.message);
    specials = (data || []) as Array<Record<string, unknown>>;
  } catch (error) {
    errors.specials = error instanceof Error ? error.message : String(error);
  }

  // ── Happy hour: the standing happy-hour menu ─────────────────────────────
  let happyHour: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await admin
      .from("happy_hour")
      .select("id,name,description,price,type")
      .order("type", { ascending: true });
    if (error) throw new Error(error.message);
    happyHour = (data || []) as Array<Record<string, unknown>>;
  } catch (error) {
    errors.happyHour = error instanceof Error ? error.message : String(error);
  }

  // ── Todos: open (not done) ───────────────────────────────────────────────
  let openTodos: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await admin
      .from("todos")
      .select("id,title,details,priority,due_date,created_by,created_at")
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    openTodos = (data || []) as Array<Record<string, unknown>>;
  } catch (error) {
    errors.openTodos = error instanceof Error ? error.message : String(error);
  }

  return json({
    generatedAt: new Date().toISOString(),
    today: todayKey,
    windows: { events_through: in7Key, parties_through: in14Key },
    events,
    parties: {
      confirmed: confirmedParties,
      followUpInquiries,
    },
    inventory: {
      lowStock,
      lowStockCount: lowStock.length,
    },
    messages: {
      unreadCount,
      latestUnread,
    },
    specials,
    happyHour,
    todos: openTodos,
    // Empty object when everything succeeded; the bridge can treat any present
    // key as "this slice is stale/degraded this cycle".
    errors,
  });
});
