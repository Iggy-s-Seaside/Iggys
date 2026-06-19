import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Share2, Instagram, Facebook, MapPin, Image as ImageIcon, Check, X, Clock,
  CalendarClock, ShieldCheck, Send, AlertTriangle, Plus,
} from 'lucide-react';
import {
  useSocialPosts, SOCIAL_PLATFORM_LABELS, SOCIAL_POST_STATUS_LABELS, SOCIAL_SOURCE_LABELS,
  type SocialPost, type SocialPlatform, type SocialPostStatus,
} from '../hooks/useSocialPosts';
import { useAuth } from '../context/AuthContext';
import { useLunaHandoff } from '../hooks/useLunaHandoff';
import { ConfirmDialog } from '../components/ui/Modal';
import { CreateSocialPostModal } from '../components/social/CreateSocialPostModal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { safeFmtDate } from '../utils/format';

const PLATFORM_ICONS: Record<SocialPlatform, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  google: MapPin,
};

const STATUS_BADGE: Record<SocialPostStatus, string> = {
  draft: 'badge bg-surface-hover text-text-muted',
  scheduled: 'badge-accent',
  approved: 'badge-primary',
  posted: 'badge-success',
  failed: 'badge-danger',
  cancelled: 'badge bg-surface-hover text-text-muted',
};

function PlatformChip({ platform }: { platform: SocialPlatform }) {
  const Icon = PLATFORM_ICONS[platform];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-surface-hover text-text-secondary border border-border">
      <Icon size={12} />
      {SOCIAL_PLATFORM_LABELS[platform]}
    </span>
  );
}

