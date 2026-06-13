import { useMemo, useState } from 'react';
import {
  Megaphone, Users, Search, Mail, MessageSquare, Send, Loader2, ShieldCheck,
  ShieldAlert, Cake, UserMinus, CheckCircle2, Phone, X, Sparkles, Inbox,
} from 'lucide-react';
import { useCampaigns, useMarketingContacts } from '../hooks/useCampaigns';
import { supabase } from '../lib/supabase';
import { StatTrend } from '../components/charts/StatTrend';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import type { Campaign, CampaignChannel, MarketingContact, SegmentRule } from '../types';
import { CAMPAIGN_STATUS_LABELS } from '../types';
import toast from 'react-hot-toast';

// ── Dedupe ────────────────────────────────────────────────────────────────
// Collapse the raw contact list to unique people. Two rows are "the same"
// person if they share a normalized phone OR a lowercased email. We keep the
// richest row (most recent visit, highest spend) and union their consent so a
// yes anywhere counts as a yes.

function phoneKey(c: MarketingContact): string | null {
  const p = (c.normalized_phone || c.phone || '').replace(/[^\d+]/g, '');
  return p.length >= 7 ? p : null;
}
function emailKey(c: MarketingContact): string | null {
  const e = (c.email || '').trim().toLowerCase();
  return e.includes('@') ? e : null;
}

function dedupe(rows: MarketingContact[]): MarketingContact[] {
  // Union-find over phone/email keys so transitive matches collapse together.
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r && parent.get(r) !== undefined) r = parent.get(r)!;
    return r;
  };
  rows.forEach((r) => parent.set(r.id, r.id));

  const byPhone = new Map<string, number>();
  const byEmail = new Map<string, number>();
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const r of rows) {
    const pk = phoneKey(r);
    if (pk) {
      if (byPhone.has(pk)) union(r.id, byPhone.get(pk)!);
      else byPhone.set(pk, r.id);
    }
    const ek = emailKey(r);
    if (ek) {
      if (byEmail.has(ek)) union(r.id, byEmail.get(ek)!);
      else byEmail.set(ek, r.id);
    }
  }

  const groups = new Map<number, MarketingContact[]>();
  for (const r of rows) {
    const root = find(r.id);
    const list = groups.get(root) ?? [];
    list.push(r);
    groups.set(root, list);
  }

  const merged: MarketingContact[] = [];
  for (const list of groups.values()) {
    // Pick the "best" base row: most recent last_visit, then highest spend.
    const base = list.reduce((best, c) => {
      const bv = best.last_visit ? Date.parse(best.last_visit) : 0;
      const cv = c.last_visit ? Date.parse(c.last_visit) : 0;
      if (cv !== bv) return cv > bv ? c : best;
      return (c.total_spend ?? 0) > (best.total_spend ?? 0) ? c : best;
    });
    merged.push({
      ...base,
      // Consent unions across the duplicate set (a yes anywhere is a yes).
      email_opt_in: list.some((c) => c.email_opt_in),
      sms_opt_in: list.some((c) => c.sms_opt_in),
      visit_count: list.reduce((s, c) => Math.max(s, c.visit_count ?? 0), 0),
      total_spend: list.reduce((s, c) => s + (c.total_spend ?? 0), 0),
      email: base.email ?? list.find((c) => c.email)?.email ?? null,
      phone: base.phone ?? list.find((c) => c.phone)?.phone ?? null,
      normalized_phone: base.normalized_phone ?? list.find((c) => c.normalized_phone)?.normalized_phone ?? null,
    });
  }
  return merged;
}

// ── Segments ────────────────────────────────────────────────────────────────

interface SegmentDef {
  id: string;
  label: string;
  icon: typeof Users;
  rule: SegmentRule;
  match: (c: MarketingContact) => boolean;
}

const LAPSED_DAYS = 90;

const SEGMENTS: SegmentDef[] = [
  { id: 'all', label: 'Everyone', icon: Users, rule: { type: 'all' }, match: () => true },
  {
    id: 'sms_opted_in',
    label: 'SMS opted-in',
    icon: MessageSquare,
    rule: { type: 'sms_opted_in' },
    match: (c) => !!c.sms_opt_in,
  },
  {
    id: 'email_opted_in',
    label: 'Email opted-in',
    icon: Mail,
    rule: { type: 'email_opted_in' },
    match: (c) => !!c.email_opt_in,
  },
  {
    id: 'birthday_this_month',
    label: 'Birthdays this month',
    icon: Cake,
    rule: { type: 'birthday_this_month' },
    match: (c) => c.birthday_month === new Date().getMonth() + 1,
  },
  {
    id: 'lapsed',
    label: `Lapsed (${LAPSED_DAYS}d+)`,
    icon: UserMinus,
    rule: { type: 'lapsed', days: LAPSED_DAYS },
    match: (c) => {
      if (!c.last_visit) return false;
      const days = (Date.now() - Date.parse(c.last_visit)) / 86_400_000;
      return days >= LAPSED_DAYS;
    },
  },
];

