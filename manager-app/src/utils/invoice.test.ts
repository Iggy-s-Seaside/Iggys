import { describe, it, expect } from 'vitest';
import { lineAmount, computeInvoice, makeInvoiceNumber, partyToInvoiceInputs, type InvoiceInputs } from './invoice';
import type { Party, PartyPackage } from '../types';

const pkg = (over: Partial<PartyPackage>) =>
  ({ name: 'X', category: 'other', unit: 'flat', unit_price: 0, quantity: 1, notes: null, ...over } as unknown as PartyPackage);

const inputs = (over: Partial<InvoiceInputs> = {}): InvoiceInputs => ({
  guest_count: 10,
  room_rate: 0,
  room_hours: 0,
  food_total: 0,
  drink_total: 0,
  gratuity_rate: 0.18,
  ...over,
});

describe('lineAmount', () => {
  it('flat = price × qty', () => {
    expect(lineAmount(pkg({ unit: 'flat', unit_price: 100, quantity: 2 }), 10, 4)).toBe(200);
  });
  it('per_person = price × guests × qty', () => {
    expect(lineAmount(pkg({ unit: 'per_person', unit_price: 25, quantity: 1 }), 10, 0)).toBe(250);
  });
  it('per_hour = price × hours × qty', () => {
    expect(lineAmount(pkg({ unit: 'per_hour', unit_price: 50, quantity: 1 }), 0, 4)).toBe(200);
  });
  it('null guests / hours -> 0 (no crash)', () => {
    expect(lineAmount(pkg({ unit: 'per_person', unit_price: 25 }), null, 4)).toBe(0);
    expect(lineAmount(pkg({ unit: 'per_hour', unit_price: 50 }), 10, null)).toBe(0);
  });
});

describe('computeInvoice', () => {
  it('room = rate × hours; gratuity = rate × (food+drink) only', () => {
    const b = computeInvoice(inputs({ room_rate: 100, room_hours: 4 }), []);
    expect(b.roomTotal).toBe(400);
    expect(b.gratuity).toBe(0); // no food/drink
    expect(b.grandTotal).toBe(400);
  });

  it('gratuity applies to food + drink, NOT room or add-ons (the key rule)', () => {
    const b = computeInvoice(
      inputs({ food_total: 100, gratuity_rate: 0.18, room_rate: 50, room_hours: 2 }),
      [pkg({ category: 'addon', unit: 'flat', unit_price: 75, quantity: 1 })],
    );
    expect(b.foodTotal).toBe(100);
    expect(b.roomTotal).toBe(100); // 50 × 2
    expect(b.addons).toBe(75);
    expect(b.gratuity).toBe(18); // 0.18 × 100 — excludes room (100) + addon (75)
    expect(b.subtotal).toBe(118); // food + drink + gratuity
    expect(b.grandTotal).toBe(293); // 118 + 100 + 75
  });

  it('buckets package lines into food/drink/room/addon by category', () => {
    const b = computeInvoice(inputs({ guest_count: 5, gratuity_rate: 0 }), [
      pkg({ category: 'food', unit: 'per_person', unit_price: 20, quantity: 1 }), // 20×5 = 100
      pkg({ category: 'drink', unit: 'flat', unit_price: 60, quantity: 1 }), // 60
      pkg({ category: 'room', unit: 'flat', unit_price: 150, quantity: 1 }), // 150
    ]);
    expect(b.foodTotal).toBe(100);
    expect(b.drinkTotal).toBe(60);
    expect(b.roomTotal).toBe(150);
    expect(b.grandTotal).toBe(310);
    expect(b.packageLines).toHaveLength(3);
  });
});

describe('partyToInvoiceInputs', () => {
  it('defaults a missing gratuity rate to 0.18 and nulls to 0', () => {
    const inp = partyToInvoiceInputs({ guest_count: 8, room_rate: null, gratuity_rate: null } as unknown as Party);
    expect(inp.gratuity_rate).toBe(0.18);
    expect(inp.room_rate).toBe(0);
    expect(inp.guest_count).toBe(8);
  });
});

describe('makeInvoiceNumber', () => {
  it('is INV-{id}-{yymm} from the event month', () => {
    expect(makeInvoiceNumber({ id: 42, event_date: '2026-06-15' } as unknown as Party)).toBe('INV-42-2606');
  });
});
