import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, PartyPopper, Loader2, Lock, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AvailabilityCalendar from '../components/booking/AvailabilityCalendar';
import { usePublicCalendar } from '../hooks/usePublicCalendar';
import { formatRange, minToLabel, windowsOverlap, spaceLabel, spacesConflict, SPACES, type Space } from '../lib/calendarDates';
import TimeSelect from '../components/ui/TimeSelect';
import PackageEstimator from '../components/booking/PackageEstimator';

interface PackageRow {
  id: number;
  name: string;
  description: string | null;
  category: string;
  price: number;
  unit: string;
  active: boolean;
  sort_order: number;
}

const inputClasses =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-text-dim focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition';

const PARTY_TYPES = ['Birthday', 'Corporate', 'Celebration of life', 'Holiday party', 'Other'];

export default function BookEvent() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const { fullyBlockedDaysFor, busyDaysFor, busyWindowsForDate, reservedByDay, eventsByDay, loading: availLoading } =
    usePublicCalendar();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '',
    guest_count: '', party_type: '', start_time: '', notes: '',
    company_website: '', // honeypot
  });
  const [date, setDate] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(true);
  const [space, setSpace] = useState<Space>('upstairs');
  const [startMin, setStartMin] = useState<number | null>(null);
  const [endMin, setEndMin] = useState<number | null>(null);
  const [allDay, setAllDay] = useState(false);
  const [selectedPkgs, setSelectedPkgs] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('packages').select('*').eq('active', true).order('sort_order');
      setPackages((data as PackageRow[]) || []);
    })();
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const togglePkg = (id: number) =>
    setSelectedPkgs((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Fully blocked + busy days for the chosen space (PRIVATE mode).
  const taken = useMemo(
    () => (isPrivate ? fullyBlockedDaysFor(space) : new Set<string>()),
    [isPrivate, fullyBlockedDaysFor, space]
  );

  // Days that are busy but not fully blocked (informational accent dots).
  const busyDays = useMemo(() => {
    if (!isPrivate) {
      // General mode: every busy day, informational only, still selectable.
      const all = new Set<string>();
      for (const k of eventsByDay.keys()) all.add(k);
      for (const k of reservedByDay.keys()) all.add(k);
      return all;
    }
    const blocked = fullyBlockedDaysFor(space);
    const s = new Set<string>();
    for (const k of busyDaysFor(space)) if (!blocked.has(k)) s.add(k);
    return s;
  }, [isPrivate, busyDaysFor, fullyBlockedDaysFor, space, eventsByDay, reservedByDay]);

  // Busy windows already on the chosen date, filtered to the chosen space.
  const busyWindows = useMemo(
    () => (date ? busyWindowsForDate(date) : []),
    [date, busyWindowsForDate]
  );

  // Windows that actually conflict with the chosen space — used for the "already
  // booked" list and the private-mode time-conflict check.
  const conflictingWindows = useMemo(
    () => (isPrivate ? busyWindows.filter((w) => spacesConflict(space, w.space)) : []),
    [isPrivate, busyWindows, space]
  );

  // For a private booking, the requested [start, end] must not overlap any busy
  // window that day. All-day windows (all_day || null start) block everything.
  const timeConflict = useMemo(() => {
    if (!isPrivate || allDay || startMin === null || endMin === null) return false;
    return conflictingWindows.some((w) => {
      if (w.all_day || w.start_min === null || w.end_min === null) return true;
      return windowsOverlap(startMin, endMin, w.start_min, w.end_min);
    });
  }, [isPrivate, allDay, startMin, endMin, conflictingWindows]);

  // Private bookings need either a full buyout or a valid, non-conflicting time.
  const timeOk = !isPrivate || allDay || (startMin !== null && endMin !== null && endMin > startMin && !timeConflict);

  const canSubmit = useMemo(
    () => form.name.trim() && (form.email.trim() || form.phone.trim()) && date && timeOk && !submitting,
    [form.name, form.email, form.phone, date, timeOk, submitting]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    // Keep the legacy text fields populated: from the structured time selects in
    // private mode, or the free-text "preferred time" note in general mode.
    const legacyStartTime = isPrivate
      ? (!allDay && startMin !== null ? minToLabel(startMin) : null)
      : (form.start_time || null);
    const legacyEndTime = isPrivate && !allDay && endMin !== null ? minToLabel(endMin) : null;
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('submit-booking-request', {
        body: {
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          company: form.company || null,
          event_date: date,
          start_time: legacyStartTime,
          end_time: legacyEndTime,
          guest_count: form.guest_count || null,
          party_type: form.party_type || null,
          notes: form.notes || null,
          package_ids: Array.from(selectedPkgs),
          is_private: isPrivate,
          space: isPrivate ? space : null,
          start_min: isPrivate && !allDay ? startMin : null,
          end_min: isPrivate && !allDay ? endMin : null,
          all_day: isPrivate ? allDay : false,
          company_website: form.company_website, // honeypot
        },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again or call us at (503) 738-0672.');
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <section className="section-padding pt-32 min-h-[70vh] flex items-center">
        <div className="section-container max-w-xl mx-auto text-center">
          <div className="glass-card p-10">
            <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
            <h1 className="font-heading text-3xl font-bold text-white mb-3">Request received!</h1>
            <p className="text-text-muted">
              Thanks{form.name ? `, ${form.name.split(' ')[0]}` : ''}! We've got your event request
              {date ? ` for ${new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` : ''}.
              We'll reach out shortly to lock in the details.
            </p>
            <p className="text-text-muted text-sm mt-4">Need us sooner? Call (503) 738-0672.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="relative py-20 lg:py-28 pt-32 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="uppercase tracking-widest text-xs font-bold text-primary mb-4">Private Events</p>
          <div className="w-12 h-0.5 bg-gradient-to-r from-primary to-accent mx-auto mb-6" />
          <h1 className="font-heading text-4xl lg:text-5xl font-bold text-white flex items-center justify-center gap-3">
            <PartyPopper className="w-9 h-9 text-primary" /> Book Your Event
          </h1>
          <p className="text-text-muted text-lg max-w-2xl mx-auto mt-4">
            Tell us a little about your event — just your name, a date, and how to reach you to start. We'll handle the rest.
          </p>
        </div>
      </section>

      <section className="section-padding">
        <div className="section-container max-w-3xl mx-auto">
          <PackageEstimator />
        </div>
      </section>

      <section className="section-padding">
        <div className="section-container max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* About you */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-heading text-xl font-bold text-white">About you</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-text-muted mb-1 block">Name *</label>
                  <input className={inputClasses} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Your name" required />
                </div>
                <div>
                  <label className="text-sm text-text-muted mb-1 block">Company / group <span className="opacity-60">(optional)</span></label>
                  <input className={inputClasses} value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="e.g., Seaside School District" />
                </div>
                <div>
                  <label className="text-sm text-text-muted mb-1 block">Email</label>
                  <input type="email" className={inputClasses} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" />
                </div>
                <div>
                  <label className="text-sm text-text-muted mb-1 block">Phone</label>
                  <input type="tel" className={inputClasses} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(503) 555-0123" />
                </div>
              </div>
              <p className="text-xs text-text-muted">Leave an email or a phone number so we can reach you.</p>
            </div>

            {/* About the event */}
            <div className="glass-card p-6 space-y-5">
              <h2 className="font-heading text-xl font-bold text-white">About your event</h2>

              <div>
                <label className="text-sm text-text-muted mb-2 block">What kind of request is this?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { key: true, icon: Lock, title: 'Private event', sub: 'Reserve the space for your group' },
                    { key: false, icon: Users, title: 'General request', sub: 'Joining us — e.g. have champagne ready' },
                  ] as const).map((opt) => {
                    const on = isPrivate === opt.key;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={String(opt.key)}
                        type="button"
                        onClick={() => setIsPrivate(opt.key)}
                        aria-pressed={on}
                        className={`relative text-left p-4 rounded-xl border transition min-h-[44px] flex items-start gap-3 ${
                          on ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                        }`}
                      >
                        <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border ${on ? 'bg-primary/15 border-primary/30 text-primary' : 'border-white/10 text-text-muted'}`}>
                          <Icon className="w-5 h-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-white font-medium text-sm">{opt.title}</span>
                          <span className="block text-xs text-text-muted mt-0.5">{opt.sub}</span>
                        </span>
                        {on && <CheckCircle2 className="absolute top-3 right-3 w-4 h-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isPrivate && (
                <div>
                  <label className="text-sm text-text-muted mb-2 block">Which space?</label>
                  <div className="flex flex-wrap gap-2">
                    {SPACES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSpace(s.value)}
                        aria-pressed={space === s.value}
                        className={`px-4 py-2.5 rounded-full text-sm border min-h-[44px] transition ${
                          space === s.value ? 'bg-primary text-background border-primary font-semibold' : 'border-white/15 text-white/80 hover:border-primary/40'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-text-muted mb-2 block">Pick a date *</label>
                <AvailabilityCalendar
                  taken={taken}
                  busyDays={busyDays}
                  value={date}
                  onChange={setDate}
                  loading={availLoading}
                />
              </div>

              {date && isPrivate && conflictingWindows.length > 0 && (
                <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-4">
                  <p className="text-sm font-semibold text-accent mb-2">Already booked that day</p>
                  <ul className="space-y-1 text-sm text-text-muted">
                    {conflictingWindows.map((w, i) => {
                      const where = spaceLabel(w.space);
                      return (
                        <li key={i} className="flex items-center justify-between gap-3">
                          <span className="text-white/80">
                            {w.title || 'Reserved'}
                            {where && <span className="text-text-dim"> · {where}</span>}
                          </span>
                          <span className="text-text-dim shrink-0">
                            {w.kind === 'reserved'
                              ? `Reserved · ${formatRange(w.start_min, w.end_min, w.all_day)}`
                              : formatRange(w.start_min, w.end_min, w.all_day)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs text-text-dim mt-2">Pick a start &amp; end that don't overlap these.</p>
                </div>
              )}

              {date && isPrivate && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-text-muted mb-1 block">Start time *</label>
                      <TimeSelect
                        value={startMin}
                        onChange={setStartMin}
                        busyWindows={busyWindows}
                        space={space}
                        defaultScrollTo={1080}
                        disabled={allDay}
                        label="Start time"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-muted mb-1 block">End time *</label>
                      <TimeSelect
                        value={endMin}
                        onChange={setEndMin}
                        minValue={startMin}
                        busyWindows={busyWindows}
                        space={space}
                        defaultScrollTo={startMin != null ? startMin + 180 : undefined}
                        disabled={allDay || startMin === null}
                        label="End time"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-primary"
                      checked={allDay}
                      onChange={(e) => setAllDay(e.target.checked)}
                    />
                    Full buyout (entire day)
                  </label>
                  {timeConflict && (
                    <p className="text-amber-400 text-sm">That time overlaps something already booked that day. Pick a different window or choose a full buyout.</p>
                  )}
                </div>
              )}

              {date && !isPrivate && (
                <p className="text-sm text-text-muted">
                  Other things may be happening that day — that's fine for a general request.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-text-muted mb-1 block">Guests <span className="opacity-60">(approx.)</span></label>
                  <input type="number" min="1" className={inputClasses} value={form.guest_count} onChange={(e) => set('guest_count', e.target.value)} placeholder="e.g., 30" />
                </div>
                {!isPrivate && (
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">Preferred time <span className="opacity-60">(optional)</span></label>
                    <input className={inputClasses} value={form.start_time} onChange={(e) => set('start_time', e.target.value)} placeholder="e.g., have champagne ready ~7 PM" />
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-text-muted mb-2 block">What's the occasion?</label>
                <div className="flex flex-wrap gap-2">
                  {PARTY_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('party_type', form.party_type === t ? '' : t)}
                      className={`px-4 py-2.5 rounded-full text-sm border min-h-[44px] transition ${
                        form.party_type === t ? 'bg-primary text-background border-primary font-semibold' : 'border-white/15 text-white/80 hover:border-primary/40'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Packages */}
            {packages.length > 0 && (
              <div className="glass-card p-6 space-y-3">
                <h2 className="font-heading text-xl font-bold text-white">Add packages <span className="text-sm text-text-muted font-normal">(optional)</span></h2>
                <p className="text-sm text-text-muted">Pick anything you're interested in — we'll confirm details with you.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {packages.map((p) => {
                    const on = selectedPkgs.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePkg(p.id)}
                        className={`text-left p-4 rounded-xl border transition min-h-[44px] ${
                          on ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-white">{p.name}</span>
                          <span className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${on ? 'bg-primary border-primary' : 'border-white/30'}`}>
                            {on && <CheckCircle2 className="w-4 h-4 text-background" />}
                          </span>
                        </div>
                        {p.description && <p className="text-xs text-text-muted mt-1">{p.description}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="glass-card p-6">
              <label className="text-sm text-text-muted mb-1 block">Anything else we should know?</label>
              <textarea className={inputClasses} rows={4} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Vibe, food/drink ideas, special requests…" />
            </div>

            {/* Honeypot (hidden from humans) */}
            <input
              type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
              value={form.company_website} onChange={(e) => set('company_website', e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            {error && <p className="text-amber-400 text-sm">{error}</p>}

            <button type="submit" disabled={!canSubmit} className="btn-primary w-full text-base py-4 disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Sending…</> : 'Request this date'}
            </button>
            <p className="text-center text-xs text-text-muted">No deposit needed to ask — this just starts the conversation.</p>
          </form>
        </div>
      </section>
    </>
  );
}
