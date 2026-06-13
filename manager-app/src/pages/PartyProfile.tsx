import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, RotateCcw, Pencil, Send,
  CalendarCheck, RefreshCw, Mail, Phone, Building2, Users, Clock, MapPin, Utensils, Wine,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useParty } from '../hooks/useParties';
import { usePartyPackages } from '../hooks/usePackages';
import { PackagePicker } from '../components/packages/PackagePicker';
import { InvoicePanel } from '../components/parties/InvoicePanel';
import { DepositPanel } from '../components/parties/DepositPanel';
import { ConfirmPartyModal } from '../components/parties/ConfirmPartyModal';
import { PartyEmailModal } from '../components/parties/PartyEmailModal';
import { PartyForm } from '../components/parties/PartyForm';
import { Modal } from '../components/ui/Modal';
import { syncPartyCalendar } from '../lib/partyActions';
import { formatRange, spaceLabel, type Space } from '../lib/timeWindows';
import { PARTY_STATUS_LABELS, type PartyStatus } from '../types';

const STATUS_BADGE: Record<PartyStatus, string> = {
  inquiry: 'badge-accent',
  confirmed: 'badge-success',
  cancelled: 'badge-danger',
};

function fmtDate(d: string | null, fmt = 'EEEE, MMMM d, yyyy') {
  if (!d) return null;
  try { return format(parseISO(d), fmt); } catch { return d; }
}
function fmtStamp(d: string | null) {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d, yyyy h:mm a'); } catch { return d; }
}

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="text-text-muted mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{value}</p>
      </div>
    </div>
  );
}

