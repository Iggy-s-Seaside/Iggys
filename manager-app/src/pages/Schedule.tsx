// Schedule — weekly staff scheduling board + live labor-% gauge + tip-pool calculator.
// Route: /schedule. Data + math live in hooks/useSchedule.ts; tables in
// scripts/add-labor.sql. Reuses the shared charts (BarChart, Sparkline, StatTrend).
//
// Three stacked tools on one page:
//   1. Roster + week board   — staff × 7 days grid, add/edit/remove shifts, publish.
//   2. Labor-% gauge          — Σ(wage×hours) vs a per-weekday sales forecast.
//   3. Tip-pool calculator    — split a date's pooled tips across who worked it.

import { useMemo, useState, useId, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  Users, ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2, Loader2,
  CalendarOff, Check, Ban, Send, EyeOff, DollarSign, Coins, Gauge,
} from 'lucide-react';
import { addDays, format } from 'date-fns';
import { BarChart } from '../components/charts/BarChart';
import { StatTrend } from '../components/charts/StatTrend';
import { Sparkline } from '../components/charts/Sparkline';
import {
  useSchedule, summarizeLabor, laborGauge, forecastForWeek, allocateTips,
  hoursForStaffOnDate, shiftHours, minToLabel, minToTimeInput, timeInputToMin,
  fmtDate, DEFAULT_DAY_SALES_TARGET, STAFF_ROLES,
  TIP_METHODS, TIP_METHOD_LABELS, type TipMethod, type TipAllocation,
} from '../hooks/useSchedule';
import { useConfirm } from '../hooks/useConfirm';
import { money } from '../utils/format';
import type { Staff, Shift, TimeOffRequest, TipPool } from '../types';

const money2 = (n: number) => `$${(n || 0).toFixed(2)}`;
const centsToDollars = (c: number) => money2(c / 100);

// ── Staff form modal ──

interface StaffFormProps {
  open: boolean;
  initial?: Staff | null;
  onClose: () => void;
  onSubmit: (data: Omit<Staff, 'id' | 'created_at'>) => Promise<boolean>;
}