function PostCard({
  post,
  onApprove,
  onSchedule,
  onCancel,
}: {
  post: SocialPost;
  onApprove: (p: SocialPost) => void;
  onSchedule: (p: SocialPost) => void;
  onCancel: (p: SocialPost) => void;
}) {
  const isQueued = post.status === 'draft' || post.status === 'scheduled' || post.status === 'approved';
  return (
    <div className="card-hover overflow-hidden flex flex-col">
      {post.image_url ? (
        <img src={post.image_url} alt="" className="w-full h-44 object-cover" />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-surface-hover to-surface-active flex items-center justify-center">
          <ImageIcon size={32} className="text-text-muted" />
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {SOCIAL_SOURCE_LABELS[post.source] ?? post.source}
          </span>
          <span className={STATUS_BADGE[post.status]}>{SOCIAL_POST_STATUS_LABELS[post.status]}</span>
        </div>

        <p className="text-sm text-text-primary whitespace-pre-line line-clamp-4">{post.caption}</p>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {post.target_platforms.length === 0 ? (
            <span className="text-xs text-text-muted">No platforms selected</span>
          ) : (
            post.target_platforms.map((p) => <PlatformChip key={p} platform={p} />)
          )}
        </div>

        {post.scheduled_at && (
          <p className="flex items-center gap-1.5 text-xs text-text-muted mt-3">
            <CalendarClock size={13} />
            {safeFmtDate(post.scheduled_at, "EEE MMM d 'at' h:mm a")}
          </p>
        )}

        {post.status === 'failed' && post.error && (
          <p className="flex items-start gap-1.5 text-xs text-danger mt-3">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {post.error}
          </p>
        )}

        {post.approved_by && (
          <p className="flex items-center gap-1.5 text-xs text-text-muted mt-2">
            <ShieldCheck size={13} /> Approved by {post.approved_by}
          </p>
        )}

        {isQueued && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
            {post.status !== 'approved' && post.status !== 'scheduled' && (
              <button onClick={() => onApprove(post)} className="btn-primary flex-1 text-sm py-2">
                <Check size={15} /> Approve
              </button>
            )}
            <button
              onClick={() => onSchedule(post)}
              className="btn-secondary flex-1 text-sm py-2"
            >
              <Clock size={15} /> {post.scheduled_at ? 'Reschedule' : 'Schedule'}
            </button>
            <button
              onClick={() => onCancel(post)}
              aria-label="Cancel post"
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-surface-hover transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SocialQueue() {
  const { posts, loading, schedule, approve, cancel } = useSocialPosts();
  const { user } = useAuth();
  const handoff = useLunaHandoff();
  const [showCreate, setShowCreate] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<SocialPost | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<SocialPost | null>(null);
  const [scheduleValue, setScheduleValue] = useState('');

  // Luna handoff: arriving from an insight's caption draft opens the composer
  // with the drafted caption on the clipboard so it's one paste away. Nothing is
  // posted until the manager approves it in the queue.
  const handoffApplied = useRef(false);
  useEffect(() => {
    if (handoffApplied.current) return;
    if (!handoff.draft && !handoff.payload) return;
    handoffApplied.current = true;
    setShowCreate(true);
    if (handoff.draft) {
      navigator.clipboard?.writeText(handoff.draft)
        .then(() => toast.success("Luna's caption copied — paste it in"))
        .catch(() => { /* clipboard blocked — manager can still type the caption */ });
    }
  }, [handoff]);

  // The queue page shows what's pending a human decision; posted/cancelled drop off.
  const queued = useMemo(
    () => posts.filter((p) => ['draft', 'scheduled', 'approved', 'failed'].includes(p.status)),
    [posts],
  );
  const history = useMemo(
    () => posts.filter((p) => p.status === 'posted' || p.status === 'cancelled'),
    [posts],
  );

  const openSchedule = (p: SocialPost) => {
    setScheduleTarget(p);
    setScheduleValue(p.scheduled_at ? format(parseISO(p.scheduled_at), "yyyy-MM-dd'T'HH:mm") : '');
  };

  const confirmSchedule = async () => {
    if (!scheduleTarget || !scheduleValue) return;
    const ok = await schedule(scheduleTarget.id, new Date(scheduleValue).toISOString());
    if (ok) setScheduleTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="Social"
        subtitle={`${queued.length} ${queued.length === 1 ? 'post' : 'posts'} awaiting approval`}
      >
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={18} /> Queue post
        </button>
      </PageHeader>

      {/* Live-posting status banner */}
      <div className="card p-4 mb-6 border-amber-500/30 flex items-start gap-3">
        <Send size={18} className="text-amber-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-text-primary">Live auto-posting is off</p>
          <p className="text-text-muted mt-0.5">
            Posts you approve are held in this queue. Automatic publishing to Instagram, Facebook and
            Google Business turns on once Meta App Review is approved and access tokens are added — until
            then nothing leaves this app.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-40 bg-surface-hover rounded-lg mb-3" />
              <div className="h-4 bg-surface-hover rounded w-2/3 mb-2" />
              <div className="h-4 bg-surface-hover rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : queued.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="Your queue is empty"
          description="Draft a post from a special or event, then approve it here. Live posting to Instagram, Facebook and Google Business is pending Meta App Review — for now the queue is your safe staging area."
          action={
            <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex">
              <Plus size={18} /> Queue your first post
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {queued.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onApprove={(p) => approve(p, user?.email ?? null)}
              onSchedule={openSchedule}
              onCancel={setCancelTarget}
            />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-text-secondary mb-3">History</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((post) => (
              <div key={post.id} className="card p-4 opacity-70">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                    {SOCIAL_SOURCE_LABELS[post.source] ?? post.source}
                  </span>
                  <span className={STATUS_BADGE[post.status]}>{SOCIAL_POST_STATUS_LABELS[post.status]}</span>
                </div>
                <p className="text-sm text-text-secondary line-clamp-2">{post.caption}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {post.target_platforms.map((p) => <PlatformChip key={p} platform={p} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CreateSocialPostModal open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Schedule picker */}
      {scheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setScheduleTarget(null)} />
          <div className="relative max-w-sm w-full bg-surface rounded-t-xl sm:rounded-xl shadow-modal border border-border p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Schedule post</h2>
            <p className="text-sm text-text-muted mb-4">
              Pick when this post should go live once auto-posting is enabled.
            </p>
            <input
              type="datetime-local"
              value={scheduleValue}
              onChange={(e) => setScheduleValue(e.target.value)}
              className="input-field mb-5"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setScheduleTarget(null)} className="btn-secondary">Cancel</button>
              <button onClick={confirmSchedule} disabled={!scheduleValue} className="btn-primary disabled:opacity-50">
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => { if (cancelTarget) cancel(cancelTarget.id); }}
        title="Cancel post"
        message="Remove this post from the queue? It will be marked cancelled and won't be posted."
        confirmLabel="Cancel post"
      />
    </div>
  );
}
