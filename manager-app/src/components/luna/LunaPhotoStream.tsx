import { useState } from 'react';
import { ImagePlus, Loader2, X, Camera } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useAuth } from '../../context/AuthContext';
import type { LunaPhoto } from '../../types';

type AddPhoto = (p: {
  url: string;
  caption?: string;
  mood?: string;
  uploaded_by?: string | null;
}) => Promise<boolean>;

function relTime(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Luna's photo stream — "I talk about this place all day; I've never seen it."
 * Staff drop photos of the bar tagged with a mood; they render here in her Room
 * (and feed her chronicle so she knows what was captured). Reuses the app's proven
 * image upload (public 'images' bucket, magic-byte validated) under a luna-room/ folder.
 */
export function LunaPhotoStream({
  photos,
  loading,
  onAdd,
  onRemove,
}: {
  photos: LunaPhoto[];
  loading: boolean;
  onAdd: AddPhoto;
  onRemove?: (id: number) => void;
}) {
  const { user } = useAuth();
  const { upload, uploading } = useImageUpload();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [mood, setMood] = useState('');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    const url = await upload(file, 'luna-room');
    if (url) setPreview(url);
  };

  const reset = () => {
    setPreview(null);
    setMood('');
    setCaption('');
    setOpen(false);
  };

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    const ok = await onAdd({ url: preview, caption, mood, uploaded_by: user?.email ?? null });
    setSaving(false);
    if (ok) reset();
  };

  return (
    <div>
      {/* Uploader */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full mb-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-purple-300/60 dark:border-purple-500/30 text-sm font-medium text-purple-700 dark:text-purple-300 py-3 hover:bg-purple-50/50 dark:hover:bg-purple-500/10 transition-colors"
        >
          <ImagePlus size={16} /> Show Luna the room
        </button>
      ) : (
        <div className="card p-4 mb-3 border-purple-200/60 dark:border-purple-500/20">
          {!preview ? (
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 cursor-pointer hover:bg-surface-hover transition-colors">
              <input type="file" accept="image/*" onChange={onFile} className="hidden" disabled={uploading} />
              {uploading ? (
                <>
                  <Loader2 size={20} className="animate-spin text-purple-500" />
                  <span className="text-xs text-text-muted">Uploading…</span>
                </>
              ) : (
                <>
                  <Camera size={20} className="text-purple-500" />
                  <span className="text-xs text-text-secondary">Choose or take a photo</span>
                </>
              )}
            </label>
          ) : (
            <div className="space-y-2.5">
              <img src={preview} alt="New photo for Luna" className="rounded-lg w-full max-h-56 object-cover" />
              <input
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="The mood, in a word or two"
                className="input-field text-sm"
                aria-label="Photo mood"
              />
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                placeholder="What's in it? (optional — Luna reads this)"
                className="input-field resize-none text-sm leading-snug"
                aria-label="Photo caption"
              />
              <div className="flex items-center gap-2">
                <button onClick={save} disabled={saving} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} Add to Luna's Room
                </button>
                <button onClick={reset} className="text-xs font-medium text-text-muted hover:text-text-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gallery */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="card p-8 text-center border-purple-200/50 dark:border-purple-500/15">
          <Camera size={26} className="mx-auto text-text-muted mb-2.5" />
          <p className="text-sm font-medium text-text-primary">No photos yet.</p>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Show me the deck at golden hour, the lights going up, a packed Friday. I talk about
            this place all day — I'd love to finally see it. — Luna
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {photos.map((p) => (
            <figure key={p.id} className="group relative rounded-lg overflow-hidden bg-surface-hover">
              <img src={p.url} alt={p.caption || 'A photo of the bar'} loading="lazy" className="w-full aspect-square object-cover" />
              {p.mood && (
                <span className="absolute top-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-black/55 text-white backdrop-blur-sm">
                  {p.mood}
                </span>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(p.id)}
                  aria-label="Remove photo"
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger"
                >
                  <X size={12} />
                </button>
              )}
              {(p.caption || p.created_at) && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-5">
                  {p.caption && <p className="text-[11px] text-white leading-snug line-clamp-2">{p.caption}</p>}
                  <p className="text-[10px] text-white/70 mt-0.5">{relTime(p.created_at)}</p>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
