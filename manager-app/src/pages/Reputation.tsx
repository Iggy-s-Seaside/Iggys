import { useMemo, useState } from 'react';
import {
  Star, MessageSquareReply, Check, CheckCheck, AlertTriangle, ExternalLink,
  Loader2, Sparkles, Send, Filter, Inbox, ThumbsUp, MessageCircle,
} from 'lucide-react';
import { useReviews } from '../hooks/useReviews';
import { ErrorState } from '../components/ui/ErrorState';
import { StatTrend } from '../components/charts/StatTrend';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import type { Review } from '../types';

// ── Local reply drafter — three tones, no external AI call ──
// Templates are seeded from the review text + rating. They give the owner a
// fast, on-brand starting point they can edit before saving. Pure string
// templating; nothing leaves the browser.

type Tone = 'warm' | 'crisp' | 'apologetic';

const TONES: { key: Tone; label: string }[] = [
  { key: 'warm', label: 'Warm' },
  { key: 'crisp', label: 'Crisp' },
  { key: 'apologetic', label: 'Apologetic' },
];

function firstName(author: string | null): string {
  const n = (author || '').trim().split(/\s+/)[0];
  return n && /^[A-Za-z]/.test(n) ? n : 'there';
}

/** A short quotable snippet from the review, for the reply to reference. */
function snippet(body: string | null): string {
  const t = (body || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const cut = t.length > 80 ? `${t.slice(0, 80).trim()}…` : t;
  return cut;
}

function draftReply(review: Review, tone: Tone): string {
  const name = firstName(review.author);
  const positive = review.rating >= 4;
  const snip = snippet(review.body);
  const venue = "Iggy's";

  if (tone === 'warm') {
    if (positive) {
      return [
        `Hi ${name}, thank you so much for the kind words — this absolutely made our day!`,
        snip ? `We loved hearing that "${snip}" stood out to you.` : '',
        `The whole team at ${venue} can't wait to welcome you back. Cheers! 🍻`,
      ].filter(Boolean).join(' ');
    }
    return [
      `Hi ${name}, thank you for taking the time to share this with us — it genuinely helps.`,
      `We're sorry your visit to ${venue} wasn't all it should have been.`,
      `We'd love the chance to make it right — please reach out and we'll take good care of you.`,
    ].join(' ');
  }

  if (tone === 'crisp') {
    if (positive) {
      return `Thanks for the great review, ${name}! We're glad you enjoyed ${venue} and look forward to seeing you again.`;
    }
    return `Thanks for the feedback, ${name}. We're sorry this fell short and we're on it. Please reach out so we can make it right.`;
  }

  // apologetic
  if (positive) {
    return [
      `Thank you, ${name} — we really appreciate you taking the time to leave this.`,
      `We're always working to do better, and reviews like yours keep us honest. See you again soon at ${venue}.`,
    ].join(' ');
  }
  return [
    `${name}, we're truly sorry — this isn't the experience we want anyone to have at ${venue}.`,
    snip ? `Hearing that "${snip}" let you down is exactly the kind of thing we want to fix.` : '',
    `Please give us another chance to make it right; reach out anytime and we'll personally see to it.`,
  ].filter(Boolean).join(' ');
}

// ── Stars ──

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? 'text-accent fill-accent' : 'text-text-muted'}
        />
      ))}
    </span>
  );
}

function sourceBadge(source: string) {
  const map: Record<string, string> = {
    google: 'badge-primary',
    yelp: 'badge-danger',
    facebook: 'badge-accent',
    manual: 'badge',
  };
  const cls = map[source] ?? 'badge';
  const label = source.charAt(0).toUpperCase() + source.slice(1);
  return <span className={cls}>{label}</span>;
}

// ── Review card ──

interface ReviewCardProps {
  review: Review;
  onReply: (id: number, text: string) => Promise<boolean>;
  onMarkReplied: (id: number, replied: boolean) => Promise<boolean>;
}

