// luna-relay — the Lighthouse always-on cloud fallback for Luna-at-work.
//
// A pg_cron tick (every ~30s) calls this. When the PC1 home bridge hasn't
// drained a question within RELAY_AFTER_SECS AND home looks down (stale
// heartbeat), the relay answers it from DeepSeek + the same bar facts the
// dashboard already holds in Supabase — so the app never shows "Luna offline".
//
// It NEVER races a healthy bridge: if the bridge heartbeat is fresh it only
// steps in past a hard deadline (HARD_LIMIT_SECS) that still beats the 3-min UI
// wall. Answers are tagged source='relay'. Camera/deep-memory questions degrade
// honestly (it says the home system is briefly offline) rather than fabricating.
//
// Auth: x-cron-secret header == LUNA_RELAY_SECRET (deploy --no-verify-jwt).

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- tunables ----
const RELAY_AFTER_SECS = 45;     // a question must be pending this long first
const BRIDGE_STALE_SECS = 30;    // heartbeat older than this => home is down
const HARD_LIMIT_SECS = 150;     // answer regardless of heartbeat past this (< 180s UI wall)
const RELAYING_STALE_SECS = 90;  // a 'relaying' row idle this long => recover it
const CLAIM_LIMIT = 5;

const DEEPSEEK_BASE_URL = (Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com").replace(/\/+$/, "");
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const OPERATOR_MODEL = Deno.env.get("OPERATOR_MODEL") || "deepseek-chat";
const OPERATOR_TIMEOUT = parseInt(Deno.env.get("OPERATOR_TIMEOUT") || "60", 10);
const RELAY_SECRET = Deno.env.get("LUNA_RELAY_SECRET") || "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ---- ported, verbatim, from luna_iggys_bridge.py (keep in sync) ----
const KNOWLEDGE_PACK =
  "IGGY'S KNOWLEDGE PACK v1 (durable - treat as ground truth, never contradict):\n" +
  "VENUE: Iggy's Bar, 200 S Franklin St, Seaside, Oregon 97138, (503) 738-0672. " +
  "Sending identity iggysbarevents@gmail.com. A seaside coast bar/restaurant with " +
  "stacked private-event spaces: an UPSTAIRS satellite bar, a DOWNSTAIRS room, or the " +
  "WHOLE space. Bradley is the manager; he reports to the OWNER.\n" +
  "WEATHER FIRST (the biggest demand driver on the coast): sunny weekends run hot; cold, " +
  "rain, and wind run quiet. A slow night that lines up with bad weather is WEATHER, not a " +
  "problem - don't alarm. A slow or open night with GOOD weather and no event is a real, " +
  "fillable opportunity - surface it. Always attribute; never just report a number.\n" +
  "SEASON: summer Fri/Sat, holiday weekends, and any night with an event or a large " +
  "upstairs/downstairs party run hot; deep-winter weekdays run quiet. Flex pars and " +
  "staffing expectations accordingly.\n" +
  "MONEY (use this math exactly, never approximate): grand total = room_rate*room_hours + " +
  "food_total + drink_total + gratuity + add-ons. Gratuity = gratuity_rate*(food_total + " +
  "drink_total) ONLY - never on room or add-ons. House defaults: room_rate $200, room_hours " +
  "2-3, gratuity_rate 0.18. Package lines price as flat, per_person (* guest_count), or " +
  "per_hour (* room_hours).\n" +
  "EVENTS: categories DJ Night, Live Music, Karaoke, Trivia Night, Themed Night, Private " +
  "Party, Holiday Party; one-off or recurring weekly.\n" +
  "PARTIES lifecycle: inquiry -> confirmed -> cancelled. Watch event_date, follow_up_date, " +
  "last_contacted_at, confirmation_sent_at. A confirmed party approaching with no " +
  "confirmation sent or no deposit tracked is a risk worth flagging.\n" +
  "INVENTORY: low = active AND current_quantity <= par_level. Cross-check for a recent order " +
  "before alarming. Usage well above an item's own trailing rate is an over-pour/spill/theft " +
  "signal worth an eyes-on - a possibility, not an accusation. 2026 target bands: pour cost " +
  "18-24%, COGS 28-32%, prime 55-65%, labor under 30%.\n" +
  "MENU & HAPPY HOUR are DB-driven - use live rows, never invent a price or a drink.\n" +
  "TWO VOICES: to BRADLEY (chat, alerts) be terse and operational - the answer, the source, " +
  "the one next step. To the OWNER (briefings, recaps) be clean, confident, numbers-first, " +
  "built to present upward - no jargon, no hedging, no apology. For guest-facing drafts use " +
  "Bradley's voice: warm, coastal-casual, first-name, specific to the event, one clear ask, " +
  "never salesy, never promising a comp he didn't authorize.\n" +
  "GUARDRAILS: plain text only. Never invent facts/prices/comps. Honor marketing_opt_in " +
  "before outreach. Escalate legal/health/dram-shop to human-only. Never gate reviews by " +
  "sentiment. End a data-grounded answer with a short 'Sources:' line naming the rows used.\n" +
  "NO TOOLS / NO SHELL: everything you need is already in THIS prompt - the knowledge pack, " +
  "the live menu, and the CONTEXT/data below - plus your own memory. Answer ONLY from what is " +
  "provided here. Do NOT run shell commands, curl, open files, fetch URLs, search the web, or " +
  "query a database: there is NO local Iggy's database to open (the bar's data lives in the app " +
  "and is already injected below). Reaching for a command cannot help - it only stalls you " +
  "behind an approval gate the night staff can't answer. Just answer from the context and your " +
  "memory.\n" +
  "GLOSSARY: 'the back room'/'upstairs' -> space='upstairs'; 'the DJ night' -> " +
  "events.category='DJ Night'; 'the 40-top' -> a party with guest_count about 40.";

const QUESTION_PREAMBLE =
  "You are Luna, the AI operations assistant built into the Iggy's Seaside (Seaside, Oregon) " +
  "WORK app. This is a SHARED staff tool, not a personal assistant - many different employees " +
  "talk to you through it. You are NOT a generic chatbot; you are a calibrated expert on THIS " +
  "bar/restaurant whose job is to make whoever is on shift feel like they never have to " +
  "remember, hunt, or open six screens. They often use it on a phone behind the bar.\n" +
  "WHO YOU ARE TALKING TO: see CURRENT USER below. Greet and address THEM by their first name. " +
  "Do NOT assume you are talking to Bradley or the owner. This is strictly a WORK context: " +
  "never bring up anyone's personal life - no pets, family, home, hobbies, or private details, " +
  "not about this person and not about anyone else. Everything you say is about running Iggy's.\n" +
  "TRUTH ONLY - never confabulate. Answer only from the KNOWLEDGE PACK, the LIVE MENU, and the " +
  "CONTEXT below. If you don't know something about the bar, say so plainly and offer to find " +
  "out - do NOT invent menu items, prices, ingredients, hours, or policies. ALLERGENS ARE " +
  "SAFETY-CRITICAL: never guess whether an item is gluten-free, dairy-free, nut-free, etc. " +
  "State a dietary/allergen fact only if it is explicit in the MENU data; otherwise say you'll " +
  "confirm with the kitchen. A wrong allergen answer can put a guest in the hospital.\n" +
  "PAST NIGHTS & EVENTS: the CONTEXT includes 'Recent past events' (shows/events that already " +
  "happened) and 'Recent nights' (the camera/footage read for recent business days). When asked " +
  "how an event or night went, or 'how many people' were there, answer from these - match the " +
  "event by name and date. Report the footage figure as what it is: a busyness proxy (person-" +
  "detection events per hour, and a SLOW/STEADY/BUSY/PACKED band), never as an exact count of " +
  "unique people - say e.g. 'PACKED - the cameras logged a peak of ~305 person-detections an " +
  "hour on the floor', not '305 people were there'.\n" +
  "Answer directly: concise, concrete, plain text, no markdown (no ** or # markers; simple " +
  "dashes for lists). When your answer rests on data, end with a short 'Sources:' line.";

const MENU_POLICY =
  "MENU & DIETARY POLICY (authoritative - answer dietary/allergen + bar questions from THIS, " +
  "never guess):\n" +
  "- The FOOD is Dooger's Seafood & Grill. GLUTEN-FREE: Dooger's states 'with few exceptions we " +
  "are happy to provide gluten-free options for our entire menu' - most items can be MADE " +
  "gluten-free ON REQUEST (gluten-free breading or sauteed in olive oil; steaks pan-grilled; " +
  "pans/fryer washed), but items are NOT gluten-free as plated by default. The one item that is " +
  "gluten-free as served is the CLAM CHOWDER (Dooger's clam chowder is gluten free). ALWAYS add, " +
  "for any severe allergy or celiac: Dooger's cannot offer a 100% guarantee against cross-contact " +
  "- have the guest flag it to the kitchen.\n" +
  "- VEGETARIAN/VEGAN markers are name-level only: the Garden Burger is vegetarian; the 'Vegan' " +
  "salad is vegan. Do NOT infer any other item is veg/vegan.\n" +
  "- HAPPY HOUR: $5 drafts, $5 wells, $3 cans, daily 3-5pm.\n" +
  "- Signature cocktails: Marionberry Mule, Burlini Espresso Martini, Iggy's Old Fashioned, " +
  "Key Lime Pie Martini (current prices live in the cocktails list / ask the bar).";

const CLOUD_NOTE =
  "\n\nSYSTEM NOTE (do not repeat verbatim): you are answering from the CLOUD FALLBACK because " +
  "the home system is briefly offline. You have the operational data above, but you do NOT have " +
  "the live cameras or your deep long-term memory right now. If the question needs a LIVE camera " +
  "look or a fresh person-count, say plainly that the live cameras run on the bar's local system " +
  "which is briefly offline, and offer the most recent recorded read from 'Recent nights' if " +
  "relevant - never invent a live number.";

const DEAD_PARTY_STATUSES = new Set(
  ["cancelled", "canceled", "completed", "archived", "declined", "rejected"],
);

// ---- date helpers (business day in Pacific, matching the bridge) ----
function pacificToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function trunc(s: string, n: number): string {
  s = (s || "").toString();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---- build the bar fact-set (mirrors gather_context + the recall fix) ----
async function buildFacts(): Promise<string> {
  const today = pacificToday();
  const in14 = addDays(today, 14);
  const past60 = addDays(today, -60);
  const back14 = addDays(today, -14);
  const lines: string[] = [`Today's date: ${today} (America/Los_Angeles)`];
  const errs: string[] = [];
  const safe = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { errs.push(`${label}: ${e}`); }
  };

  await safe("events", async () => {
    const { data } = await admin.from("events")
      .select("date,time,all_day,title,category,space")
      .eq("active", true).not("is_recurring", "is", true)
      .gte("date", today).lte("date", in14)
      .order("date", { ascending: true }).limit(40);
    lines.push(`\nUpcoming events (next 14 days):`);
    if (data && data.length) {
      for (const e of data) {
        const when = e.all_day ? "all day" : (e.time || "");
        const extras = [e.category, e.space].filter(Boolean).join(", ");
        lines.push(`- ${e.date} ${when} | ${e.title}${extras ? ` (${extras})` : ""}`);
      }
    } else lines.push("- (none scheduled)");
  });

  await safe("recurring", async () => {
    const { data } = await admin.from("events")
      .select("recurring_day,time,title,category,space")
      .eq("active", true).eq("is_recurring", true).limit(20);
    if (data && data.length) {
      lines.push(`\nRecurring weekly events:`);
      for (const e of data) {
        const extras = [e.category, e.space].filter(Boolean).join(", ");
        lines.push(`- every ${e.recurring_day} ${e.time || ""} | ${e.title}${extras ? ` (${extras})` : ""}`.replace(/\s+\|/, " |"));
      }
    }
  });

  // RECALL FIX: past events so "how did the show last Saturday go" can match.
  await safe("past_events", async () => {
    const { data } = await admin.from("events")
      .select("date,time,all_day,title,category,space")
      .eq("active", true).not("is_recurring", "is", true)
      .lt("date", today).gte("date", past60)
      .order("date", { ascending: false }).limit(20);
    if (data && data.length) {
      lines.push(`\nRecent past events (already happened - use for 'how did the show/night last week go' questions):`);
      for (const e of data) {
        const when = e.all_day ? "all day" : (e.time || "");
        const extras = [e.category, e.space].filter(Boolean).join(", ");
        lines.push(`- ${e.date} ${when} | ${e.title}${extras ? ` (${extras})` : ""}`);
      }
    }
  });

  // RECALL FIX: the camera/footage night log (chronicle band + demand_log peak).
  await safe("night_log", async () => {
    const { data: chron } = await admin.from("luna_chronicle")
      .select("business_day,context")
      .lt("business_day", today).gte("business_day", back14)
      .order("business_day", { ascending: false }).limit(14);
    if (!chron || !chron.length) return;
    const { data: dlog } = await admin.from("demand_log")
      .select("business_day,note,actual_band")
      .lt("business_day", today).gte("business_day", back14);
    const noteBy: Record<string, { note?: string; band?: string }> = {};
    for (const d of dlog || []) noteBy[d.business_day] = { note: d.note, band: d.actual_band };
    lines.push(`\nRecent nights - camera/footage read (band + peak person-detections/hr; this is a busyness PROXY, NOT a unique head count):`);
    for (const c of chron) {
      const ctx = (c.context || {}) as Record<string, unknown>;
      const dl = noteBy[c.business_day] || {};
      const band = (ctx["actual_band"] as string) || dl.band || "";
      const totals = ctx["busyness_totals"] as string;
      const bits = [c.business_day];
      if (band) bits.push(band);
      if (totals) bits.push(totals);
      else if (dl.note) bits.push(trunc(dl.note, 160));
      lines.push(`- ${bits.join(" | ")}`);
    }
  });

  await safe("parties", async () => {
    const { data } = await admin.from("parties")
      .select("event_date,start_time,end_time,status,contact_name,title,guest_count,space")
      .gte("event_date", today).order("event_date", { ascending: true }).limit(30);
    const live = (data || []).filter((p) => !DEAD_PARTY_STATUSES.has((p.status || "").toLowerCase())).slice(0, 10);
    lines.push(`\nUpcoming parties / private bookings:`);
    if (live.length) {
      for (const p of live) {
        const bits = [p.event_date, `${p.start_time || "?"}-${p.end_time || "?"}`, p.title || "(untitled)"];
        if (p.contact_name) bits.push(`contact: ${p.contact_name}`);
        if (p.guest_count != null) bits.push(`${p.guest_count} guests`);
        if (p.space) bits.push(String(p.space));
        bits.push(`status: ${p.status || "unknown"}`);
        lines.push(`- ${trunc(bits.join(" | "), 160)}`);
      }
    } else lines.push("- (none on the books)");
  });

  await safe("followups", async () => {
    const { data } = await admin.from("parties")
      .select("event_date,follow_up_date,contact_name,title,guest_count,space")
      .eq("status", "inquiry").not("follow_up_date", "is", null)
      .lte("follow_up_date", today).order("follow_up_date", { ascending: true }).limit(10);
    if (data && data.length) {
      lines.push(`\nParty leads with a follow-up due (chase these):`);
      for (const p of data) {
        const bits = [`follow-up due ${p.follow_up_date}`, p.title || p.contact_name || "(lead)"];
        if (p.event_date) bits.push(`event ${p.event_date}`);
        if (p.guest_count != null) bits.push(`${p.guest_count} guests`);
        lines.push(`- ${trunc(bits.join(" | "), 160)}`);
      }
    }
  });

  await safe("low_stock", async () => {
    const { data } = await admin.from("inventory_items")
      .select("name,current_quantity,par_level,unit,supplier").eq("active", true).limit(400);
    const low = (data || []).filter((i) => i.current_quantity != null && i.par_level != null && i.current_quantity <= i.par_level)
      .sort((a, b) => (b.par_level - b.current_quantity) - (a.par_level - a.current_quantity)).slice(0, 15);
    if (low.length) {
      lines.push(`\nInventory at or below par (worst gap first):`);
      for (const i of low) lines.push(`- ${i.name}: ${i.current_quantity}/${i.par_level} ${i.unit || ""}`.trimEnd() + (i.supplier ? ` (supplier: ${i.supplier})` : ""));
    }
  });

  await safe("specials", async () => {
    const { data } = await admin.from("specials").select("title,type,price").eq("active", true).order("type", { ascending: true }).limit(12);
    if (data && data.length) {
      lines.push(`\nActive specials running now:`);
      for (const s of data) lines.push(`- ${s.title}${s.type ? ` [${s.type}]` : ""}${s.price ? ` - ${s.price}` : ""}`);
    }
  });

  await safe("happy_hour", async () => {
    const { data } = await admin.from("happy_hour").select("name,price,type").order("type", { ascending: true }).limit(20);
    if (data && data.length) {
      lines.push(`\nHappy-hour menu (live prices - never invent one):`);
      for (const h of data) lines.push(`- ${h.name}${h.price ? ` - ${h.price}` : ""}${h.type ? ` (${h.type})` : ""}`);
    }
  });

  await safe("todos", async () => {
    const { data } = await admin.from("todos").select("title,priority,due_date").eq("done", false).order("due_date", { ascending: true, nullsFirst: false }).limit(12);
    if (data && data.length) {
      lines.push(`\nOpen to-dos:`);
      for (const t of data) lines.push(`- ${t.title}${t.priority ? ` [${t.priority}]` : ""}${t.due_date ? ` due ${t.due_date}` : ""}`);
    }
  });

  await safe("unread", async () => {
    const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("status", "unread");
    if (count != null) lines.push(`\nUnread contact-form messages: ${count}`);
  });

  if (errs.length) lines.push(`\n(note: some data slices were unavailable: ${errs.length})`);
  return lines.join("\n");
}

// Live menu block (mirrors fetch_menu): cocktails + menu_items + MENU_POLICY.
async function buildMenu(): Promise<string> {
  const lines: string[] = [];
  try {
    const { data: drinks } = await admin.from("cocktails").select("name,ingredients,price").order("name", { ascending: true }).limit(60);
    if (drinks && drinks.length) {
      lines.push("DRINKS (name | ingredients | price):");
      for (const d of drinks) {
        let row = d.name || "(unnamed)";
        if (d.ingredients) row += ` | ${trunc(d.ingredients, 160)}`;
        if (d.price) row += ` | ${d.price}`;
        lines.push(`- ${trunc(row, 220)}`);
      }
    }
  } catch (_e) { /* degrade */ }
  try {
    const { data: food } = await admin.from("menu_items")
      .select("name,description,price,is_86d,sort_order,menu_categories(menu_type,title)")
      .order("sort_order", { ascending: true, nullsFirst: false }).limit(140);
    if (food && food.length) {
      let cur = "";
      for (const f of food) {
        const cat = (f.menu_categories as { menu_type?: string; title?: string } | null);
        const section = cat?.menu_type || cat?.title || "Menu";
        if (section !== cur) { cur = section; lines.push(`FOOD - ${section}:`); }
        let row = f.name || "(unnamed)";
        if (f.price) row += ` | ${f.price}`;
        if (f.description) row += ` | ${trunc(f.description, 140)}`;
        if (f.is_86d) row += " | [86'd - currently OUT]";
        lines.push(`- ${trunc(row, 220)}`);
      }
    }
  } catch (_e) { /* degrade */ }
  lines.push("");
  lines.push(MENU_POLICY);
  return lines.join("\n");
}

async function staffName(email: string | null): Promise<string | null> {
  if (!email) return null;
  try {
    const { data } = await admin.from("staff").select("name").ilike("email", email).limit(1).maybeSingle();
    const full = (data?.name || "").trim();
    return full ? full.split(/\s+/)[0] : null;
  } catch (_e) { return null; }
}

async function askDeepSeek(system: string, user: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) throw new Error("no DEEPSEEK_API_KEY");
  const resp = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: OPERATOR_MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.6,
      max_tokens: 700,
      stream: false,
    }),
    signal: AbortSignal.timeout(OPERATOR_TIMEOUT * 1000),
  });
  if (!resp.ok) throw new Error(`deepseek ${resp.status}`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) throw new Error("deepseek empty");
  return content.trim();
}