function StaffFormModal({ open, initial, onClose, onSubmit }: StaffFormProps) {
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    role: initial?.role ?? 'bartender',
    wage: initial?.wage ?? 0,
    certs: (initial?.certs ?? []).join(', '),
    active: initial?.active ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef, { onEscape: onClose });

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSubmit({
      name: form.name.trim(),
      email: form.email.trim() || null,
      role: form.role,
      wage: Number(form.wage) || 0,
      certs: form.certs.split(',').map((c) => c.trim()).filter(Boolean),
      active: form.active,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative bg-surface border border-border rounded-xl shadow-lg w-full max-w-md max-h-[90dvh] overflow-y-auto mx-4 focus:outline-none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id={titleId} className="font-semibold text-text-primary">{initial ? 'Edit Staff' : 'Add Staff'}</h2>
          <button onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input-field" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Role</label>
              <select className="input-field" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Wage ($/hr)</label>
              <input type="number" step="0.25" min="0" className="input-field" value={form.wage}
                onChange={(e) => setForm({ ...form, wage: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input-field" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Certifications</label>
            <input className="input-field" placeholder="OLCC, Food Handler" value={form.certs}
              onChange={(e) => setForm({ ...form, certs: e.target.value })} />
            <p className="text-xs text-text-muted mt-1">Comma-separated</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="staff-active" checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded border-border" />
            <label htmlFor="staff-active" className="text-sm text-text-secondary">Active (on roster)</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary">
              {saving ? 'Saving...' : initial ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shift edit modal ──

interface ShiftModalProps {
  open: boolean;
  staffMember: Staff | null;
  date: string;
  initial?: Shift | null;
  onClose: () => void;
  onSave: (input: Omit<Shift, 'id' | 'created_at'>) => Promise<boolean>;
  onUpdate: (id: number, fields: Partial<Shift>) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}

function ShiftModal({ open, staffMember, date, initial, onClose, onSave, onUpdate, onDelete }: ShiftModalProps) {
  const [start, setStart] = useState(minToTimeInput(initial?.start_min ?? 1020));
  const [end, setEnd] = useState(minToTimeInput(initial?.end_min ?? 1440 - 1));
  const [role, setRole] = useState(initial?.role ?? staffMember?.role ?? 'bartender');
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open && !!staffMember, panelRef, { onEscape: onClose });

  if (!open || !staffMember) return null;

  const startMin = timeInputToMin(start);
  const endMin = timeInputToMin(end);
  const hrs = shiftHours(startMin, endMin);

  const handleSave = async () => {
    setSaving(true);
    const payload: Omit<Shift, 'id' | 'created_at'> = {
      staff_id: staffMember.id,
      date,
      start_min: startMin,
      end_min: endMin,
      role,
      published: initial?.published ?? false,
    };
    const ok = initial ? await onUpdate(initial.id, payload) : await onSave(payload);
    setSaving(false);
    if (ok) onClose();
  };

  const handleDelete = async () => {
    if (!initial) return;
    setSaving(true);
    const ok = await onDelete(initial.id);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative bg-surface border border-border rounded-xl shadow-lg w-full max-w-sm mx-4 focus:outline-none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 id={titleId} className="font-semibold text-text-primary">{initial ? 'Edit Shift' : 'Add Shift'}</h2>
            <p className="text-xs text-text-muted mt-0.5">{staffMember.name} · {fmtDate(date, 'EEE, MMM d')}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start</label>
              <input type="time" className="input-field" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="label">End</label>
              <input type="time" className="input-field" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between text-sm bg-surface-hover rounded-lg px-3 py-2">
            <span className="text-text-muted">Length</span>
            <span className="text-text-primary font-medium tabular-nums">{hrs.toFixed(1)} hrs</span>
          </div>
          <div className="flex items-center justify-between text-sm bg-surface-hover rounded-lg px-3 py-2">
            <span className="text-text-muted">Labor cost</span>
            <span className="text-text-primary font-medium tabular-nums">{money2(hrs * (staffMember.wage || 0))}</span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            {initial ? (
              <button onClick={handleDelete} disabled={saving}
                className="btn-secondary text-danger flex items-center gap-1.5">
                <Trash2 size={14} /> Remove
              </button>
            ) : <span />}
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : initial ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Labor gauge bar ──

function GaugeBar({ pct, status }: { pct: number; status: 'good' | 'watch' | 'over' }) {
  const color = status === 'good' ? '#22c55e' : status === 'watch' ? '#f59e0b' : '#ef4444';
  const width = Math.min(pct, 100);
  return (
    <div className="space-y-2">
      <div className="relative h-3 rounded-full bg-surface-hover overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }} />
        {/* 25% / 32% healthy-band markers */}
        <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: '25%' }} />
        <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: '32%' }} />
      </div>
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>0%</span>
        <span>Target ≤25%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// ── Tip-pool calculator ──

interface TipCalcProps {
  staff: Staff[];
  shifts: Shift[];
  defaultDate: string;
  recentPools: TipPool[];
  onSave: (input: Omit<TipPool, 'id' | 'created_at'>) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}

function TipPoolCalculator({ staff, shifts, defaultDate, recentPools, onSave, onDelete }: TipCalcProps) {
  const [date, setDate] = useState(defaultDate);
  const [totalInput, setTotalInput] = useState('');
  const [method, setMethod] = useState<TipMethod>('hours');
  const [saving, setSaving] = useState(false);

  const totalCents = Math.round((Number(totalInput) || 0) * 100);

  // Everyone who has a shift on the chosen date, with their worked hours.
  const participants = useMemo(() => {
    const byId = new Map(staff.map((s) => [s.id, s] as const));
    const ids = new Set(shifts.filter((s) => s.date === date).map((s) => s.staff_id));
    return Array.from(ids)
      .map((id) => {
        const s = byId.get(id);
        if (!s) return null;
        return { staff_id: id, name: s.name, role: s.role, hours: hoursForStaffOnDate(shifts, id, date) };
      })
      .filter((p): p is { staff_id: number; name: string; role: string; hours: number } => p != null)
      .sort((a, b) => b.hours - a.hours);
  }, [staff, shifts, date]);

  const allocations: TipAllocation[] = useMemo(
    () => allocateTips(totalCents, participants, method),
    [totalCents, participants, method]
  );

  const handleSave = async () => {
    if (totalCents <= 0 || participants.length === 0) return;
    setSaving(true);
    const ok = await onSave({ date, total_cents: totalCents, method, allocations });
    setSaving(false);
    if (ok) setTotalInput('');
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Coins size={18} className="text-accent" />
        <h2 className="font-semibold text-text-primary">Tip Pool</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Total tips ($)</label>
          <input type="number" step="0.01" min="0" inputMode="decimal" className="input-field"
            placeholder="0.00" value={totalInput} onChange={(e) => setTotalInput(e.target.value)} />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value as TipMethod)}>
            {TIP_METHODS.map((m) => <option key={m} value={m}>{TIP_METHOD_LABELS[m]}</option>)}
          </select>
        </div>
      </div>

      {participants.length === 0 ? (
        <div className="text-center py-8 text-sm text-text-muted">
          No one scheduled on {fmtDate(date, 'EEE, MMM d')}. Add shifts to split tips.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide bg-surface-hover">
                  <th className="px-4 py-2 font-medium">Staff</th>
                  <th className="px-4 py-2 font-medium text-right">Hours</th>
                  <th className="px-4 py-2 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allocations.map((a) => (
                  <tr key={a.staff_id}>
                    <td className="px-4 py-2.5 text-sm text-text-primary">{a.name}</td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary text-right tabular-nums">{a.hours.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-text-primary text-right tabular-nums">
                      {centsToDollars(a.share_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-hover">
                  <td className="px-4 py-2.5 text-sm font-semibold text-text-primary">Total</td>
                  <td className="px-4 py-2.5 text-sm text-text-secondary text-right tabular-nums">
                    {allocations.reduce((s, a) => s + a.hours, 0).toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-text-primary text-right tabular-nums">
                    {centsToDollars(allocations.reduce((s, a) => s + a.share_cents, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleSave} disabled={saving || totalCents <= 0} className="btn-primary flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save Pool
            </button>
          </div>
        </>
      )}

      {recentPools.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Recent pools</h3>
          <div className="space-y-1.5">
            {recentPools.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-text-secondary">{fmtDate(p.date, 'MMM d')}</span>
                <span className="text-text-muted text-xs">{TIP_METHOD_LABELS[(p.method as TipMethod)] ?? p.method}</span>
                <span className="text-text-primary font-medium tabular-nums">{centsToDollars(p.total_cents)}</span>
                <button onClick={() => onDelete(p.id)}
                  className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-danger" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Time-off list ──

function TimeOffList({ staff, requests, onStatus }: {
  staff: Staff[];
  requests: TimeOffRequest[];
  onStatus: (id: number, status: TimeOffRequest['status']) => Promise<boolean>;
}) {
  const byId = useMemo(() => new Map(staff.map((s) => [s.id, s] as const)), [staff]);
  const pending = requests.filter((r) => r.status === 'pending');
  const others = requests.filter((r) => r.status !== 'pending');

  const row = (r: TimeOffRequest) => {
    const s = byId.get(r.staff_id);
    const range = r.date_from === r.date_to
      ? fmtDate(r.date_from, 'MMM d')
      : `${fmtDate(r.date_from, 'MMM d')} – ${fmtDate(r.date_to, 'MMM d')}`;
    return (
      <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{s?.name ?? 'Unknown'}</p>
          <p className="text-xs text-text-muted">{range}{r.reason ? ` · ${r.reason}` : ''}</p>
        </div>
        {r.status === 'pending' ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onStatus(r.id, 'approved')}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-green-500/10 text-text-muted hover:text-green-500" title="Approve" aria-label="Approve">
              <Check size={15} />
            </button>
            <button onClick={() => onStatus(r.id, 'denied')}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-red-500/10 text-text-muted hover:text-danger" title="Deny" aria-label="Deny">
              <Ban size={15} />
            </button>
          </div>
        ) : (
          <span className={`badge shrink-0 ${r.status === 'approved' ? 'badge-success' : 'badge-danger'}`}>
            {r.status}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarOff size={18} className="text-primary" />
        <h2 className="font-semibold text-text-primary">Time Off</h2>
        {pending.length > 0 && <span className="badge-accent">{pending.length} pending</span>}
      </div>
      {requests.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-6">No time-off requests</p>
      ) : (
        <div>
          {pending.map(row)}
          {others.map(row)}
        </div>
      )}
    </div>
  );
}

// ── Main page ──

export function Schedule() {
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const sched = useSchedule(weekAnchor);
  const {
    week, weekStart, staff, shifts, timeOff, tipPools, loading,
    createStaff, updateStaff, removeStaff,
    addShift, updateShift, removeShift, setWeekPublished,
    setTimeOffStatus, saveTipPool, removeTipPool,
  } = sched;

  const [staffModal, setStaffModal] = useState<{ open: boolean; editing: Staff | null }>({ open: false, editing: null });
  const [shiftModal, setShiftModal] = useState<{ open: boolean; staff: Staff | null; date: string; editing: Shift | null }>(
    { open: false, staff: null, date: '', editing: null }
  );
  const [salesMult, setSalesMult] = useState(1);

  const confirm = useConfirm();

  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);

  // Shift lookup: `${staffId}|${date}` -> shifts (a person can have a split shift).
  const shiftMap = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const sh of shifts) {
      const key = `${sh.staff_id}|${sh.date}`;
      const list = m.get(key);
      if (list) list.push(sh);
      else m.set(key, [sh]);
    }
    return m;
  }, [shifts]);

  // Labor roll-up + gauge.
  const labor = useMemo(() => summarizeLabor(shifts, staff, week), [shifts, staff, week]);
  const forecast = useMemo(() => forecastForWeek(week, DEFAULT_DAY_SALES_TARGET, salesMult), [week, salesMult]);
  const gauge = useMemo(() => laborGauge(labor.laborCost, forecast), [labor.laborCost, forecast]);

  const perDayBars = useMemo(
    () => week.map((d, i) => ({ label: d.label, value: Math.round(labor.perDayCost[i]) })),
    [week, labor.perDayCost]
  );

  const allPublished = shifts.length > 0 && shifts.every((s) => s.published);
  const hasDrafts = shifts.some((s) => !s.published);

  const gaugeTone = gauge.status === 'good'
    ? 'text-green-600 dark:text-green-400'
    : gauge.status === 'watch' ? 'text-accent' : 'text-danger';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Schedule</h1>
          <span className="badge text-text-muted">{activeStaff.length} staff</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface-hover rounded-lg p-1">
            <button onClick={() => setWeekAnchor((d) => addDays(d, -7))}
              className="p-2.5 rounded-md hover:bg-surface-active text-text-secondary" title="Previous week">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-text-primary px-2 tabular-nums whitespace-nowrap">
              {fmtDate(weekStart, 'MMM d')} – {format(addDays(new Date(weekStart), 6), 'MMM d')}
            </span>
            <button onClick={() => setWeekAnchor((d) => addDays(d, 7))}
              className="p-2.5 rounded-md hover:bg-surface-active text-text-secondary" title="Next week">
              <ChevronRight size={16} />
            </button>
          </div>
          <button onClick={() => setWeekAnchor(new Date())} className="btn-secondary text-sm hidden sm:inline-flex">
            Today
          </button>
          <button onClick={() => setStaffModal({ open: true, editing: null })}
            className="btn-primary flex items-center gap-2 shrink-0">
            <Plus size={16} /><span className="hidden sm:inline">Add Staff</span>
          </button>
        </div>
      </div>

      {/* Labor gauge + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <Gauge size={18} className={gaugeTone} />
            <h2 className="font-semibold text-text-primary">Labor %</h2>
          </div>
          <p className={`text-4xl font-bold tabular-nums leading-none ${gaugeTone}`}>
            {gauge.laborPct.toFixed(1)}%
          </p>
          <p className="text-xs text-text-muted mt-1.5">
            {money(labor.laborCost, { cents: false })} labor ÷ {money(forecast, { cents: false })} forecast
          </p>
          <div className="mt-4">
            <GaugeBar pct={gauge.laborPct} status={gauge.status} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <label className="text-xs text-text-muted">Forecast ×</label>
            <input type="range" min="0.6" max="1.6" step="0.05" value={salesMult}
              onChange={(e) => setSalesMult(Number(e.target.value))} className="flex-1 accent-primary" />
            <span className="text-xs text-text-primary tabular-nums w-10 text-right">{salesMult.toFixed(2)}</span>
          </div>
          <p className="text-[11px] text-text-muted mt-3 pt-3 border-t border-border">
            <span className="text-text-secondary font-medium">Benchmark:</span> healthy bar labor runs 20–30% of sales.
          </p>
        </div>

        <StatTrend
          label="Scheduled labor"
          value={money(labor.laborCost, { cents: false })}
          caption={`${labor.scheduledHours.toFixed(1)} hours this week`}
          icon={<DollarSign size={16} />}
        />
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 min-w-0 mb-2">
            <span className="text-text-muted shrink-0"><Coins size={16} /></span>
            <p className="text-xs sm:text-sm text-text-muted truncate">Labor cost by day</p>
          </div>
          <BarChart data={perDayBars} formatValue={(n) => money(n, { cents: false })} highlightMax height={120} />
        </div>
      </div>

      {/* Publish bar */}
      <div className="flex items-center justify-between gap-3 card px-5 py-3">
        <div className="flex items-center gap-2 text-sm">
          {allPublished ? (
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
              <Check size={15} /> Published
            </span>
          ) : hasDrafts ? (
            <span className="flex items-center gap-1.5 text-accent font-medium">
              <Pencil size={15} /> Draft — {shifts.filter((s) => !s.published).length} unpublished
            </span>
          ) : (
            <span className="text-text-muted">No shifts scheduled this week</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {allPublished && (
            <button onClick={() => setWeekPublished(false)} className="btn-secondary text-sm flex items-center gap-1.5">
              <EyeOff size={14} /> Unpublish
            </button>
          )}
          {shifts.length > 0 && !allPublished && (
            <button onClick={() => setWeekPublished(true)} className="btn-primary text-sm flex items-center gap-1.5">
              <Send size={14} /> Publish Week
            </button>
          )}
        </div>
      </div>

      {/* Weekly board */}
      {loading ? (
        <div className="card p-16 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      ) : activeStaff.length === 0 ? (
        <div className="card p-16 text-center">
          <Users size={48} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-muted">No staff on the roster yet</p>
          <button onClick={() => setStaffModal({ open: true, editing: null })} className="btn-primary mt-4">
            Add your first staff member
          </button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs text-text-muted uppercase tracking-wide font-medium sticky left-0 bg-surface z-10 min-w-[160px]">
                  Staff
                </th>
                {week.map((d) => (
                  <th key={d.date}
                    className={`px-2 py-3 text-center text-xs font-medium uppercase tracking-wide ${d.isToday ? 'text-primary' : 'text-text-muted'}`}>
                    <div>{d.label}</div>
                    <div className={`text-base font-bold mt-0.5 ${d.isToday ? 'text-primary' : 'text-text-secondary'}`}>{d.dayNum}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeStaff.map((s) => {
                const weekHours = week.reduce((sum, d) => {
                  const key = `${s.id}|${d.date}`;
                  return sum + (shiftMap.get(key) ?? []).reduce((h, sh) => h + shiftHours(sh.start_min, sh.end_min), 0);
                }, 0);
                return (
                  <tr key={s.id} className="hover:bg-surface-hover/40 transition-colors">
                    <td className="px-4 py-2 sticky left-0 bg-surface z-10 align-top">
                      <button onClick={() => setStaffModal({ open: true, editing: s })}
                        className="text-left group">
                        <p className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">{s.name}</p>
                        <p className="text-xs text-text-muted capitalize">{s.role} · ${s.wage.toFixed(2)}/hr</p>
                        {weekHours > 0 && <p className="text-[11px] text-text-muted mt-0.5 tabular-nums">{weekHours.toFixed(1)} hrs</p>}
                      </button>
                    </td>
                    {week.map((d) => {
                      const dayShifts = shiftMap.get(`${s.id}|${d.date}`) ?? [];
                      return (
                        <td key={d.date} className="px-1.5 py-2 align-top text-center min-w-[92px]">
                          <div className="space-y-1">
                            {dayShifts.map((sh) => (
                              <button key={sh.id}
                                onClick={() => setShiftModal({ open: true, staff: s, date: d.date, editing: sh })}
                                className={`w-full text-left rounded-md px-2 py-1 text-[11px] leading-tight transition-colors ${
                                  sh.published
                                    ? 'bg-primary/10 text-primary-dark hover:bg-primary/20 dark:text-primary'
                                    : 'bg-accent/10 text-amber-700 dark:text-accent hover:bg-accent/20 border border-dashed border-accent/40'
                                }`}>
                                <span className="block font-medium tabular-nums">{minToLabel(sh.start_min)}</span>
                                <span className="block opacity-70 tabular-nums">{minToLabel(sh.end_min)}</span>
                              </button>
                            ))}
                            <button onClick={() => setShiftModal({ open: true, staff: s, date: d.date, editing: null })}
                              className="w-full rounded-md py-1 text-text-muted hover:text-primary hover:bg-surface-active transition-colors flex items-center justify-center"
                              title="Add shift">
                              <Plus size={13} />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Roster footer: inactive staff + quick remove */}
      {staff.some((s) => !s.active) && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Off roster</h3>
          <div className="flex flex-wrap gap-2">
            {staff.filter((s) => !s.active).map((s) => (
              <span key={s.id} className="badge flex items-center gap-2 text-text-muted">
                {s.name}
                <button onClick={() => updateStaff(s.id, { active: true })} className="hover:text-primary" title="Reactivate">
                  <Check size={12} />
                </button>
                <button onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete staff member',
                      message: `Permanently delete ${s.name}?`,
                      confirmLabel: 'Delete',
                      danger: true,
                    });
                    if (ok) removeStaff(s.id);
                  }}
                  className="hover:text-danger" title="Delete">
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Labor trend sparkline */}
      {labor.scheduledHours > 0 && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Daily labor cost trend</p>
          <Sparkline values={labor.perDayCost} area showLast height={48} />
        </div>
      )}

      {/* Tip pool + time off */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TipPoolCalculator
          staff={staff}
          shifts={shifts}
          defaultDate={week.find((d) => d.isToday)?.date ?? weekStart}
          recentPools={tipPools}
          onSave={saveTipPool}
          onDelete={removeTipPool}
        />
        <TimeOffList staff={staff} requests={timeOff} onStatus={setTimeOffStatus} />
      </div>

      {/* Modals */}
      <StaffFormModal
        open={staffModal.open}
        initial={staffModal.editing}
        onClose={() => setStaffModal({ open: false, editing: null })}
        onSubmit={(data) =>
          staffModal.editing ? updateStaff(staffModal.editing.id, data) : createStaff(data)
        }
      />
      <ShiftModal
        open={shiftModal.open}
        staffMember={shiftModal.staff}
        date={shiftModal.date}
        initial={shiftModal.editing}
        onClose={() => setShiftModal({ open: false, staff: null, date: '', editing: null })}
        onSave={addShift}
        onUpdate={updateShift}
        onDelete={removeShift}
      />
    </div>
  );
}
