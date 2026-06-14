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
import type { Party } from '../types';

export interface PartyUpsellInput {
  /** Required — the lead's name (reservation guest / message sender). */
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  company?: string | null;
  /** Calendar/event title. From a message subject, or built from the guest name. */
  title?: string | null;
  /** yyyy-MM-dd. From a reservation's date; leave blank if unknown. */
  eventDate?: string | null;
  /** Maps the reservation party_size onto the party guest_count. */
  guestCount?: number | null;
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
    guest_count: input.guestCount != null ? input.guestCount : null,
    internal_notes: input.internalNotes?.trim() || null,
    source: input.source || null,
  };

  return createParty(payload);
}
