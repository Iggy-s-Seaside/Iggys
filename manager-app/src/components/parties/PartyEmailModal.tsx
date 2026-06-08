import { useEffect, useMemo, useState } from 'react';
import { Loader2, Send, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import Select from '../ui/Select';
import { useMessageTemplates } from '../../hooks/useMessageTemplates';
import { fillTemplate } from '../../utils/fillTemplate';
import { sendPartyEmail } from '../../lib/partyActions';
import { DEFAULT_MESSAGE_TEMPLATES } from '../../data/messageTemplates';
import type { Party, TemplateCategory } from '../../types';

interface PartyEmailModalProps {
  open: boolean;
  onClose: () => void;
  party: Party;
  category: TemplateCategory;
  heading: string;
  /** Called after a successful send (e.g. to stamp last_contacted_at). */
  onSent?: () => Promise<void> | void;
}

export function PartyEmailModal({ open, onClose, party, category, heading, onSent }: PartyEmailModalProps) {
  const { templates } = useMessageTemplates();
  const options = useMemo(() => templates.filter((t) => t.category === category), [templates, category]);
  const fallback = useMemo(
    () => DEFAULT_MESSAGE_TEMPLATES.find((t) => t.category === category) ?? null,
    [category]
  );

  const [templateId, setTemplateId] = useState('default');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const tpl =
      templateId === 'default'
        ? fallback
        : options.find((t) => String(t.id) === templateId) ?? fallback;
    setSubject(fillTemplate(tpl?.subject || '', party));
    setBody(fillTemplate(tpl?.body || '', party));
  }, [open, templateId, party, options, fallback]);

  const handleSend = async () => {
    if (!party.contact_email) {
      toast.error('Add an email address for this contact first.');
      return;
    }
    setSending(true);
    try {
      await sendPartyEmail({ to: party.contact_email, subject, body, partyId: party.id, kind: category });
      toast.success(`Sent to ${party.contact_email}`);
      await onSent?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    }
    setSending(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={heading} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {(options.length > 0 || fallback) && (
          <div>
            <label className="label">Template</label>
            <Select<string>
              variant="manager"
              leadingIcon={FileText}
              value={templateId}
              onChange={setTemplateId}
              options={[
                ...(fallback ? [{ value: 'default', label: 'Default' }] : []),
                ...options.map((t) => ({ value: String(t.id), label: t.name })),
              ]}
            />
          </div>
        )}
        <div>
          <label className="label">Subject</label>
          <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea className="input-field min-h-[220px] resize-y text-sm leading-relaxed"
            value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSend} disabled={sending || !party.contact_email || !body.trim()} className="btn-primary">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
          </button>
        </div>
      </div>
    </Modal>
  );
}