// Minimal guard: plain-text only (the preamble already enforces truth/no-invent).
function guard(raw: string): string | null {
  let s = (raw || "").trim();
  if (!s) return null;
  s = s.replace(/\*\*/g, "").replace(/^#{1,6}\s+/gm, "").replace(/`/g, "").trim();
  return s.length >= 2 ? s : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const provided = req.headers.get("x-cron-secret");
  if (!RELAY_SECRET || provided !== RELAY_SECRET) return json({ error: "unauthorized" }, 401);

  // 1. recover any rows a prior crashed invocation left 'relaying'.
  let swept = 0;
  try {
    const { data } = await admin.rpc("relay_sweep", { p_stale_secs: RELAYING_STALE_SECS });
    swept = data ?? 0;
  } catch (_e) { /* non-fatal */ }

  // 2. atomically claim eligible stale questions (no-op if the bridge is alive).
  const { data: claimed, error: claimErr } = await admin.rpc("relay_claim_questions", {
    p_after_secs: RELAY_AFTER_SECS,
    p_hard_secs: HARD_LIMIT_SECS,
    p_bridge_stale_secs: BRIDGE_STALE_SECS,
    p_limit: CLAIM_LIMIT,
  });
  if (claimErr) return json({ error: claimErr.message, swept }, 500);
  if (!claimed || claimed.length === 0) return json({ ok: true, swept, claimed: 0 });

  // 3. build the fact-set once for the whole batch.
  const [facts, menu] = await Promise.all([buildFacts(), buildMenu()]);
  const system = `${QUESTION_PREAMBLE}\n\n${KNOWLEDGE_PACK}`;

  let answered = 0;
  const results: Array<{ id: number; ok: boolean }> = [];
  for (const q of claimed as Array<{ id: number; content: string; author_email: string | null }>) {
    try {
      const who = await staffName(q.author_email);
      const whoLine = who
        ? `CURRENT USER: ${who} - greet and address them by this first name.`
        : "CURRENT USER: name not on file - greet generically (e.g. 'Hey there'); do NOT assume this is Bradley or the owner.";
      const user =
        `${whoLine}\n\nLIVE MENU (answer menu questions ONLY from this; never invent items/prices/allergens):\n${menu}` +
        `\n\nCURRENT CONTEXT (live from the dashboard database):\n${facts}` +
        CLOUD_NOTE +
        `\n\nQUESTION (from ${who || q.author_email || "a staff member"}): ${trunc(String(q.content || ""), 4000)}`;
      const answer = guard(await askDeepSeek(system, user));
      if (!answer) { await admin.rpc("relay_release", { p_qid: q.id }); results.push({ id: q.id, ok: false }); continue; }
      const { error: finErr } = await admin.rpc("relay_finish_answer", { p_qid: q.id, p_content: answer });
      if (finErr) { await admin.rpc("relay_release", { p_qid: q.id }); results.push({ id: q.id, ok: false }); continue; }
      answered++;
      results.push({ id: q.id, ok: true });
    } catch (_e) {
      // DeepSeek down / timeout: release so the bridge or next tick retries.
      try { await admin.rpc("relay_release", { p_qid: q.id }); } catch (_e2) { /* sweep will catch it */ }
      results.push({ id: q.id, ok: false });
    }
  }
  return json({ ok: true, swept, claimed: claimed.length, answered, results });
});
