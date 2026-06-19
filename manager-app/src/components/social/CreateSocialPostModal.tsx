import { useEffect, useMemo, useState } from 'react';
import { Instagram, Facebook, MapPin, Image as ImageIcon, Sparkles, Calendar, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useSupabaseCRUD } from '../../hooks/useSupabaseCRUD';
import { useSocialPosts, SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS, type SocialPlatform } from '../../hooks/useSocialPosts';
import type { Special, IggyEvent } from '../../types';

type SourceKind = 'special' | 'event';

interface CreateSocialPostModalProps {
  open: boolean;
  onClose: () => void;
  /** Optionally preselect a source row (e.g. opened from the Specials page). */
  preset?: { kind: SourceKind; id: number } | null;
  /** Called after a draft is successfully queued. */
  onCreated?: () => void;
}

const PLATFORM_ICONS: Record<SocialPlatform, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  google: MapPin,
};

/** Build a sensible starter caption from a special/event. */
function captionFromSpecial(s: Special): string {
  const parts = [s.title, s.description].filter(Boolean) as string[];
  const base = parts.join(' — ');
  return s.price ? `${base} · ${s.price}` : base;
}
function captionFromEvent(e: IggyEvent): string {
  const when = [e.date, e.time].filter(Boolean).join(' · ');
  const parts = [e.title, e.description].filter(Boolean) as string[];
  return when ? `${parts.join(' — ')}\n${when}` : parts.join(' — ');
}

export function CreateSocialPostModal({ open, onClose, preset, onCreated }: CreateSocialPostModalProps) {
  const { data: specials } = useSupabaseCRUD<Special>('specials');
  const { data: events } = useSupabaseCRUD<IggyEvent>('events');
  const { create } = useSocialPosts();

  const [kind, setKind] = useState<SourceKind>('special');
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(['instagram', 'facebook']);
  const [caption, setCaption] = useState('');
  const [schedule, setSchedule] = useState('');
  const [touchedCaption, setTouchedCaption] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedSpecial = useMemo(
    () => (kind === 'special' ? specials.find((s) => s.id === sourceId) ?? null : null),
    [kind, specials, sourceId],
  );
  const selectedEvent = useMemo(
    () => (kind === 'event' ? events.find((e) => e.id === sourceId) ?? null : null),
    [kind, events, sourceId],
  );

  const imageUrl = selectedSpecial?.image_url ?? selectedEvent?.image_url ?? null;
  const sourceList = kind === 'special' ? specials : events;

  // Apply a preset when the modal opens for a specific row.
  useEffect(() => {
    if (!open) return;
    if (preset) {
      setKind(preset.kind);
      setSourceId(preset.id);
    } else {
      setKind('special');
      setSourceId(null);
    }
    setPlatforms(['instagram', 'facebook']);
    setSchedule('');
    setTouchedCaption(false);
  }, [open, preset]);

  // Auto-fill the caption from the chosen source until the user edits it.
  useEffect(() => {
    if (touchedCaption) return;
    if (selectedSpecial) setCaption(captionFromSpecial(selectedSpecial));
    else if (selectedEvent) setCaption(captionFromEvent(selectedEvent));
    else setCaption('');
  }, [selectedSpecial, selectedEvent, touchedCaption]);

  const togglePlatform = (p: SocialPlatform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const switchKind = (k: SourceKind) => {
    setKind(k);
    setSourceId(null);
    setTouchedCaption(false);
  };

  const canSubmit = sourceId != null && platforms.length > 0 && caption.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit || sourceId == null) return;
    setSaving(true);
    const post = await create({
      source: kind,
      ref_id: sourceId,
      image_url: imageUrl,
      caption: caption.trim(),
      target_platforms: platforms,
      scheduled_at: schedule ? new Date(schedule).toISOString() : null,
      status: 'draft',
    });
    setSaving(false);
    if (post) {
      onCreated?.();
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Queue a social post" maxWidth="max-w-lg">
      <div className="space-y-5">
        {/* Source kind toggle */}
        <div className="flex gap-2">
          {([
            { k: 'special' as const, label: 'From a Special', Icon: Sparkles },
            { k: 'event' as const, label: 'From an Event', Icon: Calendar },
          ]).map(({ k, label, Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => switchKind(k)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium border transition-colors ${
                kind === k
                  ? 'border-primary bg-primary-50 text-primary-dark'
                  : 'border-border text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Source picker */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {kind === 'special' ? 'Special' : 'Event'}
          </label>
          <select
            value={sourceId ?? ''}
            onChange={(e) => {
              setSourceId(e.target.value ? Number(e.target.value) : null);
              setTouchedCaption(false);
            }}
            className="input-field"
          >
            <option value="">Choose a {kind}…</option>
            {sourceList.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
          </select>
          {sourceList.length === 0 && (
            <p className="text-xs text-text-muted mt-1.5">No {kind}s to choose from yet.</p>
          )}
        </div>

        {/* Image preview */}
        <div className="rounded-lg overflow-hidden border border-border bg-surface-hover">
          {imageUrl ? (
            <img src={imageUrl} alt="" loading="lazy" className="w-full h-44 object-cover" />
          ) : (
            <div className="w-full h-44 flex flex-col items-center justify-center text-text-muted gap-1.5">
              <ImageIcon size={28} />
              <span className="text-xs">{sourceId ? 'This item has no image' : 'Pick a source to preview its image'}</span>
            </div>
          )}
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Platforms</label>
          <div className="flex flex-wrap gap-2">
            {SOCIAL_PLATFORMS.map((p) => {
              const Icon = PLATFORM_ICONS[p];
              const on = platforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium border transition-colors ${
                    on
                      ? 'border-primary bg-primary-50 text-primary-dark'
                      : 'border-border text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {on ? <Check size={15} /> : <Icon size={15} />}
                  {SOCIAL_PLATFORM_LABELS[p]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Caption */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              setTouchedCaption(true);
            }}
            rows={4}
            placeholder="Write the caption shared across the selected platforms…"
            className="input-field resize-none"
          />
          <p className="text-xs text-text-muted mt-1.5">{caption.trim().length} characters</p>
        </div>

        {/* Optional schedule */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Schedule <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <input
            type="datetime-local"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="input-field"
          />
          <p className="text-xs text-text-muted mt-1.5">
            Leave blank to queue it for posting as soon as it's approved.
          </p>
        </div>

        {/* Safety note */}
        <p className="text-xs text-text-muted bg-surface-hover border border-border rounded-lg px-3 py-2.5">
          This adds a <span className="font-medium text-text-secondary">draft</span> to the queue. Nothing is
          posted until a human approves it — and live posting stays off until Meta App Review is complete.
        </p>

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={!canSubmit} className="btn-primary disabled:opacity-50">
            {saving ? 'Adding…' : 'Add to queue'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
