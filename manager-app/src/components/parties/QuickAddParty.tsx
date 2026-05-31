import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { createParty } from '../../hooks/useParties';
import { findOrCreateContact } from '../../hooks/useContacts';
import { PARTY_PRESETS, DEFAULT_PRESET_ID } from '../../data/partyPresets';
import type { Party } from '../../types';

interface QuickAddPartyProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Dead-simple capture for on-the-fly bookings: just a name + date to start.
 * Picking a type pre-fills sensible defaults. Everything else is enriched later.
 */
export function QuickAddParty({ open, onClose }: QuickAddPartyProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(''); setDate(''); setPresetId(DEFAULT_PRESET_ID); };

  const handleSave = async (mode: 'open' | 'again') => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const preset = PARTY_PRESETS.find((p) => p.id === presetId);
    const contactId = await findOrCreateContact({ name: name.trim() });
    const payload: Partial<Party> = {
      status: 'inquiry',
      contact_id: contactId,
      contact_name: name.trim(),
      event_date: date || null,
      ...(preset?.defaults ?? {}),
      title: preset && preset.id !== 'custom' ? `${preset.label} — ${name.trim()}` : null,
    };
    const created = await createParty(payload);
    setSaving(false);
    if (created) {
      reset();
      if (mode === 'open') {
        onClose();
        navigate(`/parties/${created.id}`);
      }
      // mode === 'again': keep the modal open for rapid back-to-back capture
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick add a party" maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-text-muted">Just a name and date to start — fill in the rest whenever you have a moment.</p>

        <div>
          <label className="label">Who's it for? *</label>
          <input
            className="input-field text-base"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Maria Lopez"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave('open'); }}
          />
        </div>

        <div>
          <label className="label">Date</label>
          <input type="date" className="input-field text-base" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div>
          <label className="label">Type <span className="text-text-muted font-normal">(sets sensible defaults)</span></label>
          <div className="flex flex-wrap gap-2">
            {PARTY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                className={`px-3 py-2 rounded-full text-sm border min-h-[44px] transition-colors ${
                  presetId === p.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface border-border text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button onClick={() => handleSave('open')} disabled={saving || !name.trim()} className="btn-primary w-full min-h-[48px]">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />} Save &amp; open details
          </button>
          <button onClick={() => handleSave('again')} disabled={saving || !name.trim()} className="btn-secondary w-full min-h-[48px]">
            <Plus size={16} /> Save &amp; add another
          </button>
        </div>
      </div>
    </Modal>
  );
}
