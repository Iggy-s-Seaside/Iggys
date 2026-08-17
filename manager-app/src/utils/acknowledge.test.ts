import { describe, it, expect } from 'vitest';
import { canAcknowledge, senderFirstName, buildAcknowledgement } from './acknowledge';
import type { Message } from '../types';

const msg = (over: Partial<Message>) =>
  ({
    subject: 'Birthday party',
    message: 'Can we book the upstairs for a birthday?',
    email: 'guest@gmail.com',
    status: 'unread',
    replied_at: null,
    ...over,
  } as unknown as Message);

describe('canAcknowledge — which messages qualify for the reviewer stage', () => {
  it('allows an unread customer inquiry', () => {
    expect(canAcknowledge(msg({}))).toBe(true);
  });

  it('allows a read message still awaiting a first response', () => {
    expect(canAcknowledge(msg({ status: 'read' }))).toBe(true);
  });

  it('rejects replied and archived messages', () => {
    expect(canAcknowledge(msg({ status: 'replied' }))).toBe(false);
    expect(canAcknowledge(msg({ status: 'archived' }))).toBe(false);
  });

  it('rejects a message that already has a recorded reply', () => {
    expect(canAcknowledge(msg({ replied_at: '2026-08-01T10:00:00Z' }))).toBe(false);
  });

  it('rejects solicitations classified by Luna', () => {
    expect(
      canAcknowledge(msg({ category: 'solicitation', luna_classified_at: '2026-08-01T10:00:00Z' }))
    ).toBe(false);
  });

  it('rejects solicitations caught by the keyword heuristic', () => {
    expect(
      canAcknowledge(
        msg({ subject: 'SEO offer', message: 'We can help you rank #1 with backlinks and guest posts' })
      )
    ).toBe(false);
  });

  it('does not reject a non-solicitation notification per the owner rule (only solicitations are barred)', () => {
    expect(
      canAcknowledge(msg({ subject: 'Receipt', message: 'thanks', email: 'noreply@stripe.com' }))
    ).toBe(true);
  });
});

describe('senderFirstName', () => {
  it('takes the first token of a full name', () => {
    expect(senderFirstName('Sarah Connor')).toBe('Sarah');
  });

  it('handles a single name and extra whitespace', () => {
    expect(senderFirstName('  Madonna  ')).toBe('Madonna');
  });

  it('falls back to "there" for a blank name', () => {
    expect(senderFirstName('   ')).toBe('there');
    expect(senderFirstName('')).toBe('there');
  });
});

describe('buildAcknowledgement — the standard warm acknowledgement', () => {
  it('personalises with first name and subject, matching the retired auto-reply tone', () => {
    const text = buildAcknowledgement('Sarah Connor', 'Birthday party');
    expect(text).toContain('Hey Sarah!');
    expect(text).toContain('about "Birthday party"');
    expect(text).toContain('within 24 hours');
    expect(text).toContain('(503) 738-0672');
    expect(text).toContain("Cheers,\nThe Iggy's Team");
    expect(text).toContain('200 S Franklin St, Seaside, OR 97138');
    expect(text).toContain('iggysseaside.com');
  });

  it('never claims to be an automated confirmation (a human sends this now)', () => {
    const text = buildAcknowledgement('Sarah Connor', 'Birthday party');
    expect(text.toLowerCase()).not.toContain('automated');
    expect(text.toLowerCase()).not.toContain("don't reply");
  });

  it('handles a blank subject without leaving empty quotes', () => {
    const text = buildAcknowledgement('Sam', '   ');
    expect(text).toContain('Hey Sam!');
    expect(text).toContain('Thanks for reaching out to us!');
    expect(text).not.toContain('""');
  });

  it('handles a blank name with the friendly fallback', () => {
    expect(buildAcknowledgement('', 'Question')).toContain('Hey there!');
  });
});