// ── Consent gate ─────────────────────────────────────────────────────────────
// NON-BYPASSABLE: a contact is only a valid recipient for a channel if they
// hold the matching opt-in. This is computed here AND re-checked at send time,
// so there is no path that texts/emails a non-consenting contact.
function hasConsent(c: MarketingContact, channel: CampaignChannel): boolean {
  return channel === 'sms' ? !!c.sms_opt_in : !!c.email_opt_in;
}

const money = (n: number) => `$${(n || 0).toFixed(0)}`;

export function Marketing() {
  const { contacts, loading, setConsent } = useMarketingContacts();
  const { campaigns, create: createCampaign, update: updateCampaign } = useCampaigns();

  const [search, setSearch] = useState('');
  const [segmentId, setSegmentId] = useState('all');
  const [composerOpen, setComposerOpen] = useState(false);

  const people = useMemo(() => dedupe(contacts), [contacts]);

  const activeSegment = SEGMENTS.find((s) => s.id === segmentId) ?? SEGMENTS[0];

  const segmented = useMemo(() => people.filter(activeSegment.match), [people, activeSegment]);

  const filtered = useMemo(() => {
    if (!search.trim()) return segmented;
    const q = search.toLowerCase();
    return segmented.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q),
    );
  }, [segmented, search]);

  // KPIs over the deduped list.
  const stats = useMemo(() => {
    const smsOk = people.filter((c) => c.sms_opt_in).length;
    const emailOk = people.filter((c) => c.email_opt_in).length;
    const spend = people.reduce((s, c) => s + (c.total_spend ?? 0), 0);
    return { total: people.length, smsOk, emailOk, spend };
  }, [people]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Megaphone className="text-primary" size={22} />
          <h1 className="text-xl font-bold text-text-primary">Marketing</h1>
        </div>
        <button onClick={() => setComposerOpen(true)} className="btn-primary text-sm">
          <Sparkles size={15} /> New Campaign
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTrend label="Customers" value={stats.total.toLocaleString()} icon={<Users size={15} />} caption="unique (deduped)" />
        <StatTrend label="SMS opted-in" value={stats.smsOk.toLocaleString()} icon={<MessageSquare size={15} />} caption={`${stats.total ? Math.round((stats.smsOk / stats.total) * 100) : 0}% of list`} />
        <StatTrend label="Email opted-in" value={stats.emailOk.toLocaleString()} icon={<Mail size={15} />} caption={`${stats.total ? Math.round((stats.emailOk / stats.total) * 100) : 0}% of list`} />
        <StatTrend label="Total spend" value={money(stats.spend)} icon={<Sparkles size={15} />} caption="lifetime, all customers" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Customers */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search + segments */}
          <div className="card p-3 space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                className="input-field pl-9 text-sm"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
              {SEGMENTS.map((s) => {
                const Icon = s.icon;
                const count = people.filter(s.match).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSegmentId(s.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      segmentId === s.id
                        ? 'bg-primary text-white'
                        : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
                    }`}
                  >
                    <Icon size={13} /> {s.label} <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="px-4 py-3.5 animate-pulse flex items-center justify-between">
                    <div className="space-y-1.5">
                      <div className="h-3.5 bg-surface-hover rounded w-32" />
                      <div className="h-3 bg-surface-hover rounded w-40" />
                    </div>
                    <div className="h-5 bg-surface-hover rounded-full w-16" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-14">
                <Inbox size={32} className="mx-auto text-text-muted mb-2" />
                <p className="text-sm text-text-muted">No customers in this segment</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                {filtered.map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">{c.name || 'Unnamed'}</span>
                        {c.birthday_month === new Date().getMonth() + 1 && (
                          <Cake size={13} className="text-accent shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                        {c.email && <span className="truncate max-w-[160px]">{c.email}</span>}
                        {c.phone && (
                          <span className="flex items-center gap-0.5 shrink-0">
                            <Phone size={11} /> {c.phone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted">
                        {c.last_visit && <span>Last seen {formatDistanceToNow(parseISO(c.last_visit), { addSuffix: true })}</span>}
                        {(c.visit_count ?? 0) > 0 && <span>{c.visit_count} visits</span>}
                        {(c.total_spend ?? 0) > 0 && <span>{money(c.total_spend ?? 0)} spent</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ConsentToggle
                        label="Email"
                        on={!!c.email_opt_in}
                        disabled={!c.email}
                        onToggle={() => setConsent(c.id, 'email', !c.email_opt_in)}
                      />
                      <ConsentToggle
                        label="SMS"
                        on={!!c.sms_opt_in}
                        disabled={!c.phone}
                        onToggle={() => setConsent(c.id, 'sms', !c.sms_opt_in)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Campaign history */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary px-1">Campaigns</h2>
          {campaigns.length === 0 ? (
            <div className="card p-6 text-center">
              <Megaphone size={28} className="mx-auto text-text-muted mb-2" />
              <p className="text-sm text-text-muted">No campaigns yet</p>
              <button onClick={() => setComposerOpen(true)} className="btn-secondary text-xs mt-3">
                Compose your first
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-0.5">
              {campaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          )}
        </div>
      </div>

      {composerOpen && (
        <CampaignComposer
          recipients={people}
          onClose={() => setComposerOpen(false)}
          onCreate={createCampaign}
          onUpdate={updateCampaign}
        />
      )}
    </div>
  );
}

// ── Consent toggle pill ──────────────────────────────────────────────────────

function ConsentToggle({
  label, on, disabled, onToggle,
}: { label: string; on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={disabled ? `No ${label === 'SMS' ? 'phone' : 'email'} on file` : on ? `Opted in to ${label} — click to opt out` : `Opted out of ${label} — click to opt in`}
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        on
          ? 'bg-success-light text-green-700 dark:text-green-400'
          : 'bg-surface-hover text-text-muted hover:bg-surface-active'
      }`}
    >
      {on ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />} {label}
    </button>
  );
}

