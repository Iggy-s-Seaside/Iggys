import { useState } from 'react';
import { Loader2, Printer, Send, Save, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Party, PartyPackage } from '../../types';
import { computeInvoice, partyToInvoiceInputs, buildInvoiceText, buildInvoiceHtml } from '../../utils/invoice';
import { sendPartyEmail } from '../../lib/partyActions';

interface InvoicePanelProps {
  party: Party;
  lines: PartyPackage[];
  onSave: (fields: Partial<Party>) => Promise<boolean>;
}

const money = (n: number) => `$${(n || 0).toFixed(2)}`;

export function InvoicePanel({ party, lines, onSave }: InvoicePanelProps) {
  const [roomRate, setRoomRate] = useState(String(party.room_rate ?? 200));
  const [roomHours, setRoomHours] = useState(String(party.room_hours ?? 0));
  const [foodTotal, setFoodTotal] = useState(String(party.food_total ?? 0));
  const [drinkTotal, setDrinkTotal] = useState(String(party.drink_total ?? 0));
  const [gratuityPct, setGratuityPct] = useState(String(Math.round((party.gratuity_rate ?? 0.18) * 100)));
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // A party object reflecting the current (possibly unsaved) inputs, for live totals + print/email.
  const previewParty: Party = {
    ...party,
    room_rate: parseFloat(roomRate) || 0,
    room_hours: parseFloat(roomHours) || 0,
    food_total: parseFloat(foodTotal) || 0,
    drink_total: parseFloat(drinkTotal) || 0,
    gratuity_rate: (parseFloat(gratuityPct) || 0) / 100,
  };
  const breakdown = computeInvoice(partyToInvoiceInputs(previewParty), lines);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave({
      room_rate: previewParty.room_rate,
      room_hours: previewParty.room_hours,
      food_total: previewParty.food_total,
      drink_total: previewParty.drink_total,
      gratuity_rate: previewParty.gratuity_rate,
    });
    if (ok) toast.success('Invoice saved');
    setSaving(false);
  };

  const handlePrint = () => {
    const html = buildInvoiceHtml(previewParty, breakdown);
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) {
      toast.error('Pop-up blocked — allow pop-ups to print.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const handleEmail = async () => {
    if (!party.contact_email) {
      toast.error('No email on file for this contact.');
      return;
    }
    setSending(true);
    try {
      await sendPartyEmail({
        to: party.contact_email,
        subject: `Invoice — ${party.title?.trim() || party.contact_name}`,
        body: buildInvoiceText(previewParty, breakdown),
        partyId: party.id,
        kind: 'general',
      });
      toast.success(`Invoice emailed to ${party.contact_email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to email invoice');
    }
    setSending(false);
  };

  const totalRow = (label: string, value: number, opts?: { strong?: boolean; muted?: boolean }) => (
    <div className={`flex items-center justify-between py-1.5 ${opts?.strong ? 'border-t border-border mt-1 pt-2.5 text-base font-bold text-text-primary' : ''}`}>
      <span className={opts?.muted ? 'text-sm text-text-muted' : 'text-sm text-text-secondary'}>{label}</span>
      <span className={opts?.strong ? '' : 'text-sm font-medium text-text-primary'}>{money(value)}</span>
    </div>
  );

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Receipt size={14} /> Invoice
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="label">Food total ($)</label>
          <input type="number" min="0" step="any" className="input-field" value={foodTotal}
            onChange={(e) => setFoodTotal(e.target.value)} />
        </div>
        <div>
          <label className="label">Drink total ($)</label>
          <input type="number" min="0" step="any" className="input-field" value={drinkTotal}
            onChange={(e) => setDrinkTotal(e.target.value)} />
        </div>
        <div>
          <label className="label">Gratuity (%)</label>
          <input type="number" min="0" step="any" className="input-field" value={gratuityPct}
            onChange={(e) => setGratuityPct(e.target.value)} />
        </div>
        <div>
          <label className="label">Room rate ($/hr)</label>
          <input type="number" min="0" step="any" className="input-field" value={roomRate}
            onChange={(e) => setRoomRate(e.target.value)} />
        </div>
        <div>
          <label className="label">Room hours</label>
          <input type="number" min="0" step="any" className="input-field" value={roomHours}
            onChange={(e) => setRoomHours(e.target.value)} />
        </div>
      </div>

      {breakdown.packageLines.length > 0 && (
        <div className="mb-3 rounded-lg bg-surface-hover/50 p-3">
          {breakdown.packageLines.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-0.5">
              <span className="text-text-secondary truncate pr-2">{l.name} <span className="text-text-muted">({l.detail})</span></span>
              <span className="text-text-primary font-medium shrink-0">{money(l.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        {totalRow('Food total', breakdown.foodTotal)}
        {totalRow('Drink total', breakdown.drinkTotal)}
        {totalRow(`Gratuity (${gratuityPct || 0}%)`, breakdown.gratuity)}
        {totalRow('Subtotal (food + drink + gratuity)', breakdown.subtotal, { muted: true })}
        {totalRow('Room total', breakdown.roomTotal)}
        {breakdown.addons > 0 && totalRow('Add-ons', breakdown.addons)}
        {totalRow('Grand total', breakdown.grandTotal, { strong: true })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save invoice
        </button>
        <button onClick={handlePrint} className="btn-secondary text-sm">
          <Printer size={15} /> Print / PDF
        </button>
        <button onClick={handleEmail} disabled={sending || !party.contact_email} className="btn-secondary text-sm"
          title={party.contact_email ? `Email to ${party.contact_email}` : 'No email on file'}>
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Email invoice
        </button>
      </div>
    </div>
  );
}
