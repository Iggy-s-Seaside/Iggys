import { describe, it, expect } from 'vitest';
import { classifyMessage, messageTriage, needsReplyNow, categoryLabel } from './triage';
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
