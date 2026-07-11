// Convert a high-intent lead (a reservation or an inbox message) into a private
// party inquiry in one tap. This reuses the SAME create path the rest of the app
// uses for new parties — findOrCreateContact + createParty (see QuickAddParty and
// PartyForm) — so the new record behaves identically to a hand-entered inquiry.
//
// It NEVER sends email/SMS. It only writes a `parties` row (status 'inquiry') and
// upserts the contact. Fields that aren't present on the source lead are left
// blank so the manager can enrich them on the party profile afterward.

import { createParty } from '../hooks/useParties';
import { findOrCreateContact } from '../hooks/useContacts';
import { supabase } from '../lib/supabase';
import type { Party } from '../types';

/** Escape LIKE/ILIKE wildcards so an email like jo_hn@x.com matches literally. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

/**
 * The most recent non-cancelled party already on file for this contact —
 * matched by email first (case-insensitive exact), falling back to exact name.
 * Create-time dedup guard: converting two messages from the same thread once
 * minted two pipeline cards for one booking. Fails open (null) on query errors
 * so a hiccup here never blocks a legitimate create.
 */
export async function findOpenPartyForContact(
  email?: string | null,
  name?: string | null
): Promise<Party | null> {
  const e = email?.trim();
  const n = name?.trim();
  if (!e && !n) return null;

  let q = supabase
    .from('parties')
    .select('*')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1);
  q = e ? q.ilike('contact_email', escapeLike(e)) : q.ilike('contact_name', escapeLike(n!));

  const { data, error } = await q;
  if (error) {
    console.error('findOpenPartyForContact:', error);
    return null;
  }
  return ((data as Party[]) || [])[0] ?? null;
}

/** Maps Luna's extracted space code to the party form's space_name label. */
const SPACE_LABELS: Record<string, string> = {
  upstairs: 'Upstairs bar',
  downstairs: 'Downstairs room',
  whole: 'Whole space',
};

export interface PartyUpsellInput {
  /** Required — the lead's name (reservation guest / message sender). */
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  company?: string | null;
  /** Calendar/event title. From a message subject, or built from the guest name. */
  title?: string | null;
  /** yyyy-MM-dd. From a reservation's date or Luna's extraction; blank if unknown. */
  eventDate?: string | null;
  /** HH:MM — from Luna's extraction of the email thread. */
  startTime?: string | null;
  endTime?: string | null;
  /** Maps the reservation party_size / extracted headcount onto guest_count. */
  guestCount?: number | null;
  /** 'upstairs' | 'downstairs' | 'whole' (Luna's extraction) → space_name label. */
  space?: string | null;
  /** A deposit amount stated in the thread → deposit_amount. */
  depositAmount?: number | null;
  /** A quoted total in the thread — folded into internal_notes as context (the
   *  party total is computed from line items, so there's no stored total field). */
  estTotal?: number | null;
  /** Luna's one-line summary of the food/drink/setup the customer requested →
   *  special_requests so the manager sees it on the party. */
  extractedNotes?: string | null;
  /** Carried into internal_notes (never emailed) so the lead's context isn't lost. */
  internalNotes?: string | null;
  /** Where this lead came from, for the source badge (e.g. 'website', 'email'). */
  source?: string | null;
}

/**
 * Create a private-party inquiry pre-filled from a lead. Returns the created
 * Party (so the caller can navigate to its profile) or null on failure.
 * Toasts (success/error) are surfaced by createParty itself.
 */
export async function createPartyFromLead(input: PartyUpsellInput): Promise<Party | null> {
  const name = input.contactName.trim();
  if (!name) return null;

  const email = input.contactEmail?.trim() || null;
  const phone = input.contactPhone?.trim() || null;
  const company = input.company?.trim() || null;

  const contactId = await findOrCreateContact({ name, email, phone, company });

  // Fold a quoted total into the internal notes (no stored total field — the
  // party total is derived from line items).
  const baseNotes = input.internalNotes?.trim() || '';
  const internalNotes = [
    baseNotes,
    input.estTotal != null ? `Email quoted ~$${input.estTotal} total.` : '',
  ].filter(Boolean).join('\n\n') || null;

  const payload: Partial<Party> = {
    status: 'inquiry',
    is_private: true,
    contact_id: contactId,
    contact_name: name,
    contact_email: email,
    contact_phone: phone,
    company,
    title: input.title?.trim() || null,
    event_date: input.eventDate || null,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    guest_count: input.guestCount != null ? input.guestCount : null,
    space_name: input.space ? (SPACE_LABELS[input.space] ?? input.space) : null,
    deposit_amount: input.depositAmount != null ? input.depositAmount : null,
    special_requests: input.extractedNotes?.trim() || null,
    internal_notes: internalNotes,
    source: input.source || null,
  };

  return createParty(payload);
}
