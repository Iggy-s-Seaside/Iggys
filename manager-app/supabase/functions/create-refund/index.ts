// supabase/functions/create-refund/index.ts
// MANAGER-ONLY endpoint — issues a Stripe refund for a previous payment and records it.
// Requires an authenticated manager (Authorization: Bearer <supabase access token>),
// validated with the anon-key getUser() pattern (same as send-party-email).
//
// POST { payment_intent_id, amount?, reason? }
//   amount  — optional partial refund in USD (omit for a full refund)
//   reason  — one of Stripe's: 'duplicate' | 'fraudulent' | 'requested_by_customer'
//             (anything else is stored as a note, not sent to Stripe).
// After refunding, updates the matching customer_orders row's status / amount_refunded.
//
// Deploy: supabase functions deploy create-refund
// Required secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const STRIPE_REASONS = ["duplicate", "fraudulent", "requested_by_customer"] as const;
type StripeReason = (typeof STRIPE_REASONS)[number];

function toCents(usd: number): number {
  return Math.round(usd * 100);
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // 1) Require an authenticated manager (validate the bearer with the anon key).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secretKey) return json({ error: "Payments are not configured yet." }, 503);

    const stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: "2024-06-20",
    });

    // 2) Validate inputs.
    const body = await req.json().catch(() => ({}));
    const paymentIntentId: string | undefined =
      typeof body.payment_intent_id === "string" ? body.payment_intent_id.trim() : undefined;
    if (!paymentIntentId || !paymentIntentId.startsWith("pi_")) {
      return json({ error: "A valid payment_intent_id (pi_…) is required" }, 400);
    }

    const rawReason = typeof body.reason === "string" ? body.reason.trim() : "";
    const stripeReason: StripeReason | undefined = (STRIPE_REASONS as readonly string[]).includes(rawReason)
      ? (rawReason as StripeReason)
      : undefined;

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      metadata: { refunded_by: user.email ?? user.id, ...(rawReason ? { reason_note: rawReason.slice(0, 200) } : {}) },
    };
    if (stripeReason) refundParams.reason = stripeReason;

    // Optional partial amount (USD → cents). Omit for a full refund.
    if (body.amount != null) {
      const cents = toCents(Number(body.amount));
      if (!Number.isInteger(cents) || cents <= 0) {
        return json({ error: "amount must be a positive number of dollars" }, 400);
      }
      refundParams.amount = cents;
    }

    // 3) Issue the refund.
    const refund = await stripe.refunds.create(refundParams);

    // 4) Record it against the order (service role bypasses RLS). Best-effort:
    //    a refund for a deposit/gift card has no customer_orders row → just skip.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order } = await admin
      .from("customer_orders")
      .select("id, amount_total, amount_refunded")
      .eq("payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (order) {
      const refundedNow = (Number(order.amount_refunded) || 0) + refund.amount / 100;
      const fullyRefunded = refundedNow >= Number(order.amount_total) - 0.005;
      await admin
        .from("customer_orders")
        .update({
          amount_refunded: refundedNow,
          status: fullyRefunded ? "refunded" : "partially_refunded",
        })
        .eq("id", order.id);
    }

    return json({
      success: true,
      refund_id: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
    });
  } catch (error) {
    console.error("create-refund error:", error);
    return json({ error: error instanceof Error ? error.message : "Refund failed" }, 500);
  }
});
