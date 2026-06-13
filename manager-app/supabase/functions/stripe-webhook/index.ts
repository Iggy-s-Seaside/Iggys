// supabase/functions/stripe-webhook/index.ts
// Stripe webhook receiver. Verifies the signature (STRIPE_WEBHOOK_SECRET) and, on
// checkout.session.completed, writes the right record for the session's purpose:
//   merch         → insert customer_orders + order_items
//   party_deposit → update parties.payment_status / amount_paid / paid_at
//   gift_card     → activate the pending gift_cards row + ledger row
// Idempotent on the Stripe EVENT id (stripe_event_id UNIQUE / processed_events guard).
// Returns 200 fast; does the minimum work needed.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
//   (Stripe signs the request itself; there is no Supabase JWT to verify.)
// Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//                   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/** Convert Stripe integer cents to a USD decimal for our NUMERIC(10,2) columns. */
function fromCents(cents: number | null | undefined): number {
  return Math.round(Number(cents || 0)) / 100;
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secretKey || !webhookSecret) {
    return json({ error: "Webhook is not configured yet." }, 503);
  }

  const stripe = new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: "2024-06-20",
  });

  // 1) Verify signature on the RAW body (async variant required in Deno/Workers).
  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing stripe-signature" }, 400);

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("stripe-webhook signature error:", err instanceof Error ? err.message : err);
    return json({ error: "Invalid signature" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // We only act on a completed (paid) checkout session.
  if (event.type !== "checkout.session.completed") {
    return json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Only fulfil sessions that are actually paid (covers async payment methods).
  if (session.payment_status && session.payment_status !== "paid") {
    return json({ received: true, skipped: "not_paid" });
  }

  const meta = (session.metadata || {}) as Record<string, string>;
  const purpose = meta.purpose;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const name = session.customer_details?.name ?? null;
  const amountTotal = fromCents(session.amount_total);

  try {
    if (purpose === "merch") {
      // Idempotency: stripe_event_id is UNIQUE → a retried event no-ops.
      const { data: existing } = await admin
        .from("customer_orders")
        .select("id")
        .eq("stripe_event_id", event.id)
        .maybeSingle();
      if (existing) return json({ received: true, duplicate: true });

      const { data: order, error: orderErr } = await admin
        .from("customer_orders")
        .insert({
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          payment_intent_id: paymentIntentId,
          customer_email: email,
          customer_name: name,
          amount_total: amountTotal,
          currency: session.currency || "usd",
          status: "paid",
          shipping: session.shipping_details ?? null,
          metadata: meta,
        })
        .select("id")
        .single();
      // Unique-violation (concurrent retry) → treat as already-handled.
      if (orderErr) {
        if ((orderErr as { code?: string }).code === "23505") return json({ received: true, duplicate: true });
        throw new Error(orderErr.message);
      }

      // Pull line items from Stripe (authoritative; client cart isn't trusted).
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
        expand: ["data.price.product"],
      });
      const rows = lineItems.data.map((li) => {
        const product = li.price?.product as Stripe.Product | undefined;
        const pmeta = (product?.metadata || {}) as Record<string, string>;
        return {
          order_id: order.id,
          product_id: pmeta.product_id || null,
          name: li.description || product?.name || "Item",
          size: pmeta.size || null,
          quantity: li.quantity || 1,
          unit_price: fromCents(li.price?.unit_amount),
        };
      });
      if (rows.length > 0) {
        const { error: itemsErr } = await admin.from("order_items").insert(rows);
        if (itemsErr) throw new Error(itemsErr.message);
      }
    } else if (purpose === "party_deposit") {
      const partyId = Number(meta.party_id);
      if (!Number.isInteger(partyId) || partyId <= 0) {
        console.error("stripe-webhook: party_deposit missing party_id", meta);
        return json({ received: true, skipped: "no_party_id" });
      }

      const { data: party } = await admin
        .from("parties")
        .select("id, payment_intent_id, balance_due, food_total, drink_total, room_rate, room_hours, gratuity_rate")
        .eq("id", partyId)
        .single();

      // Idempotency: same intent already recorded → no-op.
      if (party && party.payment_intent_id && party.payment_intent_id === paymentIntentId) {
        return json({ received: true, duplicate: true });
      }

      const { error: updErr } = await admin
        .from("parties")
        .update({
          // Manager UI enum is 'unpaid' | 'partial' | 'paid'; a deposit → 'partial'.
          payment_status: "partial",
          amount_paid: amountTotal,
          payment_intent_id: paymentIntentId,
          paid_at: new Date().toISOString(),
        })
        .eq("id", partyId);
      if (updErr) throw new Error(updErr.message);
    } else if (purpose === "gift_card") {
      const code = meta.gift_card_code;
      if (!code) {
        console.error("stripe-webhook: gift_card missing code", meta);
        return json({ received: true, skipped: "no_code" });
      }

      const { data: card } = await admin
        .from("gift_cards")
        .select("id, status, initial_amount, balance")
        .eq("code", code)
        .single();
      if (!card) {
        console.error("stripe-webhook: gift_card not found for code", code);
        return json({ received: true, skipped: "card_not_found" });
      }
      // Idempotency: already activated → no-op.
      if (card.status === "active" || card.status === "redeemed") {
        return json({ received: true, duplicate: true });
      }

      const { error: actErr } = await admin
        .from("gift_cards")
        .update({
          status: "active",
          stripe_session_id: session.id,
          payment_intent_id: paymentIntentId,
          purchaser_email: email,
          activated_at: new Date().toISOString(),
        })
        .eq("id", card.id);
      if (actErr) throw new Error(actErr.message);

      const { error: txErr } = await admin.from("gift_card_transactions").insert({
        gift_card_id: card.id,
        type: "activate",
        amount: Number(card.initial_amount),
        balance_after: Number(card.balance),
        note: "Activated on Stripe payment",
      });
      if (txErr) throw new Error(txErr.message);
    } else {
      console.warn("stripe-webhook: unknown purpose, ignoring:", purpose);
    }

    return json({ received: true });
  } catch (error) {
    console.error("stripe-webhook handler error:", error);
    // 500 → Stripe retries; our idempotency guards make retries safe.
    return json({ error: "Webhook handler failed" }, 500);
  }
});
