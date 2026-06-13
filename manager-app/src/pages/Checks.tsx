import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  Sun,
  Moon,
  ShieldAlert,
  Thermometer,
  CheckCircle2,
  Circle,
  Camera,
  Loader2,
  ImageOff,
  AlertTriangle,
  ListChecks,
  ChevronLeft,
} from 'lucide-react';
import {
  useChecklistTemplates,
  useChecklistRun,
  useLineCheckTemplates,
  useLineCheckRun,
  useCurrentShiftId,
  isInRange,
  type ChecklistTemplateWithItems,
  type LineCheckTemplateWithItems,
} from '../hooks/useChecklists';
import { useAuth } from '../context/AuthContext';
import type { ChecklistKind, ChecklistTemplateItem, LineCheckTemplateItem } from '../types';

type TabKey = ChecklistKind | 'line';

const TABS: { key: TabKey; label: string; icon: typeof Sun }[] = [
  { key: 'opening', label: 'Opening', icon: Sun },
  { key: 'closing', label: 'Closing', icon: Moon },
  { key: 'safety', label: 'Safety', icon: ShieldAlert },
  { key: 'line', label: 'Line Check', icon: Thermometer },
];

// ════════════════════════════════════════════════════════════
// Checklist item row — big tap target, photo proof, note
// ════════════════════════════════════════════════════════════

