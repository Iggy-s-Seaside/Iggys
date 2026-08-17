// Email triage heuristics — the instant, client-side first pass.
//
// The home-lab Luna bridge is the AUTHORITATIVE classifier (she reads each
// email and writes importance/category/needs_reply back to the row). But Luna
// runs on her own cadence, so until a message is luna-classified we fall back
// to this fast keyword heuristic so the "Needs a reply" board is never empty
// while waiting. Once Luna has classified a row, her verdict wins.

import type { Message } from '../types';

export type Importance = 'high' | 'normal';

export interface Triage {
  importance: Importance;
  category: string; // reservation | event | request | inquiry | notification | solicitation | other
  needsReply: boolean;
}

// Automated/no-reply senders — never a customer waiting on us.
const NO_REPLY =
  /(no[-_.]?reply|do[-_.]?not[-_.]?reply|noreply|notification|mailer-daemon|postmaster|automated|unsubscribe|@.*\b(google|facebook|instagram|squareup|stripe|netlify|paypal)\b)/i;

// A table/seat/availability ask.
const RESERVATION =
  /\b(reserv\w*|book a table|a table|table for|hold (a|the)|seats?|sit\b|walk[- ]?in|party of \d+)\b/i;

// A private-event / space-rental ask (Iggy's upstairs/downstairs/whole space).
const EVENT =
  /\b(private (event|party|room|booking)|book(ing)? (a|the|our|your)? ?(party|event|room|space|upstairs|downstairs)|birthday|wedding|graduation|anniversary|celebration|rehearsal dinner|corporate|holiday party|host(ing)?|rent\w* (the|a|your|our)? ?(room|space|upstairs|downstairs|venue)|\d+\s*(people|guests?|pax|top))\b/i;

// A general request/question that expects a human reply.
const REQUEST =
  /\b(quote|pricing|price|how much|cost|menu|cater\w*|do you (have|offer|do|allow)|can (we|i|you)|could (we|i|you)|would (it|you)|interested in|inquir\w*|question|info(rmation)?|availab\w*|details|get back to me|let me know|please (advise|confirm|send))\b/i;

/*
 * Cold pitches — SEO / ranking / review-service / link-building spam. They
 * deliberately mimic real enquiries ("interested in", "let me know", "?"), so
 * REQUEST above used to promote them and pin spam to the top of the "Needs a
 * reply" board. Checked BEFORE the request branch so a pitch is demoted, but
 * AFTER reservation/event so genuine booking intent always wins.
 *
 * Detection is deliberately ASYMMETRIC. Missing a pitch costs the
 * manager one tap; misfiling a real enquiry hides a booking in a collapsed
 * section and can cost the bar the job. So a term only fires on its own when it
 * has no innocent reading in a venue inbox.
 *
 * Terms that DO have an innocent reading here are gated behind an offer cue —
 * every one of these was a real false positive before the gate existed:
 *   "our nonprofit does community outreach, need a space for 30"
 *   "the brewery down the street — partnership opportunity for a tap takeover"
 *   "I teach a web design class, we want our end-of-term party there"
 *   "we left you a 5 star review! do you sell gift cards?"
 */
const SPAM_ONLY =
  /\b(seo|search engine optimi\w*|backlinks?|guest[- ]?posts?(ing)?|link[- ]?building|first page of google|rank (higher|#?\s?1)|higher rankings?|google (business (listing|profile)|my business)|increase (your )?(web ?site )?traffic|unsubscribe|opt[- ]out of (these|future) emails)\b/i;

/** Marketing-adjacent, but innocent in a venue inbox unless someone is selling. */
const PITCH_TOPIC =
  /\b(web ?(design|development|redesign)|digital marketing|social media management|marketing services|reviews?|rankings?|traffic|outreach|partnership|collaborat\w*)\b/i;

/** Someone offering to do something FOR the bar — the tell that it is a pitch. */
const OFFER_CUE =
  /\b(we (can|could|will|would like to) (help|get|boost|grow|increase|improve|offer|provide)|we (also )?(offer|provide|specialise|specialize|do)\b|our (agency|team|company|firm) (can|does|do|offers?|provides?|handles?|builds?|specialis\w*|specializ\w*)|i (can|could) help you|let us help|free (audit|trial|quote|consultation|analysis)|no obligation|money[- ]back|risk[- ]free|interested in (working|partnering) with you)\b/i;

/** True when the text reads as an unsolicited sales pitch rather than an enquiry. */
function looksLikeSolicitation(text: string): boolean {
  if (SPAM_ONLY.test(text)) return true;
  return PITCH_TOPIC.test(text) && OFFER_CUE.test(text);
}

/** Fast keyword classifier over a raw subject/body/sender. */
export function classifyMessage(subject = '', body = '', email = ''): Triage {
  const text = `${subject}\n${body}`;
  if (NO_REPLY.test(email) || NO_REPLY.test(subject)) {
    return { importance: 'normal', category: 'notification', needsReply: false };
  }
  const isReservation = RESERVATION.test(text);
  const isEvent = EVENT.test(text);
  const isSolicitation = looksLikeSolicitation(text);
  const isRequest = REQUEST.test(text) || /\?(\s|$)/.test(text);

  let category = 'inquiry';
  if (isReservation) category = 'reservation';
  else if (isEvent) category = 'event';
  else if (isSolicitation) category = 'solicitation';
  else if (isRequest) category = 'request';

  // Booking intent is always high. A pitch never is — even when it borrows
  // request phrasing, solicitation wins over request and stays normal/no-reply.
  const high = isReservation || isEvent || (isRequest && !isSolicitation);
  return { importance: high ? 'high' : 'normal', category, needsReply: high };
}

/** Resolve a message's triage — Luna's stored verdict wins, else heuristic. */
export function messageTriage(m: Message): Triage {
  const classified =
    m.luna_classified_at != null ||
    m.luna_classification != null ||
    m.importance === 'high' ||
    m.needs_reply === true;
  if (classified) {
    return {
      importance: m.importance === 'high' ? 'high' : 'normal',
      category: m.category ?? 'inquiry',
      needsReply: m.needs_reply === true,
    };
  }
  return classifyMessage(m.subject, m.message, m.email);
}

/** A message that still wants a reply right now (not already replied/archived). */
export function needsReplyNow(m: Message): boolean {
  if (m.status === 'replied' || m.status === 'archived') return false;
  return messageTriage(m).needsReply;
}

/** Cold-pitch bucket — rendered collapsed below the inbox, never in
 * "Needs a reply". Archived rows stay archived (the manager's verdict). */
export function isSolicitation(m: Message): boolean {
  if (m.status === 'archived') return false;
  return messageTriage(m).category === 'solicitation';
}

const CATEGORY_LABELS: Record<string, string> = {
  reservation: 'Reservation',
  event: 'Private event',
  request: 'Request',
  inquiry: 'Inquiry',
  notification: 'Notification',
  solicitation: 'Solicitation',
  other: 'Other',
};

export function categoryLabel(category?: string | null): string {
  if (!category) return 'Inquiry';
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}
