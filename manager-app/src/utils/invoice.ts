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
  /** Optional free-text note (party_packages.notes), rendered as a dim sub-line. */
  notes?: string | null;
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

// Print/email currency. Thousands-separated to the cent, matching the BEO sheet
// (utils/format `money(n, { cents: true })`). Kept local because this module is
// also imported by HTML/text builders that must not depend on React-side render
// helpers; the number formatting here is intentionally identical to format.money.
const money = (n: number) =>
  `$${(typeof n === 'number' && Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const unitSuffix = (unit: string) => (unit === 'flat' ? '' : ` ${unit.replace('_', ' ')}`);

// ── Invoice lifecycle fields ──
// `parties.invoice_number` / `parties.invoice_sent_at` are added by
// scripts/add-invoice-fields.sql. Until the shared Party type carries them
// (integrator owns types/index.ts), read them through this widened shape so
// these helpers compile against the current type.
type InvoiceLifecycle = { invoice_number?: string | null; invoice_sent_at?: string | null };

/** Read the stored invoice number off a party (null until first issued). */
export function getInvoiceNumber(party: Party): string | null {
  return (party as Party & InvoiceLifecycle).invoice_number ?? null;
}

/** Read the "invoice sent" timestamp off a party (null = draft / never sent). */
export function getInvoiceSentAt(party: Party): string | null {
  return (party as Party & InvoiceLifecycle).invoice_sent_at ?? null;
}

/**
 * Deterministic invoice number for a party: INV-{id}-{yymm}, where yymm is the
 * event month (falling back to today when there's no event date). Stable for a
 * given party+month, so generating it again yields the same id.
 */
export function makeInvoiceNumber(party: Party): string {
  const basis = party.event_date ? parseISO(party.event_date) : new Date();
  const d = isNaN(basis.getTime()) ? new Date() : basis;
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `INV-${party.id}-${yy}${mm}`;
}

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
    detail: `${l.quantity} × ${money(l.unit_price || 0)}${unitSuffix(l.unit)}`,
    amount: lineAmount(l, inputs.guest_count, inputs.room_hours),
    notes: l.notes,
  }));

  return { foodTotal, drinkTotal, gratuity, subtotal, roomTotal, addons, grandTotal, packageLines };
}

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
    for (const l of b.packageLines) {
      out.push(`  - ${l.name} (${l.detail}) = ${money(l.amount)}`);
      if (l.notes?.trim()) out.push(`      ${l.notes.trim()}`);
    }
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

/** Escape user-provided text before it lands in printable HTML. */
function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Printable HTML invoice (opened in a new window for print / save-as-PDF). */
export function buildInvoiceHtml(party: Party, b: InvoiceBreakdown): string {
  const rawTitle = party.title?.trim() || `Private Event — ${party.contact_name}`;
  const title = esc(rawTitle);
  const gratuityPct = Math.round((party.gratuity_rate ?? 0.18) * 100);
  const invoiceNoRaw = getInvoiceNumber(party);
  const invoiceNo = invoiceNoRaw ? esc(invoiceNoRaw) : '';
  const row = (label: string, value: number, strong = false) =>
    `<tr${strong ? ' style="font-weight:700;border-top:2px solid #111;"' : ''}><td style="padding:6px 0;">${label}</td><td style="padding:6px 0;text-align:right;">${money(value)}</td></tr>`;
  const pkgRows = b.packageLines
    .map((l) => {
      const main = `<tr><td style="padding:4px 0;color:#444;">${esc(l.name)} <span style="color:#999;">(${esc(l.detail)})</span></td><td style="padding:4px 0;text-align:right;color:#444;">${money(l.amount)}</td></tr>`;
      const note = l.notes?.trim()
        ? `<tr><td colspan="2" style="padding:0 0 4px 0;color:#999;font-size:12px;font-style:italic;">${esc(l.notes.trim())}</td></tr>`
        : '';
      return main + note;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice — ${title}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;max-width:640px;margin:32px auto;padding:0 24px;}
  h1{font-size:20px;margin:0;}
  .muted{color:#777;font-size:13px;}
  table{width:100%;border-collapse:collapse;margin-top:18px;font-size:14px;}
  .head{border-bottom:2px solid #2dd4bf;padding-bottom:14px;margin-bottom:8px;}
  @media print{ @page{ margin:14mm; } body{ margin:0; max-width:100%; } }
</style></head><body>
  <div class="head" style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h1>Iggy's Bar in Seaside</h1>
      <div class="muted">200 S Franklin St, Seaside, OR 97138 · (503) 738-0672</div>
    </div>
    ${invoiceNo ? `<div class="muted" style="text-align:right;"><strong style="color:#111;">${invoiceNo}</strong></div>` : ''}
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
