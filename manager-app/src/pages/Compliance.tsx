import { useMemo, useState, useId, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  ShieldCheck,
  Ban,
  AlertTriangle,
  Thermometer,
  BadgeCheck,
  Plus,
  X,
  Loader2,
  Printer,
  Eye,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { safeFmtDate } from '../utils/format';
import {
  useCompliance,
  expiryStatus,
  REFUSAL_REASONS,
  INCIDENT_TYPES,
  CREDENTIAL_TYPES,
  type RefusalLog,
  type Incident,
  type TempUnit,
  type Credential,
  type ExpiryTier,
} from '../hooks/useCompliance';
import { useConfirm } from '../hooks/useConfirm';

type Tab = 'refusals' | 'incidents' | 'temps' | 'credentials';

const TABS: { id: Tab; label: string; icon: typeof Ban }[] = [
  { id: 'refusals', label: 'Refusal / Cut-off', icon: Ban },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'temps', label: 'Temperature Wall', icon: Thermometer },
  { id: 'credentials', label: 'Licenses & Certs', icon: BadgeCheck },
];

const fmtDateTime = (iso: string) => safeFmtDate(iso, 'MMM d, yyyy h:mm a');
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ── Shared modal shell ─────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, panelRef, { onEscape: onClose });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative bg-surface border border-border rounded-xl shadow-modal w-full max-w-lg max-h-[90dvh] overflow-y-auto mx-4 focus:outline-none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface">
          <h2 id={titleId} className="font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Expiry chip ────────────────────────────────────────────────────────────────

const TIER_CLASS: Record<ExpiryTier, string> = {
  expired: 'bg-red-500/10 text-danger',
  d7: 'bg-red-500/10 text-danger',
  d30: 'bg-accent/10 text-accent',
  d60: 'bg-accent/10 text-accent',
  d90: 'bg-primary/10 text-primary',
  ok: 'bg-surface-hover text-text-muted',
  none: 'bg-surface-hover text-text-muted',
};

