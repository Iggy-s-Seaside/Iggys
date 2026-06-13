import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PaymentStatus } from '../types';

/** Purpose tag the create-checkout function uses to route the session. */
export type CheckoutPurpose = 'party_deposit' | 'party_balance';

export interface CheckoutLinkArgs {
  partyId: number;
  purpose: CheckoutPurpose;
  /** Optional explicit amount (in dollars). Omit to let the function use the party's deposit/balance. */
  amount?: number;
}

export interface CheckoutLinkResult {
  url: string;
  /** Stripe PaymentIntent id, when the function returns one. */
  paymentIntentId?: string | null;
  /** Amount (in dollars) the session was created for, echoed back by the function. */
  amount?: number | null;
}

/** Manager-side helper for the Stripe deposit rail: request a hosted checkout link
 *  + record a manual (offline) payment. The app always acts under the manager's
 *  authenticated session; Luna never touches these tables. */
export function usePayments() {
  const [requesting, setRequesting] = useState(false);
  const [marking, setMarking] = useState(false);

  /** Ask the create-checkout edge function for a hosted payment link. */
  const requestCheckoutLink = async (args: CheckoutLinkArgs): Promise<CheckoutLinkResult> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated. Please log in again.');

    setRequesting(true);
    try {
      const body: Record<string, unknown> = {
        purpose: args.purpose,
        party_id: args.partyId,
      };
      if (args.amount != null) body.amount = args.amount;

      const { data, error } = await supabase.functions.invoke('create-checkout', { body });
      if (error) {
        let message = error.message;
        try {
          const ctx = await (error as { context?: Response }).context?.json();
          if (ctx?.error) message = ctx.error;
        } catch { /* keep generic */ }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error('No payment link returned.');

      return {
        url: data.url as string,
        paymentIntentId: (data.payment_intent_id ?? null) as string | null,
        amount: (data.amount ?? null) as number | null,
      };
    } finally {
      setRequesting(false);
    }
  };

  /** Record a payment taken offline (cash / card-on-file / external). Updates the
   *  party row directly and recomputes balance + status from the new amount paid. */
  const markPaid = async (args: {
    partyId: number;
    amountPaid: number;
    depositAmount: number;
    grandTotal: number;
  }): Promise<boolean> => {
    setMarking(true);
    try {
      const amountPaid = Math.max(0, args.amountPaid);
      const balanceDue = Math.max(0, args.grandTotal - amountPaid);
      const paymentStatus: PaymentStatus =
        amountPaid <= 0
          ? 'unpaid'
          : balanceDue <= 0.005
          ? 'paid'
          : 'partial';

      const { error } = await supabase
        .from('parties')
        .update({
          amount_paid: amountPaid,
          balance_due: balanceDue,
          payment_status: paymentStatus,
          paid_at: amountPaid > 0 ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', args.partyId);

      if (error) throw new Error(error.message);
      return true;
    } finally {
      setMarking(false);
    }
  };

  return { requestCheckoutLink, markPaid, requesting, marking };
}
