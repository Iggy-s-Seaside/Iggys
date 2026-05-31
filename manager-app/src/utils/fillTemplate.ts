import { format, parseISO } from 'date-fns';
import type { Party } from '../types';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return format(parseISO(d), 'EEEE, MMMM d, yyyy');
  } catch {
    return d;
  }
}

function money(n: number | null | undefined): string {
  const v = typeof n === 'number' ? n : 0;
  return `$${v.toFixed(2)}`;
}

/** Build the placeholder → value map for a party. */
export function partyPlaceholders(party: Partial<Party>): Record<string, string> {
  const firstName = (party.contact_name || '').trim().split(/\s+/)[0] || '';
  const roomRate = party.room_rate ?? 0;
  const roomHours = party.room_hours ?? 0;
  const roomTotal = roomRate * roomHours;
  const gratuityPct = Math.round((party.gratuity_rate ?? 0.18) * 100);

  return {
    contact_name: party.contact_name || '',
    first_name: firstName,
    company: party.company || '',
    event_date: fmtDate(party.event_date),
    start_time: party.start_time || '',
    end_time: party.end_time || '',
    setup_time: party.setup_time || '',
    guest_count: party.guest_count != null ? String(party.guest_count) : '',
    space_name: party.space_name || 'our upstairs space',
    food_service_type: party.food_service_type || '',
    room_rate: money(roomRate),
    room_hours: roomHours ? String(roomHours) : '',
    room_total: money(roomTotal),
    gratuity_pct: `${gratuityPct}%`,
    venue_name: "Iggy's Bar in Seaside",
    manager_name: '',
  };
}

/**
 * Replace {{placeholder}} tokens in a template body/subject with values from a party.
 * Unknown tokens are left untouched so the user can spot and fill them manually.
 */
export function fillTemplate(text: string, party: Partial<Party>): string {
  const values = partyPlaceholders(party);
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) =>
    key in values ? values[key] : `{{${key}}}`
  );
}

/** Tokens available to template authors (shown as hints in the editor). */
export const PLACEHOLDER_KEYS = [
  'first_name',
  'contact_name',
  'company',
  'event_date',
  'start_time',
  'end_time',
  'setup_time',
  'guest_count',
  'space_name',
  'food_service_type',
  'room_rate',
  'room_hours',
  'room_total',
  'gratuity_pct',
  'venue_name',
  'manager_name',
] as const;