function ExpiryChip({ expiresOn }: { expiresOn: string | null }) {
  const s = expiryStatus(expiresOn);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIER_CLASS[s.tier]}`}>
      {s.label}
    </span>
  );
}

// ── Refusal log ─────────────────────────────────────────────────────────────────

function RefusalForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: ReturnType<typeof useCompliance>['addRefusal'] }) {
  const [server, setServer] = useState('');
  const [reason, setReason] = useState<string>(REFUSAL_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSubmit({ server: server || null, reason, notes: notes || null });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell title="Log a refusal / cut-off" onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="label">Server</label>
          <input className="input-field" placeholder="Name or initials" value={server} onChange={(e) => setServer(e.target.value)} />
        </div>
        <div>
          <label className="label">Reason *</label>
          <select className="input-field" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REFUSAL_REASONS.map((r) => (
              <option key={r} value={r}>{titleCase(r)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input-field" rows={3} placeholder="What happened, witnesses, descriptions…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <p className="text-xs text-text-muted">Refusal records are permanent and cannot be edited or deleted.</p>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Log Refusal'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function RefusalsTab({ rows }: { rows: RefusalLog[] }) {
  if (rows.length === 0) {
    return (
      <div className="card p-16 text-center">
        <Ban size={48} className="mx-auto text-text-muted mb-3" />
        <p className="text-text-muted">No refusals logged yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge-danger">{titleCase(r.reason)}</span>
                {r.server && <span className="text-sm text-text-secondary">{r.server}</span>}
              </div>
              {r.notes && <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">{r.notes}</p>}
            </div>
            <span className="text-xs text-text-muted shrink-0">{fmtDateTime(r.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Incidents ─────────────────────────────────────────────────────────────────

function IncidentForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: ReturnType<typeof useCompliance>['addIncident'] }) {
  const [type, setType] = useState<string>(INCIDENT_TYPES[0]);
  const [description, setDescription] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSubmit({ type, description, actionTaken: actionTaken || null, photoUrl: photoUrl || null });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell title="File an incident report" onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="label">Type *</label>
          <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
            {INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>{titleCase(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">What happened *</label>
          <textarea className="input-field" rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">Action taken</label>
          <textarea className="input-field" rows={2} placeholder="911 called, first aid, trespass notice, refund…" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} />
        </div>
        <div>
          <label className="label">Photo URL</label>
          <input className="input-field" placeholder="https://…" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
        </div>
        <p className="text-xs text-text-muted">Incident reports are permanent and cannot be edited or deleted.</p>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'File Report'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function IncidentsTab({ rows }: { rows: Incident[] }) {
  if (rows.length === 0) {
    return (
      <div className="card p-16 text-center">
        <AlertTriangle size={48} className="mx-auto text-text-muted mb-3" />
        <p className="text-text-muted">No incidents reported yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((i) => (
        <div key={i.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="badge-accent">{titleCase(i.type)}</span>
            <span className="text-xs text-text-muted shrink-0">{fmtDateTime(i.created_at)}</span>
          </div>
          <p className="text-sm text-text-primary mt-2 whitespace-pre-wrap">{i.description}</p>
          {i.action_taken && (
            <p className="text-sm text-text-secondary mt-2">
              <span className="font-medium text-text-primary">Action:</span> {i.action_taken}
            </p>
          )}
          {i.photo_url && (
            <a href={i.photo_url} target="_blank" rel="noreferrer" className="text-xs text-primary mt-2 inline-block hover:underline">
              View photo
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Temperature wall ─────────────────────────────────────────────────────────

function UnitForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: ReturnType<typeof useCompliance>['addUnit'] }) {
  const [name, setName] = useState('');
  const [minF, setMinF] = useState(33);
  const [maxF, setMaxF] = useState(40);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSubmit(name, minF, maxF);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell title="Add a monitored unit" onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="label">Unit name *</label>
          <input className="input-field" required placeholder="Walk-in Cooler" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Min °F</label>
            <input type="number" step="any" className="input-field" value={minF} onChange={(e) => setMinF(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Max °F</label>
            <input type="number" step="any" className="input-field" value={maxF} onChange={(e) => setMaxF(Number(e.target.value))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Add Unit'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function TempCard({
  unit,
  latest,
  readOnly,
  onLog,
  onRemove,
}: {
  unit: TempUnit;
  latest: { value_f: number; in_range: boolean; created_at: string } | undefined;
  readOnly: boolean;
  onLog: (unitId: number, valueF: number) => Promise<boolean>;
  onRemove: (id: number) => void;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const log = async () => {
    const v = Number(value);
    if (value === '' || Number.isNaN(v)) return;
    setSaving(true);
    const ok = await onLog(unit.id, v);
    setSaving(false);
    if (ok) setValue('');
  };

  const ok = latest?.in_range ?? true;

  return (
    <div className={`card p-4 ${latest && !ok ? 'border-danger/40' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{unit.name}</p>
          <p className="text-xs text-text-muted">Safe: {unit.min_f}–{unit.max_f}°F</p>
        </div>
        {latest ? (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${ok ? 'text-success' : 'text-danger'}`}>
            {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {ok ? 'In range' : 'Out of range'}
          </span>
        ) : (
          <span className="text-xs text-text-muted">No readings</span>
        )}
      </div>

      <div className="mt-3 flex items-end gap-3">
        <p className="text-3xl font-bold tabular-nums leading-none text-text-primary">
          {latest ? `${latest.value_f}°` : '—'}
        </p>
        {latest && <p className="text-xs text-text-muted pb-1">{fmtDateTime(latest.created_at)}</p>}
      </div>

      {!readOnly && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            step="any"
            inputMode="decimal"
            className="input-field flex-1"
            placeholder="°F"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') log(); }}
          />
          <button onClick={log} disabled={saving || value === ''} className="btn-primary shrink-0">
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Log'}
          </button>
          <button
            onClick={() => onRemove(unit.id)}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-red-500/10 text-text-muted hover:text-danger shrink-0"
            title="Remove unit"
            aria-label="Remove unit"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Credentials ─────────────────────────────────────────────────────────────

function CredentialForm({
  initial,
  onClose,
  onCreate,
  onUpdate,
}: {
  initial: Credential | null;
  onClose: () => void;
  onCreate: ReturnType<typeof useCompliance>['addCredential'];
  onUpdate: ReturnType<typeof useCompliance>['updateCredential'];
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<string>(initial?.type ?? CREDENTIAL_TYPES[0]);
  const [holder, setHolder] = useState(initial?.holder ?? '');
  const [expiresOn, setExpiresOn] = useState(initial?.expires_on ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const fields = { name, type, holder: holder || null, expires_on: expiresOn || null };
    const ok = initial ? await onUpdate(initial.id, fields) : await onCreate(fields);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell title={initial ? 'Edit credential' : 'Add a credential'} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="label">Name *</label>
          <input className="input-field" required placeholder="Liquor License" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type</label>
            <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
              {CREDENTIAL_TYPES.map((t) => (
                <option key={t} value={t}>{titleCase(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Expires on</label>
            <input type="date" className="input-field" value={expiresOn ?? ''} onChange={(e) => setExpiresOn(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Holder</label>
          <input className="input-field" placeholder="The venue, or a staff member" value={holder} onChange={(e) => setHolder(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : initial ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function CredentialsTab({
  rows,
  readOnly,
  onEdit,
  onRemove,
}: {
  rows: Credential[];
  readOnly: boolean;
  onEdit: (c: Credential) => void;
  onRemove: (id: number) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="card p-16 text-center">
        <BadgeCheck size={48} className="mx-auto text-text-muted mb-3" />
        <p className="text-text-muted">No licenses or certs tracked yet</p>
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[480px]">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide">
            <th className="px-5 py-3 font-medium">Credential</th>
            <th className="px-5 py-3 font-medium">Type</th>
            <th className="px-5 py-3 font-medium hidden sm:table-cell">Holder</th>
            <th className="px-5 py-3 font-medium hidden sm:table-cell">Expires</th>
            <th className="px-5 py-3 font-medium text-center">Status</th>
            {!readOnly && <th className="px-5 py-3 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-surface-hover transition-colors">
              <td className="px-5 py-3 text-sm font-medium text-text-primary">{c.name}</td>
              <td className="px-5 py-3"><span className="badge-primary">{titleCase(c.type)}</span></td>
              <td className="px-5 py-3 text-sm text-text-secondary hidden sm:table-cell">{c.holder ?? '—'}</td>
              <td className="px-5 py-3 text-sm text-text-secondary hidden sm:table-cell">
                {c.expires_on ? safeFmtDate(c.expires_on, 'MMM d, yyyy') : '—'}
              </td>
              <td className="px-5 py-3 text-center"><ExpiryChip expiresOn={c.expires_on} /></td>
              {!readOnly && (
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => onEdit(c)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-surface-active text-text-muted hover:text-text-primary" title="Edit" aria-label="Edit credential">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => onRemove(c.id)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-red-500/10 text-text-muted hover:text-danger" title="Remove" aria-label="Remove credential">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Inspector mode (read-only export) ─────────────────────────────────────────

function InspectorView({ data }: { data: ReturnType<typeof useCompliance> }) {
  const { refusals, incidents, units, credentials, latestTempByUnit } = data;
  return (
    <div className="space-y-8 print:space-y-6">
      <div className="card p-5 print:border-0 print:shadow-none">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <ShieldCheck size={20} className="text-primary" /> Iggy's Seaside — Compliance Snapshot
        </h2>
        <p className="text-sm text-text-muted mt-1">Generated {safeFmtDate(new Date(), 'MMM d, yyyy h:mm a')}</p>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">Active Licenses & Certifications</h3>
        <CredentialsTab rows={credentials} readOnly onEdit={() => {}} onRemove={() => {}} />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">Temperature Units — Latest Readings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {units.map((u) => {
            const latest = latestTempByUnit.get(u.id);
            return (
              <TempCard key={u.id} unit={u} latest={latest} readOnly onLog={async () => false} onRemove={() => {}} />
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">Refusal / Cut-off Log ({refusals.length})</h3>
        <RefusalsTab rows={refusals} />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">Incident Reports ({incidents.length})</h3>
        <IncidentsTab rows={incidents} />
      </section>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function Compliance() {
  const data = useCompliance();
  const { loading, refusals, incidents, units, credentials, latestTempByUnit, expiringCount } = data;

  const [tab, setTab] = useState<Tab>('refusals');
  const [inspector, setInspector] = useState(false);
  const [modal, setModal] = useState<null | 'refusal' | 'incident' | 'unit' | 'credential'>(null);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);

  const confirm = useConfirm();

  const outOfRangeCount = useMemo(
    () => units.filter((u) => latestTempByUnit.get(u.id)?.in_range === false).length,
    [units, latestTempByUnit]
  );

  const openCredential = (c: Credential | null) => {
    setEditingCred(c);
    setModal('credential');
  };

  const removeCredential = async (id: number) => {
    const ok = await confirm({
      title: 'Remove credential',
      message: 'Remove this credential? Expiry tracking for it will stop.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    await data.removeCredential(id);
  };

  const removeUnit = async (id: number) => {
    const ok = await confirm({
      title: 'Remove unit',
      message: 'Remove this unit? Past readings are kept for the record.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    await data.removeUnit(id);
  };

  if (inspector) {
    return (
      <div>
        <div className="flex items-center justify-between gap-4 mb-6 print:hidden">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">Inspector Mode</h1>
            <span className="badge-primary">Read-only</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2">
              <Printer size={16} /> <span className="hidden sm:inline">Print / Export</span>
            </button>
            <button onClick={() => setInspector(false)} className="btn-primary flex items-center gap-2">
              <X size={16} /> Exit
            </button>
          </div>
        </div>
        {loading ? (
          <div className="card p-16 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-text-muted" />
          </div>
        ) : (
          <InspectorView data={data} />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ShieldCheck size={24} className="text-primary" /> Compliance
          </h1>
          {outOfRangeCount > 0 && (
            <span className="badge-danger flex items-center gap-1">
              <Thermometer size={12} /> {outOfRangeCount} out of range
            </span>
          )}
          {expiringCount > 0 && (
            <span className="badge-accent flex items-center gap-1">
              <AlertTriangle size={12} /> {expiringCount} expiring
            </span>
          )}
        </div>
        <button onClick={() => setInspector(true)} className="btn-secondary flex items-center gap-2 shrink-0">
          <Eye size={16} /> Inspector Mode
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === id ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex justify-end mb-4">
        {tab === 'refusals' && (
          <button onClick={() => setModal('refusal')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Log Refusal
          </button>
        )}
        {tab === 'incidents' && (
          <button onClick={() => setModal('incident')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> File Incident
          </button>
        )}
        {tab === 'temps' && (
          <button onClick={() => setModal('unit')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Unit
          </button>
        )}
        {tab === 'credentials' && (
          <button onClick={() => openCredential(null)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Credential
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="card p-16 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      ) : (
        <>
          {tab === 'refusals' && <RefusalsTab rows={refusals} />}
          {tab === 'incidents' && <IncidentsTab rows={incidents} />}
          {tab === 'temps' && (
            units.length === 0 ? (
              <div className="card p-16 text-center">
                <Thermometer size={48} className="mx-auto text-text-muted mb-3" />
                <p className="text-text-muted">No units yet — add a cooler or freezer to start logging temps</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {units.map((u) => (
                  <TempCard
                    key={u.id}
                    unit={u}
                    latest={latestTempByUnit.get(u.id)}
                    readOnly={false}
                    onLog={(unitId, valueF) => data.addTemperature({ unitId, valueF })}
                    onRemove={removeUnit}
                  />
                ))}
              </div>
            )
          )}
          {tab === 'credentials' && (
            <CredentialsTab rows={credentials} readOnly={false} onEdit={openCredential} onRemove={removeCredential} />
          )}
        </>
      )}

      {/* Modals */}
      {modal === 'refusal' && <RefusalForm onClose={() => setModal(null)} onSubmit={data.addRefusal} />}
      {modal === 'incident' && <IncidentForm onClose={() => setModal(null)} onSubmit={data.addIncident} />}
      {modal === 'unit' && <UnitForm onClose={() => setModal(null)} onSubmit={data.addUnit} />}
      {modal === 'credential' && (
        <CredentialForm
          initial={editingCred}
          onClose={() => { setModal(null); setEditingCred(null); }}
          onCreate={data.addCredential}
          onUpdate={data.updateCredential}
        />
      )}
    </div>
  );
}