export function PartyProfile() {
  const { id } = useParams();
  const pid = id ? Number(id) : null;
  const navigate = useNavigate();
  const { party, loading, update, refresh } = useParty(pid);
  const { items, addPackage, updateLine, removeLine } = usePartyPackages(pid);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [removeCal, setRemoveCal] = useState(true);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [cancelNoteOpen, setCancelNoteOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [followNotes, setFollowNotes] = useState('');
  const [followDate, setFollowDate] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    if (party) {
      setFollowNotes(party.follow_up_notes ?? '');
      setFollowDate(party.follow_up_date ?? '');
      setInternalNotes(party.internal_notes ?? '');
    }
  }, [party]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }
  if (!party) {
    return (
      <div className="card p-12 text-center">
        <p className="text-text-secondary font-medium">Party not found</p>
        <button onClick={() => navigate('/parties')} className="btn-secondary mt-4 inline-flex">
          <ArrowLeft size={16} /> Back to Parties
        </button>
      </div>
    );
  }

  const handleConfirmed = async () => {
    await update({ status: 'confirmed' });
    await refresh();
  };

  const handleReopen = async () => {
    await update({ status: 'inquiry', cancelled_at: null });
    toast.success('Party reopened');
  };

  const handleCancel = async () => {
    if (removeCal && party.google_calendar_event_id) {
      try {
        await syncPartyCalendar('delete', party.id);
        toast.success('Removed from Google Calendar');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not remove calendar event');
      }
    }
    await update({ status: 'cancelled', cancelled_at: new Date().toISOString() });
    setCancelOpen(false);
    toast.success('Party cancelled — details kept for future use');
  };

  const handleResync = async () => {
    setSyncing(true);
    try {
      await syncPartyCalendar('update', party.id);
      toast.success('Calendar updated');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Calendar sync failed');
    }
    setSyncing(false);
  };

  const title = party.title?.trim() || party.contact_name;
  const timeRange = [party.start_time, party.end_time].filter(Boolean).join(' – ');
  const hasStructuredTime = party.all_day || party.start_min != null;
  const timeDisplay = hasStructuredTime
    ? formatRange(party.start_min, party.end_min, party.all_day)
    : (timeRange || null);

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate('/parties')} className="btn-ghost -ml-3 mb-3">
        <ArrowLeft size={18} /> Back to Parties
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
            <span className={STATUS_BADGE[party.status]}>{PARTY_STATUS_LABELS[party.status]}</span>
          </div>
          {party.event_date && (
            <p className="text-sm text-text-muted mt-1">
              {fmtDate(party.event_date)}{timeRange ? ` · ${timeRange}` : ''}
            </p>
          )}
        </div>
        <button onClick={() => setEditOpen(true)} className="btn-secondary text-sm shrink-0">
          <Pencil size={15} /> Edit
        </button>
      </div>

      {/* Status action bar */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-2">
        {party.status === 'inquiry' && (
          <>
            <button onClick={() => setConfirmOpen(true)} className="btn-primary text-sm">
              <CheckCircle2 size={16} /> Confirm &amp; send recap
            </button>
            <button onClick={() => setFollowUpOpen(true)} className="btn-secondary text-sm">
              <Send size={15} /> Send follow-up
            </button>
            <button onClick={() => setCancelOpen(true)} className="btn-ghost text-sm text-text-muted hover:text-danger">
              <XCircle size={15} /> Cancel
            </button>
          </>
        )}
        {party.status === 'confirmed' && (
          <>
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CalendarCheck size={16} />
              {party.google_calendar_event_id ? 'On Google Calendar' : 'Not yet on calendar'}
            </span>
            {party.confirmation_sent_at && (
              <span className="text-xs text-text-muted">· Confirmed {fmtStamp(party.confirmation_sent_at)}</span>
            )}
            <div className="flex-1" />
            <button onClick={handleResync} disabled={syncing} className="btn-secondary text-sm">
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Re-sync calendar
            </button>
            <button onClick={() => setCancelOpen(true)} className="btn-ghost text-sm text-text-muted hover:text-danger">
              <XCircle size={15} /> Cancel event
            </button>
          </>
        )}
        {party.status === 'cancelled' && (
          <>
            <span className="text-sm text-text-muted">
              Cancelled {party.cancelled_at ? fmtStamp(party.cancelled_at) : ''} — details kept on file.
            </span>
            <div className="flex-1" />
            <button onClick={() => setCancelNoteOpen(true)} className="btn-secondary text-sm">
              <Send size={15} /> Send cancellation note
            </button>
            <button onClick={handleReopen} className="btn-secondary text-sm">
              <RotateCcw size={15} /> Reopen
            </button>
          </>
        )}
      </div>

      <div className="space-y-5">
        {/* Contact */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={Users} label="Name" value={party.contact_name} />
            <Field icon={Building2} label="Company / group" value={party.company} />
            <Field icon={Mail} label="Email" value={party.contact_email} />
            <Field icon={Phone} label="Phone" value={party.contact_phone} />
          </div>
        </div>

        {/* Event details */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Event details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={Clock} label="Date" value={fmtDate(party.event_date)} />
            <Field icon={Clock} label="Time" value={timeDisplay} />
            <Field icon={Users} label="Booking type" value={party.is_private ? 'Private (exclusive)' : 'General (coexisting)'} />
            <Field icon={Clock} label="Setup" value={party.setup_time} />
            <Field icon={Users} label="Guests" value={party.guest_count != null ? String(party.guest_count) : null} />
            <Field icon={MapPin} label="Space" value={[spaceLabel(party.space as Space | null), party.space_name].filter(Boolean).join(' — ')} />
            <Field icon={Utensils} label="Food service" value={party.food_service_type} />
          </div>
          {(party.food_notes || party.drink_notes || party.special_requests) && (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              <Field icon={Utensils} label="Food notes" value={party.food_notes} />
              <Field icon={Wine} label="Drink notes" value={party.drink_notes} />
              <Field icon={Pencil} label="Special requests" value={party.special_requests} />
            </div>
          )}
        </div>

        {/* Follow-up (inquiry only) */}
        {party.status === 'inquiry' && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Follow-up</h3>
            {party.last_contacted_at && (
              <p className="text-xs text-text-muted mb-3">Last contacted {fmtStamp(party.last_contacted_at)}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="sm:col-span-1">
                <label className="label">Follow up by</label>
                <input type="date" className="input-field" value={followDate}
                  onChange={(e) => setFollowDate(e.target.value)} />
              </div>
            </div>
            <label className="label">Notes</label>
            <textarea className="input-field min-h-[70px] resize-y mb-3" value={followNotes}
              onChange={(e) => setFollowNotes(e.target.value)} placeholder="What's pending, what to send next…" />
            <button
              onClick={() => update({ follow_up_notes: followNotes || null, follow_up_date: followDate || null })}
              disabled={followNotes === (party.follow_up_notes ?? '') && followDate === (party.follow_up_date ?? '')}
              className="btn-secondary text-xs"
            >
              Save follow-up
            </button>
          </div>
        )}

        {/* Packages */}
        <PackagePicker
          items={items}
          guestCount={party.guest_count}
          roomHours={party.room_hours}
          onAdd={addPackage}
          onUpdateLine={updateLine}
          onRemoveLine={removeLine}
        />

        {/* Invoice */}
        <InvoicePanel party={party} lines={items} onSave={update} />

        {/* Deposit & payment */}
        <DepositPanel party={party} lines={items} onSave={update} />

        {/* Internal notes */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Internal notes</h3>
          <textarea className="input-field min-h-[70px] resize-y mb-3" value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)} placeholder="Private notes — never emailed to the customer." />
          <button
            onClick={() => update({ internal_notes: internalNotes || null })}
            disabled={internalNotes === (party.internal_notes ?? '')}
            className="btn-secondary text-xs"
          >
            Save notes
          </button>
        </div>
      </div>

      {/* Modals */}
      <ConfirmPartyModal open={confirmOpen} onClose={() => setConfirmOpen(false)} party={party} onConfirmed={handleConfirmed} />
      <PartyEmailModal open={followUpOpen} onClose={() => setFollowUpOpen(false)} party={party}
        category="follow_up" heading="Send follow-up"
        onSent={async () => { await update({ last_contacted_at: new Date().toISOString() }); }} />
      <PartyEmailModal open={cancelNoteOpen} onClose={() => setCancelNoteOpen(false)} party={party}
        category="cancellation" heading="Send cancellation note" />
      <PartyForm open={editOpen} onClose={() => setEditOpen(false)} party={party} onSave={(payload) => update(payload)} />

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this party" maxWidth="max-w-sm">
        <p className="text-sm text-text-secondary mb-4">
          We'll keep the full profile and the contact on your email list for future use. This just moves it to Cancelled.
        </p>
        {party.google_calendar_event_id && (
          <label className="flex items-center gap-2 text-sm text-text-secondary mb-5">
            <input type="checkbox" className="accent-primary" checked={removeCal}
              onChange={(e) => setRemoveCal(e.target.checked)} />
            Also remove the event from Google Calendar
          </label>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={() => setCancelOpen(false)} className="btn-secondary">Keep</button>
          <button onClick={handleCancel} className="btn-danger">Cancel party</button>
        </div>
      </Modal>
    </div>
  );
}
