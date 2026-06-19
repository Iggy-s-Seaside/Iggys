import { useId, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  Ban,
  AlertTriangle,
  Star,
  Wrench,
  StickyNote,
  Search,
  Send,
  Camera,
  Loader2,
  X,
  CheckCircle2,
  Circle,
  Trash2,
  ClipboardList,
  Undo2,
} from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useShiftLog } from '../hooks/useShiftLog';
import { useImageUpload } from '../hooks/useImageUpload';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import type { ShiftLogEntry, ShiftLogTag } from '../types';
import toast from 'react-hot-toast';

const TAGS: {
  value: ShiftLogTag;
  label: string;
  icon: typeof StickyNote;
  /** chip + dot color when selected/active */
  active: string;
  /** small accent for feed markers */
  dot: string;
}[] = [
  { value: 'note', label: 'Note', icon: StickyNote, active: 'bg-primary text-white', dot: 'text-primary' },
  { value: '86', label: '86', icon: Ban, active: 'bg-danger text-white', dot: 'text-danger' },
  { value: 'incident', label: 'Incident', icon: AlertTriangle, active: 'bg-danger text-white', dot: 'text-danger' },
  { value: 'vip', label: 'VIP', icon: Star, active: 'bg-accent text-white', dot: 'text-accent' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, active: 'bg-accent text-white', dot: 'text-accent' },
];

const TAG_META = Object.fromEntries(TAGS.map((t) => [t.value, t])) as Record<
  ShiftLogTag,
  (typeof TAGS)[number]
>;

/** Whether a tag represents something that can be "resolved". */
function isResolvable(tag: ShiftLogTag) {
  return tag === 'incident' || tag === 'maintenance';
}

function fmtTime(iso: string): string {
  try {
    const d = parseISO(iso);
    const t = format(d, 'h:mm a');
    if (isToday(d)) return t;
    if (isYesterday(d)) return `Yesterday ${t}`;
    return format(d, 'MMM d, h:mm a');
  } catch {
    return iso;
  }
}

interface ShiftLogProps {
  /** Scope to a shift (logical shift_sessions.id). Omitted = standalone. */
  shiftId?: number | null;
}

