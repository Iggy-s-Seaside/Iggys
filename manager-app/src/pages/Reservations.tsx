import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Phone,
  Clock,
  Bell,
  Armchair,
  Loader2,
  Hourglass,
  X,
  PartyPopper,
  Plus,
  Ban,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { safeFmtDate } from '../utils/format';
import { createPartyFromLead } from '../utils/partyUpsell';
import {
  useReservations,
  suggestWaitQuote,
  DEFAULT_WAITLIST_AREA,
  type WaitlistEntry,
} from '../hooks/useReservations';
import { useConfirm } from '../hooks/useConfirm';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';

// The family does NOT take table reservations — this page is the live walk-up
// waitlist for the host stand. Auto wait-quote, realtime board, "Text table is
// ready" notify, and a private-party upsell for large walk-ups.

// ── Add Walk-in (waitlist) inline form ──

interface WaitlistFormProps {
  partiesWaiting: number;
  onAdd: (input: {
    guest_name: string;
    phone: string | null;
    party_size: number;
    quoted_minutes: number;
    area: string;
  }) => Promise<boolean>;
}

function WaitlistForm({ partiesWaiting, onAdd }: WaitlistFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [size, setSize] = useState(2);
  const [saving, setSaving] = useState(false);
  const sizeId = useId();

  // Area defaults to the main restaurant; bar/patio land here once the room is
  // split. Kept as a single default for now so the form stays one-tap fast.
  const area = DEFAULT_WAITLIST_AREA;

  // Quick party-size chips — the bulk of walk-ups; tap-fast on a phone behind
  // the bar. Odd/large sizes still come from the numeric input.
  const SIZE_CHIPS = [1, 2, 3, 4, 5, 6, 8];

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
      area,
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
          aria-label="Guest name"
        />
        <input
          className="input-field"
          type="tel"
          placeholder="Phone (for text)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-label="Phone number"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={sizeId} className="text-xs text-text-muted shrink-0">Party</label>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Party size">
          {SIZE_CHIPS.map((n) => {
            const active = size === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setSize(n)}
                aria-pressed={active}
                className={`min-w-[40px] min-h-[40px] px-2 rounded-lg text-sm font-semibold tabular-nums transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-text-secondary hover:bg-surface-hover transition-colors'
                }`}
              >
                {n}
              </button>
            );
          })}
          <input
            id={sizeId}
            className="input-field w-16 text-center"
            type="number"
            min={1}
            value={size}
            onChange={(e) => setSize(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Party size (other)"
          />
        </div>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <Hourglass size={13} /> ~{quote} min quote
        </span>
        <button type="submit" disabled={saving} className="btn-primary text-sm ml-auto">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add to waitlist
        </button>
      </div>
    </form>
  );
}

// ── Main page ──

