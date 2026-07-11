import { describe, it, expect } from 'vitest';
import { decodeEntities } from './entities';

describe('decodeEntities', () => {
  it('decodes the WordPress-style numeric ampersand seen in the NABIP reach', () => {
    expect(decodeEntities('NABIP Medicare &#038; Annual Convention 2026 in town')).toBe(
      'NABIP Medicare & Annual Convention 2026 in town'
    );
  });

  it('decodes named and hex entities', () => {
    expect(decodeEntities('Fish &amp; Chips')).toBe('Fish & Chips');
    expect(decodeEntities('It&#x2019;s on')).toBe('It’s on');
    expect(decodeEntities('9pm &ndash; 1am')).toBe('9pm – 1am');
  });

  it('leaves plain text and unknown/malformed entities untouched', () => {
    expect(decodeEntities('Top Deck Saturdays')).toBe('Top Deck Saturdays');
    expect(decodeEntities('&unknownthing; stays')).toBe('&unknownthing; stays');
    expect(decodeEntities('AT&T is fine')).toBe('AT&T is fine');
  });

  it('refuses control characters and invalid code points', () => {
    expect(decodeEntities('bad &#7; bell')).toBe('bad &#7; bell');
    expect(decodeEntities('lone surrogate &#xD800; stays')).toBe('lone surrogate &#xD800; stays');
    expect(decodeEntities('too big &#1114112; stays')).toBe('too big &#1114112; stays');
  });
});