function ReviewCard({ review, onReply, onMarkReplied }: ReviewCardProps) {
  const lowScore = review.rating <= 3;
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<Tone>('warm');
  const [draft, setDraft] = useState(review.reply_text || '');
  const [saving, setSaving] = useState(false);

  const applyTone = (t: Tone) => {
    setTone(t);
    setDraft(draftReply(review, t));
  };

  const openDrafter = () => {
    if (!open && !draft) setDraft(draftReply(review, tone));
    setOpen((v) => !v);
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await onReply(review.id, draft);
    setSaving(false);
    if (ok) setOpen(false);
  };

  return (
    <div className={`card p-4 sm:p-5 ${lowScore && !review.replied ? 'border-danger/40 bg-danger/[0.03]' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary truncate">
              {review.author || 'Anonymous'}
            </span>
            {sourceBadge(review.source)}
            {lowScore && !review.replied && (
              <span className="badge-danger flex items-center gap-1">
                <AlertTriangle size={11} /> Needs reply
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Stars rating={review.rating} />
            <span className="text-xs text-text-muted">
              {formatDistanceToNow(parseISO(review.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {review.url && (
            <a
              href={review.url}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
              title="View on platform"
            >
              <ExternalLink size={15} />
            </a>
          )}
          {review.replied ? (
            <span className="badge-success flex items-center gap-1">
              <CheckCheck size={12} /> Replied
            </span>
          ) : (
            <button
              onClick={() => onMarkReplied(review.id, true)}
              className="btn-ghost text-xs py-1 px-2"
              title="Mark as replied without drafting"
            >
              <Check size={14} /> Mark replied
            </button>
          )}
        </div>
      </div>

      {review.body && (
        <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed mt-3">
          {review.body}
        </p>
      )}

      {/* Existing saved reply */}
      {review.reply_text && (
        <div className="mt-3 rounded-lg bg-surface-hover border border-border p-3">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1">
            <MessageSquareReply size={12} /> Your reply
          </p>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{review.reply_text}</p>
        </div>
      )}

      {/* Drafter toggle */}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={openDrafter} className="btn-secondary text-xs">
          <Sparkles size={14} />
          {review.reply_text ? 'Edit reply' : 'Draft reply'}
        </button>
        {review.replied && (
          <button
            onClick={() => onMarkReplied(review.id, false)}
            className="btn-ghost text-xs py-1 px-2"
            title="Reopen — mark as not yet replied"
          >
            Reopen
          </button>
        )}
      </div>

      {/* Drafter */}
      {open && (
        <div className="mt-3 rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-text-muted mr-1">Tone:</span>
            {TONES.map((t) => (
              <button
                key={t.key}
                onClick={() => applyTone(t.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  tone === t.key
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            className="input-field min-h-[96px] resize-y text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Draft a reply, or pick a tone above to start…"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-text-muted">
              Drafted locally — edit before saving. Post it on the review platform, then save here.
            </p>
            <button
              onClick={handleSave}
              disabled={saving || !draft.trim()}
              className="btn-primary text-xs shrink-0"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Save reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──

type RatingFilter = 'all' | '5' | '4' | '3' | '2' | '1' | 'low' | 'unreplied';

export function Reputation() {
  const { reviews, feedback, loading, error, refresh, replyToReview, markReplied } = useReviews();
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');

  const stats = useMemo(() => {
    const count = reviews.length;
    const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
    const unreplied = reviews.filter((r) => !r.replied).length;
    const low = reviews.filter((r) => r.rating <= 3).length;
    return { count, avg, unreplied, low };
  }, [reviews]);

  const filtered = useMemo(() => {
    switch (ratingFilter) {
      case 'all':
        return reviews;
      case 'low':
        return reviews.filter((r) => r.rating <= 3);
      case 'unreplied':
        return reviews.filter((r) => !r.replied);
      default:
        return reviews.filter((r) => r.rating === Number(ratingFilter));
    }
  }, [reviews, ratingFilter]);

  const FILTERS: { key: RatingFilter; label: string }[] = [
    { key: 'all', label: `All (${reviews.length})` },
    { key: 'unreplied', label: `Needs reply (${stats.unreplied})` },
    { key: 'low', label: `Low (≤3★) (${stats.low})` },
    { key: '5', label: '5★' },
    { key: '4', label: '4★' },
    { key: '3', label: '3★' },
    { key: '2', label: '2★' },
    { key: '1', label: '1★' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Reputation</h1>
        {stats.unreplied > 0 && (
          <span className="badge-danger flex items-center gap-1">
            <AlertTriangle size={12} />
            {stats.unreplied} to reply
          </span>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatTrend
          label="Average rating"
          value={stats.count ? `${stats.avg.toFixed(1)}★` : '—'}
          caption={`${stats.count} review${stats.count === 1 ? '' : 's'}`}
          icon={<Star size={16} />}
        />
        <StatTrend
          label="Needs reply"
          value={stats.unreplied}
          caption="awaiting a response"
          icon={<MessageSquareReply size={16} />}
        />
        <StatTrend
          label="Low scores"
          value={stats.low}
          caption="3 stars or fewer"
          icon={<AlertTriangle size={16} />}
        />
        <StatTrend
          label="Guest feedback"
          value={feedback.length}
          caption="private table-side notes"
          icon={<MessageCircle size={16} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reviews stream */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-text-muted" />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setRatingFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  ratingFilter === f.key
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="card p-16 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-text-muted" />
            </div>
          ) : error && reviews.length === 0 ? (
            <ErrorState onRetry={refresh} description="We couldn't load your reviews. Nothing was lost." />
          ) : filtered.length === 0 ? (
            <div className="card p-16 text-center">
              <Inbox size={48} className="mx-auto text-text-muted mb-3" />
              <p className="text-text-muted">
                {reviews.length === 0
                  ? 'No reviews yet. They appear here once review sync is connected.'
                  : 'No reviews match this filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onReply={replyToReview}
                  onMarkReplied={markReplied}
                />
              ))}
            </div>
          )}
        </div>

        {/* Private feedback list */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-text-primary">Table-side feedback</h2>
            <span className="badge text-text-muted">{feedback.length}</span>
          </div>

          {loading ? (
            <div className="card p-10 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : feedback.length === 0 ? (
            <div className="card p-8 text-center">
              <ThumbsUp size={32} className="mx-auto text-text-muted mb-2" />
              <p className="text-sm text-text-muted">
                No feedback yet. Guests submit it from the table QR (/feedback).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedback.map((f) => {
                const lowScore = f.rating != null && f.rating <= 3;
                return (
                  <div
                    key={f.id}
                    className={`card p-4 ${lowScore ? 'border-danger/40 bg-danger/[0.03]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {f.rating != null ? <Stars rating={f.rating} size={13} /> : (
                          <span className="text-xs text-text-muted">No rating</span>
                        )}
                        {f.area && <span className="badge text-text-muted capitalize">{f.area}</span>}
                      </div>
                      <span className="text-[11px] text-text-muted shrink-0">
                        {format(parseISO(f.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    {f.comment && (
                      <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                        {f.comment}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      {f.contact_email ? (
                        <a
                          href={`mailto:${f.contact_email}`}
                          className="text-xs text-primary hover:underline truncate"
                        >
                          {f.contact_email}
                        </a>
                      ) : (
                        <span className="text-[11px] text-text-muted">No contact left</span>
                      )}
                      {f.public_review_clicked && (
                        <span className="badge-success flex items-center gap-1 shrink-0">
                          <ExternalLink size={11} /> Left a public review
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
