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
  category: string; // reservation | event | request | inquiry | notification | other
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

/** Fast keyword classifier over a raw subject/body/sender. */
export function classifyMessage(subject = '', body = '', email = ''): Triage {
  const text = `${subject}\n${body}`;
  if (NO_REPLY.test(email) || NO_REPLY.test(subject)) {
    return { importance: 'normal', category: 'notification', needsReply: false };
  }
  const isReservation = RESERVATION.test(text);
  const isEvent = EVENT.test(text);
  const isRequest = REQUEST.test(text) || /\?(\s|$)/.test(text);

  let category = 'inquiry';
  if (isReservation) category = 'reservation';
  else if (isEvent) category = 'event';
  else if (isRequest) category = 'request';

  const high = isReservation || isEvent || isRequest;
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

const CATEGORY_LABELS: Record<string, string> = {
  reservation: 'Reservation',
  event: 'Private event',
  request: 'Request',
  inquiry: 'Inquiry',
  notification: 'Notification',
  other: 'Other',
};

export function categoryLabel(category?: string | null): string {
  if (!category) return 'Inquiry';
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}
