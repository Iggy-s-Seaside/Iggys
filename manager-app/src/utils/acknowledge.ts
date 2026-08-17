// Reviewer-stage acknowledgement — the human replacement for the retired
// auto-reply. The old DB trigger (public.messages.on_new_message) used to send
// a warm "we'll get back to you within 24 hours" email to EVERY contact-form
// submission, including cold SEO/review-service spam — which confirmed to
// spammers that the address was live. That trigger is disabled in production,
// so a manager is now the sender. These helpers only decide WHICH messages
// qualify and WHAT the pre-fill says; the UI drops the text into the existing
// reply composer and the manager reviews/edits and presses Send themselves.
// Nothing here (or in the UI that calls it) may auto-send.

import type { Message } from '../types';
import { messageTriage } from './triage';

/**
 * True when a message is still awaiting its first response from the bar:
 * status unread/read (not replied/archived), no recorded reply yet, and NOT a
 * cold solicitation (those stay in their collapsed section and never get one).
 */
export function canAcknowledge(m: Message): boolean {
  if (m.status !== 'unread' && m.status !== 'read') return false;
  if (m.replied_at) return false;
  if (messageTriage(m).category === 'solicitation') return false;
  return true;
}

/** First token of the sender's name, with a friendly fallback. */
export function senderFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

/**
 * The standard acknowledgement, personalised with the sender's first name and
 * their subject. Wording mirrors the retired auto-reply copy
 * (supabase/functions/auto-reply/index.ts, buildAutoReplyPlain) so customers
 * get the same warm acknowledgement they always did. The old "This is an
 * automated confirmation — please don't reply" footer is deliberately gone:
 * this is now a human-sent reply and replies are welcome.
 */
export function buildAcknowledgement(name: string, subject: string): string {
  const first = senderFirstName(name);
  const about = subject.trim();
  const thanks = about
    ? `Thanks for reaching out to us about "${about}". We've received your message and one of our team members will get back to you within 24 hours.`
    : `Thanks for reaching out to us! We've received your message and one of our team members will get back to you within 24 hours.`;
  return [
    `Hey ${first}!`,
    '',
    thanks,
    '',
    `In the meantime, feel free to give us a call at (503) 738-0672 if you need anything urgent.`,
    '',
    `Cheers,`,
    `The Iggy's Team`,
    `Iggy's Bar in Seaside · 200 S Franklin St, Seaside, OR 97138`,
    `Open Daily 12pm - 12am · Happy Hour 3pm - 5pm`,
    `iggysseaside.com`,
  ].join('\n');
}
