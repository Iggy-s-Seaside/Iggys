import { describe, it, expect } from 'vitest';
import { partyPlaceholders, fillTemplate } from './fillTemplate';
import type { Party } from '../types';

const p = (o: Partial<Party>): Partial<Party> => o;

describe('partyPlaceholders', () => {
  it('derives first_name from contact_name and computes room_total', () => {
    const v = partyPlaceholders(p({ contact_name: 'Jane Doe', room_rate: 100, room_hours: 3 }));
    expect(v.first_name).toBe('Jane');
    expect(v.contact_name).toBe('Jane Doe');
    expect(v.room_rate).toBe('$100.00');
    expect(v.room_total).toBe('$300.00');
  });

  it('defaults gratuity 18%, space_name + venue_name; blanks for missing fields', () => {
    const v = partyPlaceholders(p({}));
    expect(v.gratuity_pct).toBe('18%');
    expect(v.space_name).toBe('our upstairs space');
    expect(v.venue_name).toBe("Iggy's Bar in Seaside");
    expect(v.first_name).toBe('');
    expect(v.guest_count).toBe('');
    expect(v.room_total).toBe('$0.00');
  });

  it('honors an explicit gratuity rate and a zero guest count', () => {
    expect(partyPlaceholders(p({ gratuity_rate: 0.2 })).gratuity_pct).toBe('20%');
    expect(partyPlaceholders(p({ guest_count: 0 })).guest_count).toBe('0');
  });
});

describe('fillTemplate', () => {
  it('replaces known tokens, tolerating whitespace inside the braces', () => {
    expect(fillTemplate('Hi {{first_name}} / {{ contact_name }}', p({ contact_name: 'Jane Doe' }))).toBe(
      'Hi Jane / Jane Doe',
    );
  });
  it('formats the event date', () => {
    expect(fillTemplate('On {{event_date}}', p({ event_date: '2026-06-15' }))).toContain('June 15, 2026');
  });
  it('leaves unknown tokens untouched so the author can spot + fill them', () => {
    expect(fillTemplate('Hello {{mystery}}', p({}))).toBe('Hello {{mystery}}');
  });
});
