import { format, parseISO } from 'date-fns';
import type { Party, PartyPackage } from '../types';

/** Dollar amount of one party_package line given guest count / room hours. */
export function lineAmount(line: PartyPackage, guestCount: number | null, roomHours: number | null): number {
  const qty = line.quantity || 0;
  const price = line.unit_price || 0;
  if (line.unit === 'per_person') return price * (guestCount ?? 0) * qty;
  if (line.unit === 'per_hour') return price * (roomHours ?? 0) * qty;
  return price * qty; // flat
}

export interface InvoiceInputs {
  guest_count: number | null;
  room_rate: number;
  room_hours: number;
  food_total: number;
  drink_total: number;
  gratuity_rate: number; // e.g. 0.18
}

export interface InvoiceLine {
  name: string;
  detail: string;
  amount: number;
}

export interface InvoiceBreakdown {
  foodTotal: number;
  drinkTotal: number;
  gratuity: number;
  subtotal: number; // food + drink + gratuity
  roomTotal: number;
  addons: number;
  grandTotal: number;
  packageLines: InvoiceLine[];
}

export function partyToInvoiceInputs(p: Party): InvoiceInputs {
  return {
    guest_count: p.guest_count,
    room_rate: p.room_rate ?? 0,
    room_hours: p.room_hours ?? 0,
    food_total: p.food_total ?? 0,
    drink_total: p.drink_total ?? 0,
    gratuity_rate: p.gratuity_rate ?? 0.18,
  };
}

const unitSuffix = (unit: string) => (unit === 'flat' ? '' : ` ${unit.replace('_', ' ')}`);

/** Compute the full invoice breakdown. Gratuity applies to food + beverage only. */
export function computeInvoice(inputs: InvoiceInputs, lines: PartyPackage[]): InvoiceBreakdown {
  const bucket = (cat: string) =>
    lines
      .filter((l) => l.category === cat)
      .reduce((sum, l) => sum + lineAmount(l, inputs.guest_count, inputs.room_hours), 0);

  const foodTotal = (inputs.food_total || 0) + bucket('food');
  const drinkTotal = (inputs.drink_total || 0) + bucket('drink');
  const roomManual = (inputs.room_rate || 0) * (inputs.room_hours || 0);
  const roomTotal = roomManual + bucket('room');
  const addons = bucket('addon') + bucket('other');
  const gratuity = (inputs.gratuity_rate || 0) * (foodTotal + drinkTotal);
  const subtotal = foodTotal + drinkTotal + gratuity;
  const grandTotal = subtotal + roomTotal + addons;

  const packageLines: InvoiceLine[] = lines.map((l) => ({
    name: l.name,
    detail: `${l.quantity} × $${(l.unit_price || 0).toFixed(2)}${unitSuffix(l.unit)}`,
    amount: lineAmount(l, inputs.guest_count, inputs.room_hours),
  }));

  return { foodTotal, drinkTotal, gratuity, subtotal, roomTotal, addons, grandTotal, packageLines };
}

const money = (n: number) => `$${(n || 0).toFixed(2)}`;

function fmtDate(d: string | null): string {
  if (!d) return '';
  try {
    return format(parseISO(d), 'EEEE, MMMM d, yyyy');
  } catch {
    return d;
  }
}

/** Plain-text invoice (used for emailing). */
export function buildInvoiceText(party: Party, b: InvoiceBreakdown): string {
  const title = party.title?.trim() || `Private Event — ${party.contact_name}`;
  const out: string[] = [];
  out.push(`Invoice — ${title}`);
  if (party.event_date) out.push(`Event date: ${fmtDate(party.event_date)}`);
  out.push('');
  if (b.packageLines.length) {
    out.push('Packages:');
    for (const l of b.packageLines) out.push(`  - ${l.name} (${l.detail}) = ${money(l.amount)}`);
    out.push('');
  }
  out.push(`Food total:    ${money(b.foodTotal)}`);
  out.push(`Drink total:   ${money(b.drinkTotal)}`);
  out.push(`Gratuity (${Math.round((party.gratuity_rate ?? 0.18) * 100)}%): ${money(b.gratuity)}`);
  out.push(`Subtotal:      ${money(b.subtotal)}`);
  out.push(`Room total:    ${money(b.roomTotal)}`);
  if (b.addons) out.push(`Add-ons:       ${money(b.addons)}`);
  out.push(`GRAND TOTAL:   ${money(b.grandTotal)}`);
  return out.join('\n');
}

/** Printable HTML invoice (opened in a new window for print / save-as-PDF). */
export function buildInvoiceHtml(party: Party, b: InvoiceBreakdown): string {
  const title = party.title?.trim() || `Private Event — ${party.contact_name}`;
  const gratuityPct = Math.round((party.gratuity_rate ?? 0.18) * 100);
  const row = (label: string, value: number, strong = false) =>
    `<tr${strong ? ' style="font-weight:700;border-top:2px solid #111;"' : ''}><td style="padding:6px 0;">${label}</td><td style="padding:6px 0;text-align:right;">${money(value)}</td></tr>`;
  const pkgRows = b.packageLines
    .map(
      (l) =>
        `<tr><td style="padding:4px 0;color:#444;">${l.name} <span style="color:#999;">(${l.detail})</span></td><td style="padding:4px 0;text-align:right;color:#444;">${money(l.amount)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice — ${title}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;max-width:640px;margin:32px auto;padding:0 24px;}
  h1{font-size:20px;margin:0;}
  .muted{color:#777;font-size:13px;}
  table{width:100%;border-collapse:collapse;margin-top:18px;font-size:14px;}
  .head{border-bottom:2px solid #2dd4bf;padding-bottom:14px;margin-bottom:8px;}
</style></head><body>
  <div class="head">
    <h1>Iggy's Bar in Seaside</h1>
    <div class="muted">200 S Franklin St, Seaside, OR 97138 · (503) 738-0672</div>
  </div>
  <h2 style="font-size:16px;">${title}</h2>
  <div class="muted">${party.event_date ? fmtDate(party.event_date) : ''}${party.guest_count ? ' · ' + party.guest_count + ' guests' : ''}</div>
  ${pkgRows ? `<table>${pkgRows}</table>` : ''}
  <table>
    ${row('Food total', b.foodTotal)}
    ${row('Drink total', b.drinkTotal)}
    ${row(`Gratuity (${gratuityPct}%)`, b.gratuity)}
    ${row('Subtotal', b.subtotal)}
    ${row('Room total', b.roomTotal)}
    ${b.addons ? row('Add-ons', b.addons) : ''}
    ${row('Grand total', b.grandTotal, true)}
  </table>
  <p class="muted" style="margin-top:28px;">Thank you for choosing Iggy's Bar in Seaside!</p>
</body></html>`;
}