export function Reservations() {
  const {
    waitlist,
    loading,
    error,
    refresh,
    addToWaitlist,
    notifyWaitlist,
    seatWaitlist,
    cancelWaitlist,
    addNoShow,
  } = useReservations();

  const [notifyingId, setNotifyingId] = useState<number | null>(null);
  const [convertingId, setConvertingId] = useState<number | null>(null);

  const confirm = useConfirm();
  const navigate = useNavigate();

  const partiesWaiting = waitlist.filter((w) => w.status === 'waiting').length;

  // Turn a large walk-up into a private-party inquiry, pre-filled from what we
  // already know. Reuses the app's standard party-create path; sends no email.
  // The party stays on the waitlist — this is purely additive.
  const handleStartParty = async (w: WaitlistEntry) => {
    if (convertingId != null) return;
    setConvertingId(w.id);
    const party = await createPartyFromLead({
      contactName: w.guest_name,
      contactPhone: w.phone,
      title: `Party — ${w.guest_name}`,
      eventDate: format(new Date(), 'yyyy-MM-dd'),
      guestCount: w.party_size,
      internalNotes: `Started from a ${w.party_size}-person walk-up on the waitlist (${format(
        new Date(),
        'MMM d, yyyy h:mm a'
      )}).`,
      source: 'walk-in',
    });
    setConvertingId(null);
    if (party) navigate(`/parties/${party.id}`);
  };

  const handleNotify = async (entry: WaitlistEntry) => {
    setNotifyingId(entry.id);
    await notifyWaitlist(entry);
    setNotifyingId(null);
  };

  return (
    <div>
      <PageHeader
        title="Waitlist"
        icon={Users}
        subtitle="Walk-up parties waiting for a table"
      >
        <span className="badge text-text-muted">{safeFmtDate(new Date(), 'EEE, MMM d')}</span>
        {partiesWaiting > 0 && <span className="badge-accent">{partiesWaiting} waiting</span>}
      </PageHeader>

      {error && waitlist.length === 0 ? (
        <ErrorState onRetry={refresh} description="We couldn't load the waitlist. Your guests are safe." />
      ) : (
        <div className="space-y-3 max-w-2xl">
          <WaitlistForm partiesWaiting={partiesWaiting} onAdd={addToWaitlist} />

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-4 bg-surface-hover rounded w-1/3 mb-2" />
                  <div className="h-3 bg-surface-hover rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : waitlist.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No one's waiting"
              description="Walk-ins you add land here. Each gets an auto wait-quote and a one-tap “table is ready” text."
            />
          ) : (
            waitlist.map((w) => (
              <WaitlistRow
                key={w.id}
                entry={w}
                notifying={notifyingId === w.id}
                converting={convertingId === w.id}
                onNotify={() => handleNotify(w)}
                onStartParty={() => handleStartParty(w)}
                onSeat={() => seatWaitlist(w.id)}
                onCancel={async () => {
                  const ok = await confirm({
                    title: 'Remove from waitlist',
                    message: `Remove ${w.guest_name} from the waitlist?`,
                    confirmLabel: 'Remove',
                    danger: true,
                  });
                  if (ok) cancelWaitlist(w.id);
                }}
                onNoShow={async () => {
                  const ok = await confirm({
                    title: 'Mark as no-show',
                    message: `Mark ${w.guest_name} as a no-show? They'll drop off the board.`,
                    confirmLabel: 'No-show',
                    danger: true,
                  });
                  if (ok) addNoShow(w.id);
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Waitlist row ──

interface WaitlistRowProps {
  entry: WaitlistEntry;
  notifying: boolean;
  converting: boolean;
  onNotify: () => void;
  onStartParty: () => void;
  onSeat: () => void;
  onCancel: () => void;
  onNoShow: () => void;
}

/** Large walk-ups are the strongest private-party upsell candidates. */
const LARGE_PARTY_THRESHOLD = 6;

function WaitlistRow({
  entry: w,
  notifying,
  converting,
  onNotify,
  onStartParty,
  onSeat,
  onCancel,
  onNoShow,
}: WaitlistRowProps) {
  const waited = formatDistanceToNow(parseISO(w.created_at), { addSuffix: false });
  const isNotified = w.status === 'notified';
  const isLargeParty = w.party_size >= LARGE_PARTY_THRESHOLD;
  // Don't shout "main-restaurant" when it's the only area; show it once bar/patio exist.
  const showArea = !!w.area && w.area !== DEFAULT_WAITLIST_AREA;
  const areaLabel = w.area ? w.area.replace(/-/g, ' ') : '';

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
            {showArea && <span className="badge text-text-muted capitalize">{areaLabel}</span>}
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

      {isLargeParty && (
        <div className="flex items-center gap-2 mt-3 rounded-lg bg-accent/[0.07] border border-accent/20 px-3 py-2">
          <PartyPopper size={14} className="text-accent shrink-0" />
          <p className="text-xs text-text-secondary">
            Big group ({w.party_size}) — could this be a private party?
          </p>
          <button
            onClick={onStartParty}
            disabled={converting}
            className="btn-secondary text-xs py-1.5 ml-auto shrink-0"
          >
            {converting ? <Loader2 size={14} className="animate-spin" /> : <PartyPopper size={14} />}
            Start a party
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border flex-wrap">
        <button
          onClick={onNotify}
          disabled={notifying}
          className={isNotified ? 'btn-ghost text-xs py-1.5' : 'btn-secondary text-xs py-1.5'}
          title={w.phone ? 'Text the guest their table is ready' : 'No phone on file — marks as notified'}
        >
          {notifying ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
          {isNotified ? 'Re-notify' : 'Notify'}
        </button>
        <button onClick={onSeat} className="btn-primary text-sm px-4 min-h-[48px]">
          <Armchair size={16} /> Seat
        </button>
        <button
          onClick={onNoShow}
          className="btn-ghost text-xs py-1.5 ml-auto text-text-muted hover:text-danger"
          title="Party never showed — drop them off the board"
        >
          <Ban size={14} /> No-show
        </button>
        <button
          onClick={onCancel}
          className="btn-ghost text-xs py-1.5 text-text-muted hover:text-danger"
          title="Remove from the waitlist"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}
