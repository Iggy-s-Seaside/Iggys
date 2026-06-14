import { useMemo, useState, type FormEvent } from 'react';
import { Star, Loader2, Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';
import Select from '../ui/Select';
import type { ReviewSource } from '../../types';
import type { AddReviewInput } from '../../hooks/useReviews';

interface AddReviewModalProps {
  open: boolean;
  onClose: () => void;
  /** Loaded review_sources (Google/Yelp/Facebook/Manual) — drives the source picker. */
  sources: ReviewSource[];
  onAdd: (input: AddReviewInput) => Promise<boolean>;
}

/** Today's date as a yyyy-mm-dd string for the <input type="date"> default. */
function todayISODate(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

/**
 * Manual "Add review" modal. Lets the owner log a review they spotted on a
 * platform (or a freeform note) until live sync is wired. Mirrors the public
 * Feedback star picker for the rating, and reuses Modal / Field / Select.
 */
export function AddReviewModal({ open, onClose, sources, onAdd }: AddReviewModalProps) {
  const [source, setSource] = useState<string | null>(null);
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [date, setDate] = useState(todayISODate);
  const [saving, setSaving] = useState(false);

  // Build the source options from what's loaded; fall back to the canonical set
  // so the picker is never empty even if review_sources hasn't been seeded.
  const sourceOptions = useMemo(() => {
    const fromDb = sources
      .filter((s) => s.active !== false)
      .map((s) => ({ value: s.key, label: s.label || s.key }));
    if (fromDb.length > 0) return fromDb;
    return [
      { value: 'google', label: 'Google' },
      { value: 'yelp', label: 'Yelp' },
      { value: 'facebook', label: 'Facebook' },
      { value: 'manual', label: 'Manual' },
    ];
  }, [sources]);

  const reset = () => {
    setSource(null);
    setAuthor('');
    setRating(0);
    setHover(0);
    setBody('');
    setUrl('');
    setDate(todayISODate());
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const canSave = !!source && rating >= 1 && rating <= 5 && !saving;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || !source) return;
    setSaving(true);
    // Anchor the chosen date to local noon so the stored UTC timestamp lands on
    // the same calendar day regardless of timezone.
    const createdAt = date ? new Date(`${date}T12:00:00`).toISOString() : undefined;
    const ok = await onAdd({
      source,
      author: author || null,
      rating,
      body: body || null,
      url: url || null,
      created_at: createdAt,
    });
    setSaving(false);
    if (ok) close();
  };

  return (
    <Modal open={open} onClose={close} title="Add review">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Source" required id="add-review-source">
          {({ id }) => (
            <Select
              id={id}
              variant="manager"
              placeholder="Where is this review from?"
              options={sourceOptions}
              value={source}
              onChange={(v) => setSource(v)}
            />
          )}
        </Field>

        <Field label="Author (optional)">
          <input
            className="input-field"
            placeholder="Reviewer name"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </Field>

        {/* Star rating — mirrors the public Feedback page pattern */}
        <div>
          <label className="label">
            Rating
            <span className="text-danger ml-0.5" aria-hidden="true">*</span>
          </label>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                className="p-1 -m-0.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Star
                  size={28}
                  className={
                    n <= (hover || rating)
                      ? 'text-accent fill-accent'
                      : 'text-text-muted'
                  }
                />
              </button>
            ))}
          </div>
        </div>

        <Field label="Review text (optional)">
          <textarea
            className="input-field min-h-[96px] resize-y"
            placeholder="What did they say?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>

        <Field label="Link (optional)" hint="Deep link back to the review on the platform.">
          <input
            type="url"
            inputMode="url"
            className="input-field"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>

        <Field label="Date">
          <input
            type="date"
            className="input-field"
            value={date}
            max={todayISODate()}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={close} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={!canSave} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {saving ? 'Adding…' : 'Add review'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default AddReviewModal;
