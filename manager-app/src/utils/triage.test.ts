import { describe, it, expect } from 'vitest';
import { classifyMessage, messageTriage, needsReplyNow, isSolicitation, categoryLabel } from './triage';
import type { Message } from '../types';

const msg = (over: Partial<Message>) =>
  ({ subject: '', message: '', email: 'guest@gmail.com', status: 'unread', ...over } as unknown as Message);

describe('classifyMessage — fast keyword heuristic', () => {
  it('marks automated/no-reply senders as notifications (no reply needed)', () => {
    const t = classifyMessage('Your receipt', 'thanks', 'noreply@stripe.com');
    expect(t.category).toBe('notification');
    expect(t.needsReply).toBe(false);
    // unsubscribe in the subject also trips it
    expect(classifyMessage('Unsubscribe confirmation', '', 'a@b.com').category).toBe('notification');
  });

  it('detects a reservation ask (high, needs reply)', () => {
    const t = classifyMessage('Friday', 'Can we get a table for 4 on Friday?', 'g@g.com');
    expect(t.category).toBe('reservation');
    expect(t.needsReply).toBe(true);
    expect(t.importance).toBe('high');
  });

  it('detects a private-event ask', () => {
    expect(classifyMessage('Birthday', 'We want to book the upstairs for a birthday', 'g@g.com').category).toBe('event');
  });

  it('detects a general request (pricing/catering/question mark)', () => {
    expect(classifyMessage('Pricing', 'How much for catering?', 'g@g.com').category).toBe('request');
    expect(classifyMessage('', 'Open Monday?', 'g@g.com').category).toBe('request'); // bare "?" => request
  });

  it('falls back to a low-priority inquiry with no keywords', () => {
    const t = classifyMessage('Hello', 'Just saying hi', 'g@g.com');
    expect(t.category).toBe('inquiry');
    expect(t.needsReply).toBe(false);
    expect(t.importance).toBe('normal');
  });

  it('prioritises reservation over event when both match', () => {
    expect(classifyMessage('Table', 'table for 10 for a birthday party', 'g@g.com').category).toBe('reservation');
  });
});

describe('classifyMessage — solicitation bucket (cold pitches)', () => {
  it('flags an SEO / first-page ranking pitch (normal, no reply)', () => {
    const t = classifyMessage(
      'Improve your Google ranking',
      'We found your website and can get you on the first page of Google with our SEO services — increase your traffic fast.',
      'pitch@seo-agency.com',
    );
    expect(t.category).toBe('solicitation');
    expect(t.importance).toBe('normal');
    expect(t.needsReply).toBe(false);
  });

  it('flags a review-service pitch even when it borrows request phrasing', () => {
    // "Interested in", "let me know" and "?" all used to promote this to high.
    const t = classifyMessage(
      'Quick question',
      'We can help you get more 5-star reviews on Google. Interested in a demo? Let me know!',
      'sales@reviewboost.io',
    );
    expect(t.category).toBe('solicitation');
    expect(t.needsReply).toBe(false);
    expect(t.importance).toBe('normal');
  });

  it('flags link-building / guest-post outreach', () => {
    expect(
      classifyMessage('Partnership opportunity', 'We would love to contribute a guest post as part of our outreach campaign.', 'pr@agency.com').category,
    ).toBe('solicitation');
    expect(
      classifyMessage('', 'Do you accept guest posts? We also offer backlink and link-building services.', 'a@b.com').category,
    ).toBe('solicitation');
  });

  it('flags web design / digital marketing pitches', () => {
    expect(
      classifyMessage('Your website', 'Our agency does web design and digital marketing to boost your bookings.', 'a@b.com').category,
    ).toBe('solicitation');
  });

  it('flags a Google Business / listing pitch', () => {
    expect(
      classifyMessage('Your Google Business profile', 'We noticed your google listing is unclaimed and can help you rank higher.', 'a@b.com').category,
    ).toBe('solicitation');
  });

  // ── False-positive guards: a real customer must NEVER be buried ──

  it('does NOT flag a real party enquiry using "interested in" and "let me know"', () => {
    const t = classifyMessage(
      'Birthday party',
      "Hi! I'm interested in booking the upstairs for my 30th birthday, about 30 people. Let me know what's available!",
      'guest@gmail.com',
    );
    expect(t.category).toBe('event');
    expect(t.importance).toBe('high');
    expect(t.needsReply).toBe(true);
  });

  it('does NOT flag a genuine customer question ending in "?"', () => {
    const t = classifyMessage('Question', 'Do you have gluten-free options? Please advise.', 'guest@gmail.com');
    expect(t.category).toBe('request');
    expect(t.needsReply).toBe(true);
  });

  it('booking intent beats solicitation keywords ("we found your website" + party)', () => {
    const t = classifyMessage(
      'Party',
      'We found your website and want to book the downstairs for a graduation, 40 guests.',
      'guest@gmail.com',
    );
    expect(t.category).toBe('event');
    expect(t.importance).toBe('high');
    expect(t.needsReply).toBe(true);
  });

  it('a customer mentioning a review in passing is not solicitation', () => {
    const t = classifyMessage('Loved it', 'We had a great night and left you a review. Do you sell gift vouchers?', 'guest@gmail.com');
    expect(t.category).not.toBe('solicitation');
    expect(t.needsReply).toBe(true);
  });

  it('a reservation ask never lands in the solicitation bucket', () => {
    const t = classifyMessage('Friday', 'Can we get a table for 4 on Friday?', 'guest@gmail.com');
    expect(t.category).toBe('reservation');
    expect(t.needsReply).toBe(true);
  });
});

