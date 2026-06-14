// supabase/functions/create-checkout/index.ts
// PUBLIC endpoint — creates a Stripe Checkout Session for one of three flows:
//   purpose 'merch'         → cart of merch_products (prices looked up server-side)
//   purpose 'party_deposit' → a private-party deposit (amount read from parties row)
//   purpose 'gift_card'     → a gift card for an arbitrary amount
// Returns { url } to redirect the buyer. Apple Pay / Google Pay / Link come free
// from Checkout's default method selection. NEVER trusts client-sent prices.
//
// Deploy: supabase functions deploy create-checkout --no-verify-jwt
// Required secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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

type Purpose = "merch" | "party_deposit" | "gift_card";

interface CartLine {
  product_id: string;
  size?: string | null;
  quantity?: number;
}

/** Convert a USD decimal amount to integer Stripe cents, guarding against float drift. */
function toCents(usd: number): number {
  return Math.round(usd * 100);
}

/** A short, human-readable gift-card code (no ambiguous chars). */
function makeGiftCardCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  return `IGGY-${block()}-${block()}`;
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secretKey) return json({ error: "Payments are not configured yet." }, 503);

    const stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: "2024-06-20",
    });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const purpose: Purpose | undefined = body.purpose;
    const success_url: string | undefined = body.success_url;
    const cancel_url: string | undefined = body.cancel_url;
    const customer_email: string | undefined =
      typeof body.customer_email === "string" ? body.customer_email : undefined;
    const clientMetadata: Record<string, string> =
      body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (!success_url || !cancel_url) {
      return json({ error: "success_url and cancel_url are required" }, 400);
    }
    if (!purpose || !["merch", "party_deposit", "gift_card"].includes(purpose)) {
      return json({ error: "Invalid or missing purpose" }, 400);
    }

    // Build line_items + metadata per purpose. Prices for known products ALWAYS
    // come from the DB — client amounts are never trusted.
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const metadata: Record<string, string> = { ...clientMetadata, purpose };
    let automatic_tax = false;
    let sessionEmail = customer_email;

    if (purpose === "merch") {
      const cart: CartLine[] = Array.isArray(body.line_items) ? body.line_items : [];
      if (cart.length === 0) return json({ error: "Cart is empty" }, 400);

      const ids = Array.from(new Set(cart.map((l) => String(l.product_id))));
      const { data: products, error: prodErr } = await admin
        .from("merch_products")
        .select("id,name,price,image,active")
        .in("id", ids);
      if (prodErr) throw new Error(prodErr.message);

      const byId = new Map((products || []).map((p) => [p.id as string, p]));

      for (const line of cart) {
        const p = byId.get(String(line.product_id));
        if (!p) return json({ error: `Unknown product: ${line.product_id}` }, 400);
        if (p.active === false) return json({ error: `Product unavailable: ${p.name}` }, 400);

        const qty = Math.max(1, Math.min(99, Math.floor(Number(line.quantity) || 1)));
        const unitAmount = toCents(Number(p.price));
        if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
          return json({ error: `Invalid price for ${p.name}` }, 400);
        }

        const sizeSuffix = line.size ? ` (${String(line.size).slice(0, 40)})` : "";
        line_items.push({
          quantity: qty,
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            product_data: {
              name: `${p.name}${sizeSuffix}`,
              ...(p.image ? { images: [String(p.image)] } : {}),
              metadata: { product_id: String(p.id), ...(line.size ? { size: String(line.size) } : {}) },
            },
          },
        });
      }
      // Merch ships physical goods → collect sales tax automatically.
      automatic_tax = true;
    } else if (purpose === "party_deposit") {
      const partyId = Number(body.party_id ?? clientMetadata.party_id);
      if (!Number.isInteger(partyId) || partyId <= 0) {
        return json({ error: "party_id is required for a deposit" }, 400);
      }

      const { data: party, error: partyErr } = await admin
        .from("parties")
        .select("id,title,contact_name,contact_email,deposit_amount,balance_due,payment_status")
        .eq("id", partyId)
        .single();
      if (partyErr || !party) return json({ error: "Party not found" }, 404);

      const deposit = Number(party.deposit_amount);
      const depositCents = toCents(deposit);
      if (!Number.isFinite(depositCents) || depositCents <= 0) {
        return json({ error: "No deposit amount is set for this party yet." }, 400);
      }
      // Manager UI enum is 'unpaid' | 'partial' | 'paid'; a paid deposit shows as 'partial'.
      if (party.payment_status === "partial" || party.payment_status === "paid") {
        return json({ error: "This deposit has already been paid." }, 409);
      }

      sessionEmail = sessionEmail || party.contact_email || undefined;
      metadata.party_id = String(party.id);
      const label = party.title ? `${party.title} — deposit` : "Private party deposit";
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: depositCents,
          product_data: { name: label, metadata: { party_id: String(party.id) } },
        },
      });
    } else if (purpose === "gift_card") {
      const amount = Number(body.amount);
      const amountCents = toCents(amount);
      // Gift cards are buyer-chosen, but clamp to a sane range ($5–$1000).
      if (!Number.isFinite(amountCents) || amountCents < 500 || amountCents > 100000) {
        return json({ error: "Gift card amount must be between $5 and $1000." }, 400);
      }

      const recipient_email =
        typeof body.recipient_email === "string" ? body.recipient_email.slice(0, 254) : "";
      const recipient_name =
        typeof body.recipient_name === "string" ? body.recipient_name.slice(0, 120) : "";
      const message = typeof body.message === "string" ? body.message.slice(0, 500) : "";

      const code = makeGiftCardCode();
      metadata.gift_card_code = code;
      if (recipient_email) metadata.recipient_email = recipient_email;
      if (recipient_name) metadata.recipient_name = recipient_name;

      // Pre-create the card in 'pending'; the webhook flips it to 'active' on payment.
      const { error: gcErr } = await admin.from("gift_cards").insert({
        code,
        initial_amount: amount,
        balance: amount,
        currency: "usd",
        status: "pending",
        purchaser_email: sessionEmail || null,
        recipient_email: recipient_email || null,
        recipient_name: recipient_name || null,
        message: message || null,
      });
      if (gcErr) throw new Error(gcErr.message);

      line_items.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Iggy's Gift Card",
            ...(recipient_name ? { description: `For ${recipient_name}` } : {}),
            metadata: { gift_card_code: code },
          },
        },
      });
    }

    if (line_items.length === 0) return json({ error: "Nothing to charge" }, 400);

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items,
      success_url,
      cancel_url,
      // Omitting payment_method_types lets Checkout auto-enable every eligible
      // method (card + Apple Pay / Google Pay / Link) — the modern default.
      // (automatic_payment_methods is a PaymentIntent-only param; invalid here.)
      metadata,
      payment_intent_data: { metadata },
      ...(sessionEmail ? { customer_email: sessionEmail } : {}),
      ...(automatic_tax
        ? {
            automatic_tax: { enabled: true },
            // automatic_tax needs an address to compute on → collect shipping for merch.
            shipping_address_collection: { allowed_countries: ["US"] },
          }
        : {}),
    };

    const session = await stripe.checkout.sessions.create(params);
    return json({ url: session.url, id: session.id });
  } catch (error) {
    console.error("create-checkout error:", error);
    return json({ error: error instanceof Error ? error.message : "Could not start checkout" }, 500);
  }
});
