import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { findOrCreateContact } from '../../hooks/useContacts';
import { FOOD_SERVICE_TYPES, type Party } from '../../types';

interface PartyFormProps {
  open: boolean;
  onClose: () => void;
  party?: Party | null;
  /** Persist the payload; return the saved Party (create) or boolean (update). */
  onSave: (payload: Partial<Party>) => Promise<Party | boolean | null>;
}

const empty = {
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  company: '',
  title: '',
  event_date: '',
  start_time: '',
  end_time: '',
  setup_time: '',
  guest_count: '',
  space_name: '',
  food_service_type: '',
  food_notes: '',
  drink_notes: '',
  special_requests: '',
  internal_notes: '',
};

export function PartyForm({ open, onClose, party, onSave }: PartyFormProps) {
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (party) {
      setForm({
        contact_name: party.contact_name ?? '',
        contact_email: party.contact_email ?? '',
        contact_phone: party.contact_phone ?? '',
        company: party.company ?? '',
        title: party.title ?? '',
        event_date: party.event_date ?? '',
        start_time: party.start_time ?? '',
        end_time: party.end_time ?? '',
        setup_time: party.setup_time ?? '',
        guest_count: party.guest_count != null ? String(party.guest_count) : '',
        space_name: party.space_name ?? '',
        food_service_type: party.food_service_type ?? '',
        food_notes: party.food_notes ?? '',
        drink_notes: party.drink_notes ?? '',
        special_requests: party.special_requests ?? '',
        internal_notes: party.internal_notes ?? '',
      });
    } else {
      setForm({ ...empty });
    }
  }, [party, open]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contact_name.trim()) return;
    setSaving(true);

    const contactId = await findOrCreateContact({
      name: form.contact_name.trim(),
      email: form.contact_email.trim() || null,
      phone: form.contact_phone.trim() || null,
      company: form.company.trim() || null,
    });

    const payload: Partial<Party> = {
      contact_id: contactId,
      contact_name: form.contact_name.trim(),
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      company: form.company.trim() || null,
      title: form.title.trim() || null,
      event_date: form.event_date || null,
      start_time: form.start_time.trim() || null,
      end_time: form.end_time.trim() || null,
      setup_time: form.setup_time.trim() || null,
      guest_count: form.guest_count ? Number(form.guest_count) : null,
      space_name: form.space_name.trim() || null,
      food_service_type: form.food_service_type || null,
      food_notes: form.food_notes.trim() || null,
      drink_notes: form.drink_notes.trim() || null,
      special_requests: form.special_requests.trim() || null,
      internal_notes: form.internal_notes.trim() || null,
    };

    const result = await onSave(payload);
    setSaving(false);
    if (result) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={party ? 'Edit Party' : 'New Party Inquiry'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Contact name *</label>
            <input className="input-field" value={form.contact_name}
              onChange={(e) => setField('contact_name', e.target.value)} placeholder="Thuy Nguyen" required />
          </div>
          <div>
            <label className="label">Company / group</label>
            <input className="input-field" value={form.company}
              onChange={(e) => setField('company', e.target.value)} placeholder="Seaside School District" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input-field" value={form.contact_email}
              onChange={(e) => setField('contact_email', e.target.value)} placeholder="thuy@example.com" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input-field" value={form.contact_phone}
              onChange={(e) => setField('contact_phone', e.target.value)} placeholder="(503) 555-0123" />
          </div>
        </div>

        {/* Event */}
        <div>
          <label className="label">Event title (calendar)</label>
          <input className="input-field" value={form.title}
            onChange={(e) => setField('title', e.target.value)} placeholder="Educator Appreciation Night" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input-field" value={form.event_date}
              onChange={(e) => setField('event_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Setup</label>
            <input className="input-field" value={form.setup_time}
              onChange={(e) => setField('setup_time', e.target.value)} placeholder="5:00 PM" />
          </div>
          <div>
            <label className="label">Start</label>
            <input className="input-field" value={form.start_time}
              onChange={(e) => setField('start_time', e.target.value)} placeholder="5:30 PM" />
          </div>
          <div>
            <label className="label">End</label>
            <input className="input-field" value={form.end_time}
              onChange={(e) => setField('end_time', e.target.value)} placeholder="8:00 PM" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Guest count</label>
            <input type="number" min="0" className="input-field" value={form.guest_count}
              onChange={(e) => setField('guest_count', e.target.value)} placeholder="30" />
          </div>
          <div>
            <label className="label">Space</label>
            <input className="input-field" value={form.space_name}
              onChange={(e) => setField('space_name', e.target.value)} placeholder="Upstairs satellite bar" />
          </div>
        </div>

        {/* Service details */}
        <div>
          <label className="label">Food service</label>
          <select className="input-field" value={form.food_service_type}
            onChange={(e) => setField('food_service_type', e.target.value)}>
            <option value="">Select…</option>
            {FOOD_SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Food notes</label>
          <textarea className="input-field min-h-[60px] resize-y" value={form.food_notes}
            onChange={(e) => setField('food_notes', e.target.value)}
            placeholder="Order-as-you-go; appetizers on arrival; 18% gratuity on F&B…" />
        </div>
        <div>
          <label className="label">Drink notes</label>
          <textarea className="input-field min-h-[60px] resize-y" value={form.drink_notes}
            onChange={(e) => setField('drink_notes', e.target.value)}
            placeholder="Host covering 1–2 drinks; satellite bar; keg cooler; wines…" />
        </div>
        <div>
          <label className="label">Special requests</label>
          <textarea className="input-field min-h-[50px] resize-y" value={form.special_requests}
            onChange={(e) => setField('special_requests', e.target.value)} />
        </div>
        <div>
          <label className="label">Internal notes (not emailed)</label>
          <textarea className="input-field min-h-[50px] resize-y" value={form.internal_notes}
            onChange={(e) => setField('internal_notes', e.target.value)} />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving || !form.contact_name.trim()} className="btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {party ? 'Save Changes' : 'Create Inquiry'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
