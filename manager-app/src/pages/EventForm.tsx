import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Eye } from 'lucide-react';
import { useSupabaseCRUD } from '../hooks/useSupabaseCRUD';
import { ImageDropzone } from '../components/ui/ImageDropzone';
import PreviewPanel from '../components/preview/PreviewPanel';
import { AddToCalendarButton } from '../components/events/AddToCalendarButton';
import Select from '../components/ui/Select';
import TimeSelect from '../components/ui/TimeSelect';
import { EVENT_CATEGORIES, type IggyEvent } from '../types';
import { formatRange, SPACES, type Space } from '../lib/timeWindows';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function EventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: events, create, update, loading: dataLoading } = useSupabaseCRUD<IggyEvent>('events');
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    start_min: null as number | null,
    end_min: null as number | null,
    all_day: false,
    category: '',
    image_url: null as string | null,
    space: 'downstairs' as Space,
    is_recurring: false,
    recurring_day: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (isEdit && events.length > 0) {
      const event = events.find((e) => e.id === Number(id));
      if (event) {
        setForm({
          title: event.title,
          description: event.description,
          date: event.date,
          time: event.time,
          start_min: event.start_min ?? null,
          end_min: event.end_min ?? null,
          all_day: event.all_day ?? false,
          category: event.category ?? '',
          image_url: event.image_url,
          space: (event.space as Space) ?? 'downstairs',
          is_recurring: event.is_recurring,
          recurring_day: event.recurring_day ?? '',
          active: event.active,
        });
      }
    }
  }, [isEdit, id, events]);

  // Deep-link from the calendar's "New Event" chooser: /events/new?date=YYYY-MM-DD
  // seeds the date once for a brand-new event (never overrides an edit).
  useEffect(() => {
    if (!isEdit) {
      const d = searchParams.get('date');
      if (d) setForm((f) => ({ ...f, date: d }));
    }
  }, [isEdit, searchParams]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.all_day && form.start_min === null) {
      toast.error('Pick a start time for the event.');
      return;
    }
    setSaving(true);
    const start_min = form.all_day ? null : form.start_min;
    const end_min = form.all_day ? null : form.end_min;
    const payload = {
      title: form.title,
      description: form.description,
      date: form.date,
      time: formatRange(start_min, end_min, form.all_day),
      start_min,
      end_min,
      all_day: form.all_day,
      category: form.category || null,
      image_url: form.image_url,
      space: form.space,
      is_recurring: form.is_recurring,
      recurring_day: form.is_recurring ? form.recurring_day : null,
      active: form.active,
    };

    const ok = isEdit
      ? await update(Number(id), payload)
      : await create(payload as Omit<IggyEvent, 'id' | 'created_at'>);

    setSaving(false);
    if (ok) navigate('/events');
  };

  // Build the event object for preview / calendar
  const previewTime =
    form.all_day || form.start_min !== null
      ? formatRange(
          form.all_day ? null : form.start_min,
          form.all_day ? null : form.end_min,
          form.all_day,
        )
      : '';
  const currentEvent: Partial<IggyEvent> = {
    ...form,
    time: previewTime,
    category: form.category || null,
    recurring_day: form.is_recurring ? form.recurring_day : null,
    ...(isEdit && id ? { id: Number(id) } : {}),
  };

  if (dataLoading && isEdit) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/events')} className="btn-ghost -ml-3">
          <ArrowLeft size={18} /> Back to Events
        </button>
        <div className="flex gap-2">
          {isEdit && form.date && previewTime && (
            <AddToCalendarButton event={currentEvent as IggyEvent} />
          )}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="btn-secondary text-sm"
          >
            <Eye size={16} /> Preview
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-6">
        {isEdit ? 'Edit Event' : 'New Event'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-5">
          <div>
            <label className="label">Title *</label>
            <input
              className="input-field"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="DJ Night with DJ Seaside"
              required
            />
          </div>

          <div>
            <label className="label">Description *</label>
            <textarea
              className="input-field min-h-[100px] resize-y"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Join us for an incredible night of music..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                className="input-field"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                required
              />
            </div>
            <div className="flex items-end gap-3 pb-2">
              <button
                type="button"
                onClick={() => setField('all_day', !form.all_day)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.all_day ? 'bg-primary' : 'bg-surface-active'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                  form.all_day ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <span className="text-sm text-text-secondary">All day</span>
            </div>
          </div>

          {!form.all_day && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start *</label>
                <TimeSelect
                  variant="manager"
                  value={form.start_min}
                  onChange={(v) => setField('start_min', v)}
                  placeholder="Select time..."
                />
              </div>
              <div>
                <label className="label">End</label>
                <TimeSelect
                  variant="manager"
                  value={form.end_min}
                  onChange={(v) => setField('end_min', v)}
                  minValue={form.start_min}
                  placeholder="Select time..."
                />
              </div>
            </div>
          )}

          <div>
            <label className="label">Category</label>
            <Select<string>
              variant="manager"
              value={form.category || null}
              onChange={(v) => setField('category', v)}
              options={[{ value: '', label: 'Uncategorized' }, ...EVENT_CATEGORIES.map((cat) => ({ value: cat, label: cat }))]}
              placeholder="Select category..."
            />
          </div>

          <div>
            <label className="label">Space</label>
            <Select<Space>
              variant="manager"
              value={form.space}
              onChange={(v) => setField('space', v)}
              options={SPACES}
              placeholder="Select space..."
            />
          </div>

          <div>
            <label className="label">Event Image</label>
            <ImageDropzone
              value={form.image_url}
              onChange={(url) => setField('image_url', url)}
              folder="events"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setField('is_recurring', !form.is_recurring)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.is_recurring ? 'bg-primary' : 'bg-surface-active'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                form.is_recurring ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            <span className="text-sm text-text-secondary">Recurring event</span>
          </div>

          {form.is_recurring && (
            <div>
              <label className="label">Recurring Day</label>
              <Select<string>
                variant="manager"
                value={form.recurring_day || null}
                onChange={(v) => setField('recurring_day', v)}
                options={WEEKDAYS.map((d) => ({ value: d, label: d }))}
                placeholder="Select day..."
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setField('active', !form.active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.active ? 'bg-primary' : 'bg-surface-active'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                form.active ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            <span className="text-sm text-text-secondary">Active (visible on website)</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Create Event'}
          </button>
          <button type="button" onClick={() => navigate('/events')} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>

      {/* Live Preview Panel */}
      <PreviewPanel
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        type="event"
        data={currentEvent}
      />
    </div>
  );
}