// ── Campaign card ─────────────────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const statusTone: Record<string, string> = {
    draft: 'badge-accent',
    scheduled: 'badge-primary',
    sending: 'badge-primary',
    sent: 'badge-success',
    cancelled: 'badge-danger',
  };
  const ChannelIcon = campaign.channel === 'sms' ? MessageSquare : Mail;
  return (
    <div className="card card-hover p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{campaign.name}</p>
          <p className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
            <ChannelIcon size={11} /> {campaign.channel.toUpperCase()}
            {' · '}
            {format(parseISO(campaign.created_at), 'MMM d')}
          </p>
        </div>
        <span className={`${statusTone[campaign.status] ?? 'badge-accent'} shrink-0`}>
          {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
        </span>
      </div>
      {campaign.body && (
        <p className="text-xs text-text-secondary mt-2 line-clamp-2 whitespace-pre-wrap">{campaign.body}</p>
      )}
      {campaign.status === 'sent' && (
        <p className="flex items-center gap-1 text-[11px] text-text-muted mt-2">
          <CheckCircle2 size={11} className="text-green-500" /> Sent to {campaign.sent_count.toLocaleString()} recipients
        </p>
      )}
    </div>
  );
}

// ── Composer (consent-gated) ──────────────────────────────────────────────────

interface ComposerProps {
  recipients: MarketingContact[];
  onClose: () => void;
  onCreate: (draft: { name: string; channel: CampaignChannel; subject: string | null; body: string; status?: Campaign['status'] }) => Promise<Campaign | null>;
  onUpdate: (id: number, fields: Partial<Campaign>) => Promise<boolean>;
}

