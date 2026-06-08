import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import { Modal, ConfirmDialog } from '../ui/Modal';
import Select from '../ui/Select';
import { useMessageTemplates } from '../../hooks/useMessageTemplates';
import { PLACEHOLDER_KEYS } from '../../utils/fillTemplate';
import {
  TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABELS, type MessageTemplate, type TemplateCategory,
} from '../../types';

interface TemplateManagerProps {
  open: boolean;
  onClose: () => void;
}

const emptyForm = { name: '', category: 'general' as TemplateCategory, subject: '', body: '' };

export function TemplateManager({ open, onClose }: TemplateManagerProps) {
  const { templates, loading, create, update, remove, seedDefaults } = useMessageTemplates();
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setMode('list');
      setEditing(null);
    }
  }, [open]);

  const startNew = () => { setEditing(null); setForm({ ...emptyForm }); setMode('edit'); };
  const startEdit = (t: MessageTemplate) => {
    setEditing(t);
    setForm({ name: t.name, category: t.category, subject: t.subject ?? '', body: t.body });
    setMode('edit');
  };

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      subject: form.subject.trim() || null,
      body: form.body,
    };
    const ok = editing
      ? await update(editing.id, payload)
      : await create(payload as Omit<MessageTemplate, 'id' | 'created_at'>);
    setSaving(false);
    if (ok) setMode('list');
  };

  return (
    <Modal open={open} onClose={onClose} title="Message Templates" maxWidth="max-w-2xl">
      {mode === 'list' ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-text-muted">Reusable responses. Use {'{{placeholders}}'} that auto-fill from a party.</p>
            <button onClick={startNew} className="btn-primary text-sm"><Plus size={15} /> New</button>
          </div>

          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 size={22} className="animate-spin text-primary" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-text-muted mb-4">No templates yet.</p>
              <button onClick={seedDefaults} className="btn-secondary text-sm">
                <Sparkles size={15} /> Load starter templates
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border -mx-1">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-1 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{t.name}</p>
                    <p className="text-xs text-text-muted">{TEMPLATE_CATEGORY_LABELS[t.category]}</p>
                  </div>
                  <button onClick={() => startEdit(t)} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setDeleteId(t.id)} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-danger transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <button type="button" onClick={() => setMode('list')} className="btn-ghost -ml-3 text-sm">
            <ArrowLeft size={15} /> Back to list
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input-field" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Category</label>
              <Select<TemplateCategory>
                variant="manager"
                value={form.category}
                onChange={(v) => setField('category', v)}
                options={TEMPLATE_CATEGORIES.map((c) => ({ value: c, label: TEMPLATE_CATEGORY_LABELS[c] }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input-field" value={form.subject} onChange={(e) => setField('subject', e.target.value)} />
          </div>
          <div>
            <label className="label">Body *</label>
            <textarea className="input-field min-h-[200px] resize-y text-sm leading-relaxed" value={form.body}
              onChange={(e) => setField('body', e.target.value)} required />
          </div>
          <div className="rounded-lg bg-surface-hover/60 p-2.5">
            <p className="text-[11px] text-text-muted">
              Placeholders: {PLACEHOLDER_KEYS.map((k) => `{{${k}}}`).join('  ')}
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setMode('list')} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim() || !form.body.trim()} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {editing ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId); }}
        title="Delete Template"
        message="Delete this template? This cannot be undone."
        confirmLabel="Delete"
      />
    </Modal>
  );
}
