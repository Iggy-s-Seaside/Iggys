import { useEffect, useMemo, useState } from 'react';
import { Loader2, Send, CalendarCheck, AlertTriangle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import Select from '../ui/Select';
import { useMessageTemplates } from '../../hooks/useMessageTemplates';
import { fillTemplate } from '../../utils/fillTemplate';
import { sendPartyEmail, syncPartyCalendar } from '../../lib/partyActions';
import { generateGoogleCalendarUrl } from '../../utils/calendarSync';
import { supabase } from '../../lib/supabase';
import { DEFAULT_MESSAGE_TEMPLATES } from '../../data/messageTemplates';
import type { IggyEvent, Party } from '../../types';

interface ConfirmPartyModalProps {
  open: boolean;
  onClose: () => void;
  party: Party;
  /** Mark the party confirmed in the DB + refresh. Called after a successful send. */
  onConfirmed: () => Promise<void> | void;
}

const DEFAULT_CONFIRMATION = DEFAULT_MESSAGE_TEMPLATES.find((t) => t.category === 'confirmation')!;

export function ConfirmPartyModal({ open, onClose, party, onConfirmed }: ConfirmPartyModalProps) {
  const { templates } = useMessageTemplates();
  const confirmationTemplates = useMemo(
    () => templates.filter((t) => t.category === 'confirmation'),
    [templates]
  );

  const [templateId, setTemplateId] = useState<string>('default');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [sending, setSending] = useState(false);
  const [dateConflicts, setDateConflicts] = useState(0);

  // (Re)fill the draft whenever the modal opens, the party changes, or a template is picked.
  useEffect(() => {
    if (!open) return;
    const tpl =
      templateId === 'default'
        ? DEFAULT_CONFIRMATION
        : confirmationTemplates.find((t) => String(t.id) === templateId) ?? DEFAULT_CONFIRMATION;
    setSubject(fillTemplate(tpl.subject || '', party));
    setBody(fillTemplate(tpl.body || '', party));
  }, [open, templateId, party, confirmationTemplates]);

  // Warn if another CONFIRMED event already holds this date (double-booking guardrail).
  useEffect(() => {
    if (!open || !party.event_date) { setDateConflicts(0); return; }
    let active = true;
    (async () => {
      const { count } = await supabase
        .from('parties')
        .select('*', { count: 'exact', head: true })
        .eq('event_date', party.event_date)
        .eq('status', 'confirmed')
        .neq('id', party.id);
      if (active) setDateConflicts(count || 0);
    })();
    return () => { active = false; };
  }, [open, party.event_date, party.id]);

  const openCalendarFallback = () => {
    if (!party.event_date) return;
    const pseudo: IggyEvent = {
      id: party.id,
      created_at: party.created_at,
      title: party.title?.trim() || `Private Party — ${party.contact_name}`,
      description: [party.food_notes, party.drink_notes].filter(Boolean).join('\n\n'),
      date: party.event_date,
      time: party.start_time || '12:00 PM',
      image_url: null,
      is_recurring: false,
      recurring_day: null,
      category: 'Private Party',
      active: true,
      start_min: null,
      end_min: null,
      all_day: false,
      space: party.space,
    };
    window.open(generateGoogleCalendarUrl(pseudo), '_blank', 'noopener');
  };

  const handleSend = async () => {
    if (!party.contact_email) {
      toast.error('Add an email address for this contact first.');
      return;
    }
    setSending(true);
    let emailOk = false;
    try {
      await sendPartyEmail({
        to: party.contact_email,
        subject,
        body,
        partyId: party.id,
        kind: 'confirmation',
      });
      emailOk = true;
      toast.success(`Confirmation sent to ${party.contact_email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send confirmation');
    }

    if (emailOk && addToCalendar) {
      if (!party.event_date) {
        toast('Set an event date to add it to the calendar.', { icon: '📅' });
      } else {
        try {
          await syncPartyCalendar('create', party.id);
          toast.success('Added to Google Calendar');
        } catch (err) {
          toast.error(
            (err instanceof Error ? err.message : 'Calendar sync failed') + ' Opening one-click add instead…'
          );
          openCalendarFallback();
        }
      }
    }

    if (emailOk) {
      await onConfirmed();
      onClose();
    }
    setSending(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Confirm & send recap" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {!party.contact_email && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-light p-3 text-xs text-accent-hover">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            This contact has no email address — add one before sending the confirmation.
          </div>
        )}

        {dateConflicts > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-light p-3 text-xs text-accent-hover">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Heads up: this date already has {dateConflicts} confirmed event{dateConflicts > 1 ? 's' : ''}. You can still confirm if you're double-booking on purpose.
          </div>
        )}

        <div>
          <label className="label">Template</label>
          <Select<string>
            variant="manager"
            leadingIcon={FileText}
            value={templateId}
            onChange={setTemplateId}
            options={[
              { value: 'default', label: 'Default recap' },
              ...confirmationTemplates.map((t) => ({ value: String(t.id), label: t.name })),
            ]}
          />
        </div>

        <div>
          <label className="label">Subject</label>
          <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div>
          <label className="label">Message (review &amp; edit before sending)</label>
          <textarea className="input-field min-h-[260px] resize-y font-mono text-xs leading-relaxed"
            value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" className="accent-primary" checked={addToCalendar}
            onChange={(e) => setAddToCalendar(e.target.checked)} />
          <CalendarCheck size={15} /> Add this event to the Google Calendar
        </label>

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSend} disabled={sending || !party.contact_email || !subject.trim() || !body.trim()}
            className="btn-primary">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send confirmation
          </button>
        </div>
      </div>
    </Modal>
  );
}
