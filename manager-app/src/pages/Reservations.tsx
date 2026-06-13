import { useMemo, useState } from 'react';
import {
  CalendarClock,
  Plus,
  Users,
  Phone,
  Clock,
  Bell,
  Check,
  X,
  Armchair,
  Loader2,
  Hourglass,
  CircleDollarSign,
  Trash2,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import toast from 'react-hot-toast';
import {
  useReservations,
  suggestWaitQuote,
  RESERVATION_STATUS_LABELS,
  DEPOSIT_STATUS_LABELS,
  type Reservation,
  type WaitlistEntry,
  type FloorTable,
  type ReservationStatus,
  type ReservationDepositStatus,
} from '../hooks/useReservations';

// ── helpers ──

/** Local datetime-local string for "tonight at the next round-ish slot". */
function defaultReservedFor(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  // datetime-local wants no timezone + minute precision
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const RESERVATION_STATUS_TONE: Record<ReservationStatus, string> = {
  booked: 'bg-surface-hover text-text-secondary',
  confirmed: 'bg-primary/10 text-primary',
  seated: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  completed: 'bg-surface-hover text-text-muted',
  cancelled: 'bg-red-50 text-danger dark:bg-red-500/10',
  no_show: 'bg-red-50 text-danger dark:bg-red-500/10',
};

const ACTIVE_RES_STATUSES: ReservationStatus[] = ['booked', 'confirmed', 'seated'];

// ── Add Reservation Modal ──

interface ReservationModalProps {
  open: boolean;
  onClose: () => void;
  tables: FloorTable[];
  sectionName: Map<number, string>;
  onSubmit: (input: {
    guest_name: string;
    phone: string | null;
    party_size: number;
    reserved_for: string;
    table_id: number | null;
    notes: string | null;
    deposit_status: ReservationDepositStatus;
  }) => Promise<boolean>;
}

function ReservationModal({ open, onClose, tables, sectionName, onSubmit }: ReservationModalProps) {
  const [form, setForm] = useState({
    guest_name: '',
    phone: '',
    party_size: 2,
    reserved_for: defaultReservedFor(),
    table_id: null as number | null,
    notes: '',
    deposit_status: 'none' as ReservationDepositStatus,
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.guest_name.trim()) {
      toast.error('Guest name is required');
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      guest_name: form.guest_name.trim(),
      phone: form.phone.trim() || null,
      party_size: form.party_size,
      // datetime-local has no zone; treat as local time → ISO
      reserved_for: new Date(form.reserved_for).toISOString(),
      table_id: form.table_id,
      notes: form.notes.trim() || null,
      deposit_status: form.deposit_status,
    });
    setSaving(false);
    if (ok) {
      setForm({
        guest_name: '',
        phone: '',
        party_size: 2,
        reserved_for: defaultReservedFor(),
        table_id: null,
        notes: '',
        deposit_status: 'none',
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">New Reservation</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Guest name *</label>
            <input
              className="input-field"
              required
              value={form.guest_name}
              onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
              placeholder="e.g. Dana R."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input
                className="input-field"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(503) 555-0199"
              />
            </div>
            <div>
              <label className="label">Party size</label>
              <input
                className="input-field"
                type="number"
                min={1}
                value={form.party_size}
                onChange={(e) => setForm({ ...form, party_size: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          </div>

          <div>
            <label className="label">Reserved for</label>
            <input
              className="input-field"
              type="datetime-local"
              value={form.reserved_for}
              onChange={(e) => setForm({ ...form, reserved_for: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Table</label>
              <select
                className="input-field"
                value={form.table_id ?? ''}
                onChange={(e) => setForm({ ...form, table_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Unassigned</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.seats} seats
                    {t.section_id != null && sectionName.get(t.section_id)
                      ? ` (${sectionName.get(t.section_id)})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Deposit</label>
              <select
                className="input-field"
                value={form.deposit_status}
                onChange={(e) => setForm({ ...form, deposit_status: e.target.value as ReservationDepositStatus })}
              >
                {(Object.keys(DEPOSIT_STATUS_LABELS) as ReservationDepositStatus[]).map((d) => (
                  <option key={d} value={d}>
                    {DEPOSIT_STATUS_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input-field"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Window seat, birthday, allergy…"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add reservation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Walk-in (waitlist) inline form ──

interface WaitlistFormProps {
  partiesWaiting: number;
  onAdd: (input: { guest_name: string; phone: string | null; party_size: number; quoted_minutes: number }) => Promise<boolean>;
}

function WaitlistForm({ partiesWaiting, onAdd }: WaitlistFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [size, setSize] = useState(2);
  const [saving, setSaving] = useState(false);

  const quote = useMemo(() => suggestWaitQuote(partiesWaiting, size), [partiesWaiting, size]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Guest name is required');
      return;
    }
    setSaving(true);
    const ok = await onAdd({
      guest_name: name.trim(),
      phone: phone.trim() || null,
      party_size: size,
      quoted_minutes: quote,
    });
    setSaving(false);
    if (ok) {
      setName('');
      setPhone('');
      setSize(2);
    }
  };

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className="input-field"
          placeholder="Guest name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input-field"
          type="tel"
          placeholder="Phone (for text)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted shrink-0">Party</label>
          <input
            className="input-field w-16 text-center"
            type="number"
            min={1}
            value={size}
            onChange={(e) => setSize(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <Hourglass size={13} /> ~{quote} min quote
        </span>
        <button type="submit" disabled={saving} className="btn-primary text-sm ml-auto">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
        </button>
      </div>
    </form>
  );
}

// ── Main page ──

export function Reservations() {
  const {
    reservations,
    waitlist,
    tables,
    sectionName,
    tableById,
    loading,
    createReservation,
    setReservationStatus,
    seatReservation,
    deleteReservation,
    addToWaitlist,
    notifyWaitlist,
    seatWaitlist,
    cancelWaitlist,
  } = useReservations();

  const [modalOpen, setModalOpen] = useState(false);
  const [notifyingId, setNotifyingId] = useState<number | null>(null);

  const activeReservations = useMemo(
    () => reservations.filter((r) => ACTIVE_RES_STATUSES.includes(r.status)),
    [reservations]
  );
  const partiesWaiting = waitlist.filter((w) => w.status === 'waiting').length;
  const coversTonight = activeReservations.reduce((sum, r) => sum + r.party_size, 0);

  const handleNotify = async (entry: WaitlistEntry) => {
    setNotifyingId(entry.id);
    await notifyWaitlist(entry);
    setNotifyingId(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <CalendarClock size={24} className="text-primary" /> Host Board
          </h1>
          <span className="badge text-text-muted">{format(new Date(), 'EEE, MMM d')}</span>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={16} />
          <span>New reservation</span>
        </button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-text-muted">Reservations</p>
          <p className="text-2xl font-bold text-text-primary mt-1 tabular-nums">{activeReservations.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted">Covers booked</p>
          <p className="text-2xl font-bold text-text-primary mt-1 tabular-nums">{coversTonight}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted">Waiting</p>
          <p className="text-2xl font-bold text-text-primary mt-1 tabular-nums">{partiesWaiting}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Reservations timeline ── */}
        <section>
          <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Clock size={16} /> Tonight's reservations
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-4 bg-surface-hover rounded w-1/3 mb-2" />
                  <div className="h-3 bg-surface-hover rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : activeReservations.length === 0 ? (
            <div className="card p-10 text-center">
              <CalendarClock size={40} className="mx-auto text-text-muted mb-3" />
              <p className="text-sm text-text-muted">No reservations on the books tonight.</p>
              <button onClick={() => setModalOpen(true)} className="btn-primary mt-4">
                Add the first one
              </button>
            </div>
          ) : (
            <ol className="relative space-y-3">
              {activeReservations.map((r) => (
                <ReservationRow
                  key={r.id}
                  reservation={r}
                  table={r.table_id != null ? tableById.get(r.table_id) ?? null : null}
                  onSeat={() => seatReservation(r.id)}
                  onStatus={(s) => setReservationStatus(r.id, s)}
                  onDelete={() => {
                    if (window.confirm(`Remove ${r.guest_name}'s reservation?`)) deleteReservation(r.id);
                  }}
                />
              ))}
            </ol>
          )}
        </section>

        {/* ── Waitlist ── */}
        <section>
          <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Users size={16} /> Waitlist
            {partiesWaiting > 0 && (
              <span className="badge-accent">{partiesWaiting} waiting</span>
            )}
          </h2>

          <div className="space-y-3">
            <WaitlistForm partiesWaiting={partiesWaiting} onAdd={addToWaitlist} />

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="card p-4 animate-pulse">
                    <div className="h-4 bg-surface-hover rounded w-1/3 mb-2" />
                    <div className="h-3 bg-surface-hover rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : waitlist.length === 0 ? (
              <div className="card p-8 text-center">
                <Users size={32} className="mx-auto text-text-muted mb-2" />
                <p className="text-sm text-text-muted">Waitlist is empty. Walk-ins land here.</p>
              </div>
            ) : (
              waitlist.map((w) => (
                <WaitlistRow
                  key={w.id}
                  entry={w}
                  notifying={notifyingId === w.id}
                  onNotify={() => handleNotify(w)}
                  onSeat={() => seatWaitlist(w.id)}
                  onCancel={() => cancelWaitlist(w.id)}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <ReservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tables={tables}
        sectionName={sectionName}
        onSubmit={createReservation}
      />
    </div>
  );
}

// ── Reservation row ──

interface ReservationRowProps {
  reservation: Reservation;
  table: FloorTable | null;
  onSeat: () => void;
  onStatus: (status: ReservationStatus) => void;
  onDelete: () => void;
}

function ReservationRow({ reservation: r, table, onSeat, onStatus, onDelete }: ReservationRowProps) {
  const when = parseISO(r.reserved_for);
  const minsAway = differenceInMinutes(when, new Date());
  const isSeated = r.status === 'seated';
  const isSoon = !isSeated && minsAway >= 0 && minsAway <= 15;
  const isLate = !isSeated && minsAway < 0;

  return (
    <li className={`card p-4 ${isSoon ? 'border-primary/40' : ''} ${isLate ? 'border-amber-400/50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary">{format(when, 'h:mm a')}</span>
            <span className="text-sm text-text-primary truncate">{r.guest_name}</span>
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Users size={12} /> {r.party_size}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${RESERVATION_STATUS_TONE[r.status]}`}>
              {RESERVATION_STATUS_LABELS[r.status]}
            </span>
            {table ? (
              <span className="flex items-center gap-1 text-xs text-text-secondary">
                <Armchair size={12} /> {table.name}
              </span>
            ) : (
              <span className="text-xs text-text-muted">Unassigned</span>
            )}
            {r.deposit_status === 'paid' && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CircleDollarSign size={12} /> Deposit paid
              </span>
            )}
            {r.deposit_status === 'requested' && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <CircleDollarSign size={12} /> Deposit requested
              </span>
            )}
            {r.phone && (
              <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-xs text-text-muted hover:text-primary">
                <Phone size={12} /> {r.phone}
              </a>
            )}
            {isLate && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{Math.abs(minsAway)}m late</span>}
            {isSoon && <span className="text-xs font-medium text-primary">in {minsAway}m</span>}
          </div>
          {r.notes && <p className="text-xs text-text-muted mt-1.5">{r.notes}</p>}
        </div>

        <button
          onClick={onDelete}
          title="Remove"
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-danger shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        {!isSeated ? (
          <button onClick={onSeat} className="btn-primary text-xs py-1.5">
            <Armchair size={14} /> Seat
          </button>
        ) : (
          <button onClick={() => onStatus('completed')} className="btn-secondary text-xs py-1.5">
            <Check size={14} /> Complete
          </button>
        )}
        {r.status === 'booked' && (
          <button onClick={() => onStatus('confirmed')} className="btn-ghost text-xs py-1.5">
            <Check size={14} /> Confirm
          </button>
        )}
        {!isSeated && (
          <button onClick={() => onStatus('no_show')} className="btn-ghost text-xs py-1.5 ml-auto text-text-muted">
            No-show
          </button>
        )}
      </div>
    </li>
  );
}

// ── Waitlist row ──

interface WaitlistRowProps {
  entry: WaitlistEntry;
  notifying: boolean;
  onNotify: () => void;
  onSeat: () => void;
  onCancel: () => void;
}

function WaitlistRow({ entry: w, notifying, onNotify, onSeat, onCancel }: WaitlistRowProps) {
  const waited = formatDistanceToNow(parseISO(w.created_at), { addSuffix: false });
  const isNotified = w.status === 'notified';

  return (
    <div className={`card p-4 ${isNotified ? 'border-primary/40 bg-primary/[0.03]' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary truncate">{w.guest_name}</span>
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Users size={12} /> {w.party_size}
            </span>
            {isNotified && <span className="badge-primary">Notified</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <Clock size={12} /> waiting {waited}
            </span>
            {w.quoted_minutes != null && (
              <span className="flex items-center gap-1">
                <Hourglass size={12} /> quoted {w.quoted_minutes}m
              </span>
            )}
            {w.phone && (
              <a href={`tel:${w.phone}`} className="flex items-center gap-1 hover:text-primary">
                <Phone size={12} /> {w.phone}
              </a>
            )}
            {isNotified && w.notified_at && (
              <span className="text-primary">texted {formatDistanceToNow(parseISO(w.notified_at), { addSuffix: true })}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <button
          onClick={onNotify}
          disabled={notifying}
          className={isNotified ? 'btn-ghost text-xs py-1.5' : 'btn-secondary text-xs py-1.5'}
          title={w.phone ? 'Text the guest their table is ready' : 'No phone on file — marks as notified'}
        >
          {notifying ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
          {isNotified ? 'Re-notify' : 'Notify'}
        </button>
        <button onClick={onSeat} className="btn-primary text-xs py-1.5">
          <Armchair size={14} /> Seat
        </button>
        <button onClick={onCancel} className="btn-ghost text-xs py-1.5 ml-auto text-text-muted hover:text-danger">
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}
