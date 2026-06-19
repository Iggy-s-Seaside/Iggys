// Shared display formatters for money and dates.
//
// Adopted across the app so the same amount and the same date never render two
// different ways. These are DISPLAY-ONLY helpers — they format values for the
// screen and never alter stored prices or amounts. Match the existing call-site
// conventions so migration is drop-in (see backlog #13):
//   - money(1200)            -> "$1,200"     (thousands-separated, no cents)
//   - money(12.5)            -> "$12.50"     (cents shown when the value isn't whole)
//   - money(12.5, { cents }) -> "$12.50"     (force cents on/off)
//   - centsToMoney(125000)   -> "$1,250"     (integer-cents column -> dollars)
//   - safeFmtDate(iso)       -> "Jun 13, 2026" (never throws on bad input -> '')

import { format, parseISO } from 'date-fns';

export interface MoneyOptions {
  /**
   * Force the cents display. `true` always shows two decimals, `false` never
   * does (rounds to the dollar). Omit for "smart" behaviour: cents are shown
   * only when the amount isn't a whole dollar.
   */
  cents?: boolean;
  /** Drop the leading "$" (e.g. for a column already labelled in dollars). */
  noSymbol?: boolean;
}

/**
 * Format a USD dollar amount for display. Defaults to a clean whole-dollar value
 * with thousands separators ("$1,200"), and automatically shows cents when the
 * amount has a fractional part ("$12.50"). Null/undefined/NaN are treated as 0.
 */
export function money(n: number | null | undefined, opts: MoneyOptions = {}): string {
  const value = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  const showCents = opts.cents ?? !Number.isInteger(value);
  const digits = showCents ? 2 : 0;
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return opts.noSymbol ? formatted : `$${formatted}`;
}

/**
 * Format an integer-cents value (the `*_cents` columns) as a dollar amount.
 * Cents are shown only when the amount isn't a whole dollar, matching `money`.
 */
export function centsToMoney(c: number | null | undefined, opts: MoneyOptions = {}): string {
  const cents = typeof c === 'number' && Number.isFinite(c) ? c : 0;
  return money(cents / 100, opts);
}

/**
 * Format a date for display, tolerant of bad input. Accepts an ISO string
 * ('yyyy-MM-dd' or a full timestamp), a Date, a number (epoch ms), or null.
 * Anything unparseable — or null/empty — returns '' rather than throwing,
 * so a single bad row can never crash a render.
 */
export function safeFmtDate(
  value: string | number | Date | null | undefined,
  fmt = 'MMM d, yyyy',
): string {
  if (value === null || value === undefined || value === '') return '';
  try {
    const date = typeof value === 'string' ? parseISO(value) : value;
    return format(date, fmt);
  } catch {
    return '';
  }
}