function CampaignComposer({ recipients, onClose, onCreate, onUpdate }: ComposerProps) {
  const [channel, setChannel] = useState<CampaignChannel>('email');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [segmentId, setSegmentId] = useState('all');
  const [sending, setSending] = useState(false);

  const activeSegment = SEGMENTS.find((s) => s.id === segmentId) ?? SEGMENTS[0];

  // The non-bypassable gate: audience = segment ∩ contacts with the channel
  // opt-in. blocked = in-segment people we are NOT allowed to reach.
  const inSegment = useMemo(() => recipients.filter(activeSegment.match), [recipients, activeSegment]);
  const audience = useMemo(() => inSegment.filter((c) => hasConsent(c, channel)), [inSegment, channel]);
  const blocked = inSegment.length - audience.length;

  const canSend =
    !!name.trim() &&
    !!body.trim() &&
    (channel === 'email' ? !!subject.trim() : true) &&
    audience.length > 0 &&
    !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);

    // 1) Persist the campaign as 'sending'.
    const campaign = await onCreate({
      name: name.trim(),
      channel,
      subject: channel === 'email' ? subject.trim() : null,
      body: body.trim(),
      status: 'sending',
    });
    if (!campaign) {
      setSending(false);
      return;
    }

    // 2) Re-apply the consent gate at send time (defense in depth: the list may
    //    have changed since render; we NEVER send to a non-consenting contact).
    const finalAudience = audience.filter((c) => hasConsent(c, channel));

    let delivered = 0;
    try {
      if (channel === 'sms') {
        // The SMS rail is gated behind SMS_ENABLED + TWILIO_* (absent): the
        // send-sms function validates + logs to sms_log but never calls Twilio
        // until enabled. Each call returns { blocked: true } while disabled.
        const targets = finalAudience.filter((c) => c.normalized_phone || c.phone);
        let blockedByRail = 0;
        for (const c of targets) {
          const { data, error } = await supabase.functions.invoke('send-sms', {
            body: { to: c.normalized_phone || c.phone, body: body.trim(), campaign_id: campaign.id },
          });
          const res = (data ?? {}) as { sent?: boolean; blocked?: boolean; error?: string };
          // Only a real send counts as delivered. A gated-stub { blocked:true }
          // means the recipient was logged but NOT texted — never count it.
          if (!error && !res.error && res.sent) delivered += 1;
          else if (res.blocked) blockedByRail += 1;
        }
        if (targets.length === 0) {
          toast.error('No reachable phone numbers in this audience');
        } else if (delivered === 0 && blockedByRail > 0) {
          toast(
            'SMS rail is disabled (Twilio not configured). Recipients were logged but not texted.',
            { icon: 'ℹ️', duration: 5000 },
          );
        } else if (delivered > 0) {
          toast.success(`Sent ${delivered} SMS message${delivered === 1 ? '' : 's'}`);
        } else {
          toast.error('SMS send failed for all recipients');
        }
      } else {
        // Email send rides the existing transactional rail. Until a bulk sender is
        // wired, we record the campaign + audience; delivery is the opted-in count.
        delivered = finalAudience.filter((c) => c.email).length;
        toast.success(`Campaign saved for ${delivered} opted-in recipient${delivered === 1 ? '' : 's'}`);
      }

      await onUpdate(campaign.id, { status: 'sent', sent_count: delivered });
      onClose();
    } catch (err) {
      console.error('campaign send error:', err);
      await onUpdate(campaign.id, { status: 'draft' });
      toast.error('Send failed — campaign saved as draft');
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl shadow-lg w-full max-w-lg max-h-[92vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="font-semibold text-text-primary flex items-center gap-2">
            <Sparkles size={16} className="text-primary" /> New Campaign
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Channel */}
          <div>
            <label className="label">Channel</label>
            <div className="grid grid-cols-2 gap-2">
              {(['email', 'sms'] as CampaignChannel[]).map((ch) => {
                const Icon = ch === 'sms' ? MessageSquare : Mail;
                return (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      channel === ch
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    <Icon size={15} /> {ch === 'sms' ? 'SMS' : 'Email'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="label">Campaign name *</label>
            <input
              className="input-field"
              placeholder="e.g. June Trivia Night blast"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Segment */}
          <div>
            <label className="label">Audience segment</label>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
              {SEGMENTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSegmentId(s.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    segmentId === s.id
                      ? 'bg-primary text-white'
                      : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject (email only) */}
          {channel === 'email' && (
            <div>
              <label className="label">Subject *</label>
              <input
                className="input-field"
                placeholder="Subject line"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}

          {/* Body */}
          <div>
            <label className="label">Message *</label>
            <textarea
              className="input-field min-h-[120px] resize-y"
              placeholder={channel === 'sms' ? 'Keep it short — SMS is billed per segment.' : 'Write your email...'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {channel === 'sms' && (
              <p className="text-[11px] text-text-muted mt-1">{body.length} chars · ~{Math.max(1, Math.ceil(body.length / 160))} segment(s)</p>
            )}
          </div>

          {/* Consent gate summary — the load-bearing safety UI */}
          <div className={`rounded-lg border p-3 ${audience.length > 0 ? 'border-primary/30 bg-primary/[0.04]' : 'border-danger/30 bg-red-50 dark:bg-red-500/10'}`}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className={audience.length > 0 ? 'text-primary' : 'text-danger'} />
              <p className="text-sm font-semibold text-text-primary">
                Estimated audience: {audience.length.toLocaleString()}
              </p>
            </div>
            <p className="text-xs text-text-muted mt-1">
              {inSegment.length.toLocaleString()} in “{activeSegment.label}”, of which {audience.length.toLocaleString()} have a valid{' '}
              {channel === 'sms' ? 'SMS' : 'email'} opt-in.
            </p>
            {blocked > 0 && (
              <p className="flex items-center gap-1 text-xs text-danger mt-1.5">
                <ShieldAlert size={12} />
                {blocked.toLocaleString()} contact{blocked === 1 ? '' : 's'} blocked — no {channel === 'sms' ? 'SMS' : 'email'} consent. They will not be contacted.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border sticky bottom-0 bg-surface">
          <p className="text-xs text-text-muted">
            {channel === 'sms' ? 'SMS rail is gated until Twilio is configured.' : 'Only opted-in contacts are reached.'}
          </p>
          <button onClick={handleSend} disabled={!canSend} className="btn-primary text-sm">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send to {audience.length.toLocaleString()}
          </button>
        </div>
      </div>
    </div>
  );
}