function ChecklistItemRow({
  item,
  checked,
  photoUrl,
  note,
  busy,
  onToggle,
  onPhoto,
  onClearPhoto,
  onNote,
}: {
  item: ChecklistTemplateItem;
  checked: boolean;
  photoUrl: string | null;
  note: string | null;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onPhoto: (file: File) => void;
  onClearPhoto: () => void;
  onNote: (note: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState(note ?? '');
  const photoMissing = item.requires_photo && checked && !photoUrl;

  return (
    <div className={`p-4 ${photoMissing ? 'bg-danger/5' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Big checkbox — glove-friendly tap target */}
        <button
          onClick={() => onToggle(!checked)}
          disabled={busy}
          className="shrink-0 -m-1 p-1 active:scale-95 transition-transform disabled:opacity-50"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label={checked ? 'Uncheck item' : 'Check item'}
        >
          {checked ? (
            <CheckCircle2 size={32} className="text-primary" />
          ) : (
            <Circle size={32} className="text-text-muted" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button
            onClick={() => onToggle(!checked)}
            disabled={busy}
            className="text-left w-full"
          >
            <p className={`text-base font-medium ${checked ? 'text-text-muted line-through' : 'text-text-primary'}`}>
              {item.label}
            </p>
          </button>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {item.requires_photo && (
              <span
                className={`badge flex items-center gap-1 ${photoMissing ? 'badge-danger' : photoUrl ? 'badge-success' : 'text-text-muted'}`}
              >
                <Camera size={11} />
                {photoUrl ? 'Photo added' : 'Photo required'}
              </span>
            )}

            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              {photoUrl ? 'Replace photo' : 'Add photo'}
            </button>

            {photoUrl && (
              <button
                onClick={onClearPhoto}
                disabled={busy}
                className="text-xs text-text-muted hover:text-danger flex items-center gap-1 disabled:opacity-50"
              >
                <ImageOff size={13} /> Remove
              </button>
            )}

            {!editingNote && (
              <button
                onClick={() => {
                  setDraftNote(note ?? '');
                  setEditingNote(true);
                }}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                {note ? 'Edit note' : 'Add note'}
              </button>
            )}
          </div>

          {photoUrl && (
            <img
              src={photoUrl}
              alt={`${item.label} proof`}
              className="mt-3 h-28 w-auto rounded-lg border border-border object-cover"
            />
          )}

          {note && !editingNote && (
            <p className="mt-2 text-xs text-text-secondary whitespace-pre-wrap">{note}</p>
          )}

          {editingNote && (
            <div className="mt-2 space-y-2">
              <textarea
                className="input-field text-sm"
                rows={2}
                placeholder="Note (optional)…"
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onNote(draftNote.trim());
                    setEditingNote(false);
                  }}
                  className="btn-primary !py-1.5 !px-4 text-xs"
                >
                  Save note
                </button>
                <button
                  onClick={() => setEditingNote(false)}
                  className="btn-secondary !py-1.5 !px-4 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPhoto(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Checklist panel (one per template)
// ════════════════════════════════════════════════════════════

function ChecklistPanel({
  template,
  shiftId,
  completedBy,
}: {
  template: ChecklistTemplateWithItems;
  shiftId: number | null;
  completedBy: string | null;
}) {
  const {
    run,
    byItemId,
    loading,
    starting,
    uploading,
    total,
    checkedCount,
    percent,
    canComplete,
    startRun,
    setItem,
    completeRun,
  } = useChecklistRun(template, shiftId, completedBy);

  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const completed = !!run?.completed_at;

  const withBusy = async (itemId: number, fn: () => Promise<unknown>) => {
    setBusyItem(itemId);
    await fn();
    setBusyItem(null);
  };

  if (loading) {
    return (
      <div className="card p-12 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="card p-10 text-center">
        <ListChecks size={40} className="mx-auto text-text-muted mb-3" />
        <p className="text-text-secondary font-medium">{template.name}</p>
        <p className="text-sm text-text-muted mt-1 mb-5">
          {total} item{total === 1 ? '' : 's'} to work through.
        </p>
        <button
          onClick={() => startRun()}
          disabled={starting}
          className="btn-primary inline-flex items-center gap-2"
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
          Start checklist
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Completion bar */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text-primary">
            {checkedCount} of {total} done
          </span>
          <span className={`text-sm font-bold tabular-nums ${percent === 100 ? 'text-success' : 'text-text-secondary'}`}>
            {percent}%
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-surface-hover overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${percent === 100 ? 'bg-success' : 'bg-primary'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="card divide-y divide-border overflow-hidden">
        {template.items.map((it) => {
          const ri = byItemId.get(it.id);
          return (
            <ChecklistItemRow
              key={it.id}
              item={it}
              checked={!!ri?.checked}
              photoUrl={ri?.photo_url ?? null}
              note={ri?.note ?? null}
              busy={busyItem === it.id}
              onToggle={(next) => withBusy(it.id, () => setItem(it.id, { checked: next }))}
              onPhoto={(file) => withBusy(it.id, () => setItem(it.id, { photo: file }))}
              onClearPhoto={() => withBusy(it.id, () => setItem(it.id, { clearPhoto: true }))}
              onNote={(n) => withBusy(it.id, () => setItem(it.id, { note: n || null }))}
            />
          );
        })}
      </div>

      {/* Complete */}
      <div className="mt-4">
        {completed ? (
          <div className="card p-4 flex items-center gap-2 text-success">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">
              Completed{run.completed_by ? ` by ${run.completed_by.split('@')[0]}` : ''}
            </span>
          </div>
        ) : (
          <button
            onClick={async () => {
              setCompleting(true);
              await completeRun();
              setCompleting(false);
            }}
            disabled={!canComplete || completing || uploading}
            className="btn-primary w-full justify-center text-base py-3 disabled:opacity-50"
          >
            {completing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            Mark checklist complete
          </button>
        )}
        {!completed && !canComplete && (
          <p className="text-xs text-text-muted text-center mt-2">
            Check every item — photo-required items need a photo first.
          </p>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Line check item row — numeric input, safe range, red on fail
// ════════════════════════════════════════════════════════════

function LineCheckRow({
  item,
  value,
  inRange,
  saving,
  onCommit,
  onLogTask,
}: {
  item: LineCheckTemplateItem;
  value: number | null;
  inRange: boolean | null;
  saving: boolean;
  onCommit: (value: number) => void;
  onLogTask: () => void;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : '');

  // Live preview of pass/fail as the manager types (before commit).
  const draftNum = draft.trim() === '' ? null : Number(draft);
  const previewInRange =
    draftNum != null && !Number.isNaN(draftNum)
      ? isInRange(draftNum, item.min_value, item.max_value)
      : null;
  const showFail = previewInRange === false || (previewInRange === null && inRange === false);

  const rangeLabel = useMemo(() => {
    const u = item.unit ?? '';
    if (item.min_value != null && item.max_value != null) return `${item.min_value}–${item.max_value}${u}`;
    if (item.min_value != null) return `≥ ${item.min_value}${u}`;
    if (item.max_value != null) return `≤ ${item.max_value}${u}`;
    return 'No set range';
  }, [item]);

  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || Number.isNaN(n)) return;
    onCommit(n);
  };

  return (
    <div className={`p-4 ${showFail ? 'bg-danger/5' : ''}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-base font-medium text-text-primary truncate">{item.label}</p>
          <p className="text-xs text-text-muted mt-0.5">Safe: {rangeLabel}</p>
        </div>
        {inRange === true && (
          <span className="badge-success flex items-center gap-1 shrink-0">
            <CheckCircle2 size={11} /> In range
          </span>
        )}
        {showFail && (
          <span className="badge-danger flex items-center gap-1 shrink-0">
            <AlertTriangle size={11} /> Out of range
          </span>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            className={`input-field text-lg font-semibold tabular-nums ${showFail ? '!border-danger !text-danger focus:!ring-danger/40' : ''}`}
            placeholder="—"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            aria-label={`${item.label} reading${item.unit ? ` in ${item.unit}` : ''}`}
          />
          {item.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted pointer-events-none">
              {item.unit}
            </span>
          )}
        </div>
        <button
          onClick={commit}
          disabled={saving || draft.trim() === ''}
          className="btn-secondary shrink-0 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
        </button>
      </div>

      {showFail && (
        <button
          onClick={onLogTask}
          className="mt-3 w-full btn-danger justify-center text-sm py-2.5 flex items-center gap-2"
        >
          <AlertTriangle size={15} /> Log corrective task
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Line check panel
// ════════════════════════════════════════════════════════════

function LineCheckPanel({
  template,
  shiftId,
  completedBy,
}: {
  template: LineCheckTemplateWithItems;
  shiftId: number | null;
  completedBy: string | null;
}) {
  const { byItemId, failures, loading, saving, recordReading, logCorrectiveTask } = useLineCheckRun(
    template,
    shiftId,
    completedBy
  );

  if (loading) {
    return (
      <div className="card p-12 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div>
      {failures.length > 0 && (
        <div className="card p-4 mb-4 border-danger/40 bg-danger/5 flex items-center gap-2">
          <AlertTriangle size={18} className="text-danger shrink-0" />
          <p className="text-sm text-danger font-medium">
            {failures.length} reading{failures.length === 1 ? '' : 's'} out of range — log a corrective task.
          </p>
        </div>
      )}

      <div className="card divide-y divide-border overflow-hidden">
        {template.items.map((it) => {
          const r = byItemId.get(it.id);
          return (
            <LineCheckRow
              key={it.id}
              item={it}
              value={r?.value ?? null}
              inRange={r?.in_range ?? null}
              saving={saving}
              onCommit={(v) => recordReading(it, v)}
              onLogTask={() => logCorrectiveTask(it, r?.value ?? Number.NaN)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Page
// ════════════════════════════════════════════════════════════

export function Checks() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const completedBy = user?.email ?? null;

  const shiftParam = searchParams.get('shift');
  const explicitShift = shiftParam != null && /^\d+$/.test(shiftParam) ? Number(shiftParam) : undefined;
  const shiftId = useCurrentShiftId(explicitShift);

  const [tab, setTab] = useState<TabKey>('opening');

  const { templates: checklists, loading: clLoading } = useChecklistTemplates();
  const { templates: lineChecks, loading: lcLoading } = useLineCheckTemplates();

  const activeChecklist = useMemo<ChecklistTemplateWithItems | null>(() => {
    if (tab === 'line') return null;
    return checklists.find((t) => t.kind === tab) ?? null;
  }, [tab, checklists]);

  const activeLineCheck = lineChecks[0] ?? null;

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-5">
        <a
          href="/shift"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary mb-2"
        >
          <ChevronLeft size={16} /> Shift
        </a>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-text-primary">Checks</h1>
          {shiftId == null && (
            <span className="badge text-text-muted">No open shift</span>
          )}
        </div>
        <p className="text-sm text-text-muted mt-1">
          Opening, closing & safety checklists, plus the bar line check.
        </p>
      </div>

      {/* Tabs — scrollable, big targets */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              tab === key
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-secondary hover:text-text-primary'
            }`}
            style={{ minHeight: 44 }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      {tab === 'line' ? (
        lcLoading ? (
          <div className="card p-12 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-text-muted" />
          </div>
        ) : activeLineCheck ? (
          <LineCheckPanel template={activeLineCheck} shiftId={shiftId} completedBy={completedBy} />
        ) : (
          <div className="card p-10 text-center">
            <Thermometer size={40} className="mx-auto text-text-muted mb-3" />
            <p className="text-text-secondary font-medium">No line check configured</p>
            <p className="text-sm text-text-muted mt-1">
              Run the add-checklists migration to seed the default line check.
            </p>
          </div>
        )
      ) : clLoading ? (
        <div className="card p-12 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-text-muted" />
        </div>
      ) : activeChecklist ? (
        <ChecklistPanel template={activeChecklist} shiftId={shiftId} completedBy={completedBy} />
      ) : (
        <div className="card p-10 text-center">
          <ClipboardCheck size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No {tab} checklist</p>
          <p className="text-sm text-text-muted mt-1">
            Run the add-checklists migration to seed the default templates.
          </p>
        </div>
      )}
    </div>
  );
}