describe('isSolicitation — row-level helper', () => {
  it('is true for a heuristic-flagged pitch, false once archived', () => {
    const pitch = msg({ subject: 'SEO', message: 'first page of google, backlinks, boost your traffic' });
    expect(isSolicitation(pitch)).toBe(true);
    expect(isSolicitation(msg({ ...pitch, status: 'archived' }))).toBe(false);
  });
  it('respects a stored Luna verdict', () => {
    expect(
      isSolicitation(msg({ luna_classified_at: '2026-06-15T00:00:00Z', importance: 'normal', category: 'solicitation', needs_reply: false })),
    ).toBe(true);
    expect(
      isSolicitation(msg({ luna_classified_at: '2026-06-15T00:00:00Z', importance: 'high', category: 'request', needs_reply: true, message: 'seo backlinks' })),
    ).toBe(false);
  });
  it('a solicitation never needs a reply', () => {
    expect(needsReplyNow(msg({ subject: 'Rank higher', message: 'digital marketing outreach, first page of google. let me know?' }))).toBe(false);
  });
});

describe('messageTriage — Luna verdict wins over the heuristic', () => {
  it("uses Luna's stored classification when present", () => {
    const t = messageTriage(msg({ luna_classified_at: '2026-06-15T00:00:00Z', importance: 'high', category: 'event', needs_reply: true, message: 'hi' }));
    expect(t).toEqual({ importance: 'high', category: 'event', needsReply: true });
  });
  it('respects a Luna "no reply needed" verdict even on keyword-y text', () => {
    const t = messageTriage(msg({ luna_classified_at: '2026-06-15T00:00:00Z', importance: 'normal', category: 'notification', needs_reply: false, message: 'table for 4?' }));
    expect(t.needsReply).toBe(false);
  });
  it('falls back to the heuristic when un-classified', () => {
    expect(messageTriage(msg({ subject: 'Table for 6', message: 'can we book a table?' })).category).toBe('reservation');
  });
});

describe('needsReplyNow', () => {
  it('is false once replied or archived', () => {
    expect(needsReplyNow(msg({ status: 'replied', message: 'table for 4?' }))).toBe(false);
    expect(needsReplyNow(msg({ status: 'archived', message: 'table for 4?' }))).toBe(false);
  });
  it('is true for a fresh reservation ask', () => {
    expect(needsReplyNow(msg({ status: 'unread', message: 'can we reserve a table?' }))).toBe(true);
  });
});

describe('categoryLabel', () => {
  it('maps known categories and capitalises unknowns', () => {
    expect(categoryLabel('event')).toBe('Private event');
    expect(categoryLabel('reservation')).toBe('Reservation');
    expect(categoryLabel(null)).toBe('Inquiry');
    expect(categoryLabel('custom')).toBe('Custom');
  });
});

/*
 * Adversarial corpus. Every "real customer" line below was a genuine false
 * positive against the first solicitation regex — each one would have buried a
 * paying enquiry in the collapsed Solicitations section. The asymmetry is the
 * point: a missed pitch costs one tap, a hidden booking costs the job.
 */
describe('solicitation classifier — adversarial corpus', () => {
  const REAL_CUSTOMERS: [string, string][] = [
    ['Community outreach event', 'Our nonprofit does community outreach and we need a space for 30 on a Saturday. Can you help?'],
    ['Partnership opportunity', 'We are the brewery down the street — partnership opportunity for a tap takeover night at your bar?'],
    ['Question', 'We found your website and want to book the upstairs for my mom 60th birthday, 25 people'],
    ['Hello', 'Came across your google listing — do you host graduation parties?'],
    ['Web design class', 'I teach a web design class at the college, we want to do our end of term party there'],
    ['Reviews', 'We left you a 5 star review last week! Do you sell gift cards?'],
    ['Collaboration', 'Local band here — collaboration idea, could we play a Saturday night?'],
  ];

  const REAL_SPAM: [string, string][] = [
    ['Improve your SEO', 'We can get your site on the first page of google and increase your traffic.'],
    ['Your google business listing', 'We found your website and noticed your rankings are poor. We offer digital marketing.'],
    ['More reviews', 'We can boost your 5-star reviews automatically. Free trial, no obligation.'],
    ['Link building', 'Offering guest posts and backlinks for your site.'],
    ['Web redesign', 'Our agency specializes in web design for restaurants. Free audit attached.'],
  ];

  it.each(REAL_CUSTOMERS)('keeps a real customer visible: %s', (subject, body) => {
    expect(classifyMessage(subject, body).category).not.toBe('solicitation');
  });

  it.each(REAL_SPAM)('files a cold pitch as solicitation: %s', (subject, body) => {
    const t = classifyMessage(subject, body);
    expect(t.category).toBe('solicitation');
    expect(t.needsReply).toBe(false);
    expect(t.importance).toBe('normal');
  });
});
