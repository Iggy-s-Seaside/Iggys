import { describe, it, expect } from 'vitest';
import { money, centsToMoney, safeFmtDate } from './format';

describe('money', () => {
  it('shows whole dollars with thousands separators, no cents', () => {
    expect(money(1200)).toBe('$1,200');
    expect(money(12)).toBe('$12');
  });
  it('shows cents automatically for fractional amounts', () => {
    expect(money(12.5)).toBe('$12.50');
  });
  it('honors forced cents on/off', () => {
    expect(money(12, { cents: true })).toBe('$12.00');
    expect(money(12.99, { cents: false })).toBe('$13');
    expect(money(12.2, { cents: false })).toBe('$12');
  });
  it('can drop the symbol', () => {
    expect(money(1200, { noSymbol: true })).toBe('1,200');
  });
  it('treats null / undefined / NaN as $0', () => {
    expect(money(null)).toBe('$0');
    expect(money(undefined)).toBe('$0');
    expect(money(NaN)).toBe('$0');
  });
});

describe('centsToMoney', () => {
  it('converts integer cents to dollars', () => {
    expect(centsToMoney(125000)).toBe('$1,250');
    expect(centsToMoney(1250)).toBe('$12.50');
    expect(centsToMoney(0)).toBe('$0');
    expect(centsToMoney(null)).toBe('$0');
  });
});

describe('safeFmtDate', () => {
  it('formats a valid ISO date', () => {
    expect(safeFmtDate('2026-06-13')).toBe('Jun 13, 2026');
    expect(safeFmtDate('2026-06-13', 'yyyy')).toBe('2026');
  });
  it('returns "" for null / empty / unparseable input (never throws)', () => {
    expect(safeFmtDate(null)).toBe('');
    expect(safeFmtDate('')).toBe('');
    expect(safeFmtDate('garbage')).toBe('');
  });
});