export function ShiftLog({ shiftId }: ShiftLogProps = {}) {
  const {
    entries,
    menuItems,
    eightySixedItems,
    loading,
    add,
    toggleResolved,
    remove,
    eightySix,
    unEightySix,
    filter,
  } = useShiftLog(shiftId);
  const { upload, uploading } = useImageUpload();
  const { user } = useAuth();
  const confirm = useConfirm();

  // Composer state
  const [tag, setTag] = useState<ShiftLogTag>('note');
  const [body, setBody] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [filterTag, setFilterTag] = useState<ShiftLogTag | null>(null);
  const [search, setSearch] = useState('');

  // 86 picker
  const [eightySixOpen, setEightySixOpen] = useState(false);

  const visible = useMemo(
    () => filter({ tag: filterTag, search }),
    [filter, filterTag, search]
  );

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.tag] = (counts[e.tag] ?? 0) + 1;
    return counts;
  }, [entries]);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const url = await upload(file, 'shift-log');
    if (url) setPhotoUrl(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && !photoUrl) {
      toast.error('Add a note or a photo first');
      return;
    }
    setSubmitting(true);
    const ok = await add({ tag, body, photoUrl, shiftId });
    setSubmitting(false);
    if (ok) {
      setBody('');
      setPhotoUrl(null);
      setTag('note');
    }
  };

  const handleDelete = async (entry: ShiftLogEntry) => {
    const ok = await confirm({
      title: 'Delete entry',
      message: 'Delete this entry? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await remove(entry.id);
  };

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Shift Log</h1>
          <span className="badge text-text-muted">{entries.length}</span>
          {eightySixedItems.length > 0 && (
            <span className="badge-danger flex items-center gap-1">
              <Ban size={12} />
              {eightySixedItems.length} 86'd
            </span>
          )}
        </div>
        <p className="text-sm text-text-muted mt-1">
          What happened on the floor — tag it, find it later.
        </p>
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="card p-4 mb-5 space-y-3">
        {/* Tag chips */}
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => {
            const Icon = t.icon;
            const selected = tag === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTag(t.value)}
                aria-pressed={selected}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                  selected
                    ? t.active
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        <textarea
          className="input-field"
          rows={2}
          placeholder={
            tag === 'vip'
              ? "Who's in? Table, name, who's looking after them…"
              : tag === 'incident'
              ? 'What happened? Who was involved?'
              : tag === 'maintenance'
              ? "What's broken / needs fixing?"
              : "What's going on?"
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {/* Photo preview */}
        {photoUrl && (
          <div className="relative inline-block">
            <img
              src={photoUrl}
              alt="Attached"
              className="h-24 w-24 object-cover rounded-lg border border-border"
            />
            <button
              type="button"
              onClick={() => setPhotoUrl(null)}
              className="absolute -top-2 -right-2 p-1 rounded-full bg-surface border border-border text-text-muted hover:text-danger"
              aria-label="Remove photo"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhoto}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-secondary flex items-center gap-2 min-h-[44px]"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={18} />}
            <span className="hidden sm:inline">Photo</span>
          </button>
          <button
            type="button"
            onClick={() => setEightySixOpen(true)}
            className="btn-secondary flex items-center gap-2 min-h-[44px]"
          >
            <Ban size={18} />
            <span className="hidden sm:inline">86 an item</span>
          </button>
          <div className="flex-1" />
          <button
            type="submit"
            disabled={submitting || (!body.trim() && !photoUrl)}
            className="btn-primary flex items-center gap-2 min-h-[44px]"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Post
          </button>
        </div>
        {user?.email && (
          <p className="text-xs text-text-muted">Posting as {user.email.split('@')[0]}</p>
        )}
      </form>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-field pl-9 w-full"
            placeholder="Search the log…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilterTag(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-h-[40px] ${
              filterTag === null
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-secondary hover:text-text-primary'
            }`}
          >
            All
          </button>
          {TAGS.map((t) => {
            const Icon = t.icon;
            const selected = filterTag === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setFilterTag(selected ? null : t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-h-[40px] ${
                  selected
                    ? t.active
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon size={14} />
                {t.label}
                {tagCounts[t.value] ? (
                  <span className="text-xs opacity-70">{tagCounts[t.value]}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={search || filterTag ? 'Nothing matches your filters' : 'Nothing logged yet'}
          description={
            search || filterTag
              ? 'Try clearing the search or tag filter.'
              : 'Tag the first thing that happens on this shift.'
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((entry) => {
            const meta = TAG_META[entry.tag] ?? TAG_META.note;
            const Icon = meta.icon;
            const resolvable = isResolvable(entry.tag);
            return (
              <div
                key={entry.id}
                className={`card p-4 ${entry.resolved ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 ${meta.dot}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${meta.dot}`}
                      >
                        {meta.label}
                      </span>
                      {entry.item_ref && (
                        <span className="badge-primary">{entry.item_ref}</span>
                      )}
                      {entry.resolved && (
                        <span className="badge-success flex items-center gap-1">
                          <CheckCircle2 size={11} /> Resolved
                        </span>
                      )}
                      <span className="text-xs text-text-muted ml-auto">
                        {fmtTime(entry.created_at)}
                      </span>
                    </div>
                    {entry.body && (
                      <p
                        className={`text-sm whitespace-pre-wrap ${
                          entry.resolved
                            ? 'text-text-muted'
                            : 'text-text-primary'
                        }`}
                      >
                        {entry.body}
                      </p>
                    )}
                    {entry.photo_url && (
                      <a
                        href={entry.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2"
                      >
                        <img
                          src={entry.photo_url}
                          alt="Log photo"
                          className="h-28 w-28 object-cover rounded-lg border border-border"
                        />
                      </a>
                    )}
                    <div className="flex items-center gap-1 mt-2 -ml-2">
                      {resolvable && (
                        <button
                          onClick={() => toggleResolved(entry.id, !entry.resolved)}
                          className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs text-text-muted hover:text-primary hover:bg-surface-hover transition-colors min-h-[40px]"
                        >
                          {entry.resolved ? (
                            <>
                              <Circle size={14} /> Reopen
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} /> Mark resolved
                            </>
                          )}
                        </button>
                      )}
                      {entry.author && (
                        <span className="text-xs text-text-muted px-2">
                          {entry.author.split('@')[0]}
                        </span>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={() => handleDelete(entry)}
                        className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-red-500/10 transition-colors min-h-[40px]"
                        aria-label="Delete entry"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 86 picker sheet */}
      <EightySixSheet
        open={eightySixOpen}
        onClose={() => setEightySixOpen(false)}
        menuItems={menuItems}
        eightySixedItems={eightySixedItems}
        onEightySix={async (item, note) => {
          const ok = await eightySix({ name: item.name, menuItemId: item.id, note });
          if (ok) setEightySixOpen(false);
        }}
        onUnEightySix={async (id) => {
          await unEightySix(id);
        }}
      />
    </div>
  );
}

// ── 86 picker bottom sheet ──

interface EightySixSheetProps {
  open: boolean;
  onClose: () => void;
  menuItems: { id: number; name: string; is_86d: boolean }[];
  eightySixedItems: { id: number; name: string; is_86d: boolean }[];
  onEightySix: (item: { id: number; name: string }, note: string) => Promise<void>;
  onUnEightySix: (id: number) => Promise<void>;
}

function EightySixSheet({
  open,
  onClose,
  menuItems,
  eightySixedItems,
  onEightySix,
  onUnEightySix,
}: EightySixSheetProps) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const pickItemId = useId();

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menuItems
      .filter((m) => !m.is_86d)
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true))
      .slice(0, 50);
  }, [menuItems, query]);

  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef, { onEscape: onClose });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative bg-surface border border-border rounded-t-2xl sm:rounded-xl shadow-lg w-full sm:max-w-md max-h-[85dvh] flex flex-col pb-[max(0px,env(safe-area-inset-bottom,0px))] focus:outline-none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id={titleId} className="font-semibold text-text-primary flex items-center gap-2">
            <Ban size={18} className="text-danger" /> 86 an item
          </h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-surface-hover"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto overscroll-contain">
          {/* Currently 86'd — quick un-86 */}
          {eightySixedItems.length > 0 && (
            <div>
              <p className="label">Currently 86'd</p>
              <div className="flex flex-wrap gap-2">
                {eightySixedItems.map((m) => (
                  <button
                    key={m.id}
                    onClick={async () => {
                      setBusyId(m.id);
                      await onUnEightySix(m.id);
                      setBusyId(null);
                    }}
                    disabled={busyId === m.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-danger/10 text-danger hover:bg-danger/20 transition-colors min-h-[44px]"
                    title="Put back on the menu"
                  >
                    {busyId === m.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Undo2 size={14} />
                    )}
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Field label="Reason (optional)">
            <input
              className="input-field"
              placeholder="Out of stock, equipment down…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>

          <div>
            <label className="label" htmlFor={pickItemId}>Pick an item</label>
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                id={pickItemId}
                className="input-field pl-9"
                placeholder="Search menu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {menuItems.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                No menu items loaded.
              </p>
            ) : available.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                {query ? 'No matches.' : 'Everything is already 86’d.'}
              </p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {available.map((m) => (
                  <button
                    key={m.id}
                    onClick={async () => {
                      setBusyId(m.id);
                      await onEightySix({ id: m.id, name: m.name }, note);
                      setBusyId(null);
                    }}
                    disabled={busyId === m.id}
                    className="w-full flex items-center justify-between gap-2 px-3 py-3 rounded-lg text-left text-sm text-text-primary hover:bg-surface-hover transition-colors min-h-[48px]"
                  >
                    <span className="truncate">{m.name}</span>
                    {busyId === m.id ? (
                      <Loader2 size={16} className="animate-spin text-text-muted shrink-0" />
                    ) : (
                      <Ban size={16} className="text-danger shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
