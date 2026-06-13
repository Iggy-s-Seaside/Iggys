import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Moon, Send, RefreshCw, Eye, X, Loader2, MessageCircle, Lightbulb, WifiOff,
  ArrowRight, Copy, FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLunaMessages, useLunaInsights } from '../hooks/useLuna';
import { useCoarsePointer } from '../hooks/useCoarsePointer';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { LunaInsight, LunaInsightKind, LunaMessage, LunaActionState } from '../types';
import { LUNA_INSIGHT_KIND_LABELS, INSIGHT_ACTION_DEFAULT_LABELS, parseInsightData } from '../types';

type LunaTab = 'chat' | 'insights';

const KIND_CHIP_CLASSES: Record<LunaInsightKind, string> = {
  briefing: 'badge-primary',
  alert: 'badge-danger',
  suggestion: 'badge-accent',
  note: 'badge bg-surface-hover text-text-muted',
};

const EXAMPLE_PROMPTS = [
  'How did this weekend look compared to last?',
  'What should we 86 or push tonight?',
  'Draft a special for Thursday',
];

function relativeTime(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

function LunaAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center shrink-0">
      <Moon size={15} className="text-purple-600 dark:text-purple-400" />
    </div>
  );
}

function MessageBubble({ msg, onRetry }: { msg: LunaMessage; onRetry: (msg: LunaMessage) => void }) {
  if (msg.role === 'luna') {
    return (
      <div className="flex items-end gap-2.5 mr-auto max-w-[88%] sm:max-w-[75%]">
        <LunaAvatar />
        <div className="min-w-0">
          <div className="bg-surface border border-purple-200/60 dark:border-purple-500/20 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-card">
            <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          </div>
          <p className="text-[11px] text-text-muted mt-1 ml-1">Luna · {relativeTime(msg.created_at)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-auto max-w-[88%] sm:max-w-[75%] flex flex-col items-end">
      <div className="bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
      </div>
      <p className="text-[11px] text-text-muted mt-1 mr-1">{relativeTime(msg.created_at)}</p>
      {msg.status === 'error' && (
        <div className="mt-1.5 flex items-start gap-2 bg-danger-light border border-danger/20 rounded-lg px-3 py-2 max-w-full">
          <p className="text-xs text-danger min-w-0">
            {msg.error || 'Luna couldn’t answer this one.'}
          </p>
          <button
            onClick={() => onRetry(msg)}
            className="flex items-center gap-1 text-xs font-medium text-danger hover:underline shrink-0"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-end gap-2.5 mr-auto">
      <LunaAvatar />
      <div>
        <div className="bg-surface border border-purple-200/60 dark:border-purple-500/20 rounded-2xl rounded-bl-md px-4 py-3 shadow-card flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-purple-500/70 animate-pulse"
              style={{ animationDelay: `${i * 250}ms` }}
            />
          ))}
        </div>
        <p className="text-[11px] text-text-muted mt-1 ml-1 animate-pulse">
          Luna is thinking&hellip; replies can take up to a minute
        </p>
      </div>
    </div>
  );
}

/** Shown when a question has been pending well past Luna's normal reply
 * window — the bridge/PC1 is most likely offline. */
function OfflineNotice() {
  return (
    <div className="flex items-end gap-2.5 mr-auto max-w-[88%] sm:max-w-[75%]">
      <LunaAvatar />
      <div className="bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-2.5">
        <p className="text-sm text-text-secondary flex items-center gap-2">
          <WifiOff size={14} className="text-text-muted shrink-0" />
          Luna seems to be offline right now — she'll answer this as soon as
          she's back.
        </p>
      </div>
    </div>
  );
}

/** Question is considered stuck after this long in pending/processing. */
const STUCK_AFTER_MS = 3 * 60 * 1000;

function InsightCard({
  insight, onSeen, onDismiss,
}: {
  insight: LunaInsight;
  onSeen: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const isLong = insight.body.length > 160 || insight.body.split('\n').length > 3;

  // Luna writes an optional one-tap action + drafted text + sources into `data`.
  const d = parseInsightData(insight.data);
  const action = d.action;
  const deepLink = action?.deep_link ?? d.deep_link;
  const draft = action?.draft;
  const sources = Array.isArray(d.sources)
    ? d.sources.filter((s): s is string => typeof s === 'string')
    : [];
  const actionLabel = action ? action.label || INSIGHT_ACTION_DEFAULT_LABELS[action.type] : null;

  // The human always triggers. Tapping marks the insight seen and routes to the
  // relevant record, carrying Luna's draft so the target page can pre-fill it.
  const runAction = () => {
    onSeen(insight.id);
    if (deepLink) {
      const state: LunaActionState = {
        lunaDraft: draft,
        lunaPayload: action?.payload,
        fromInsight: insight.id,
      };
      navigate(deepLink, { state });
    }
  };

  const copyDraft = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      toast.success('Draft copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className={`card p-4 ${insight.status === 'new' ? 'border-primary/40' : ''}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={KIND_CHIP_CLASSES[insight.kind]}>
            {LUNA_INSIGHT_KIND_LABELS[insight.kind]}
          </span>
          {insight.status === 'new' && (
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="New insight" />
          )}
          <span className="text-xs text-text-muted truncate">{relativeTime(insight.created_at)}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {insight.status === 'new' && (
            <button
              onClick={() => onSeen(insight.id)}
              aria-label="Mark insight as seen"
              title="Mark as seen"
              className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              <Eye size={15} />
            </button>
          )}
          {insight.status !== 'dismissed' && (
            <button
              onClick={() => onDismiss(insight.id)}
              aria-label="Dismiss insight"
              title="Dismiss"
              className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-danger transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      <h3 className="text-sm font-semibold text-text-primary">{insight.title}</h3>
      <p className={`text-sm text-text-secondary whitespace-pre-wrap leading-relaxed mt-1 ${expanded ? '' : 'line-clamp-3'}`}>
        {insight.body}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-xs font-medium text-primary hover:text-primary-hover mt-1.5"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Luna's drafted text — ready to use, never auto-sent */}
      {draft && (
        <div className="mt-3">
          <button
            onClick={() => setShowDraft((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <FileText size={13} /> {showDraft ? "Hide Luna's draft" : "View Luna's draft"}
          </button>
          {showDraft && (
            <div className="mt-2 rounded-lg border border-border bg-surface-hover/60 p-3">
              <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">{draft}</p>
              <button
                onClick={copyDraft}
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sources — Luna grounds every data answer in real rows */}
      {sources.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-text-muted">Sources:</span>
          {sources.map((s, i) => (
            <span key={i} className="text-[11px] text-text-muted bg-surface-hover rounded px-1.5 py-0.5">{s}</span>
          ))}
        </div>
      )}

      {/* One-tap action — the human always triggers; Luna only drafts */}
      {(action || deepLink) && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
          <button
            onClick={runAction}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            {actionLabel || 'Open'} <ArrowRight size={13} />
          </button>
          {action && action.type !== 'navigate' && (
            <span className="text-[11px] text-text-muted">You review before it sends</span>
          )}
        </div>
      )}
    </div>
  );
}

export function Luna() {
  const { user } = useAuth();
  const { messages, loading, sendMessage, retryMessage } = useLunaMessages();
  const { insights, loading: insightsLoading, markSeen, dismiss } = useLunaInsights();
  const coarsePointer = useCoarsePointer();

  const [tab, setTab] = useState<LunaTab>('chat');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const forceScrollRef = useRef(false);

  const lastMessage = messages[messages.length - 1];
  const waiting =
    lastMessage?.role === 'user' &&
    (lastMessage.status === 'pending' || lastMessage.status === 'processing');
  // Re-evaluate "stuck" while waiting so the offline notice can appear
  // without any new realtime event arriving.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [waiting]);
  const waitedMs = waiting
    ? now - new Date(lastMessage.created_at).getTime()
    : 0;
  const thinking = waiting && waitedMs < STUCK_AFTER_MS;
  const stuck = waiting && waitedMs >= STUCK_AFTER_MS;

  const newInsightCount = useMemo(
    () => insights.filter((i) => i.status === 'new').length,
    [insights]
  );
  const visibleInsights = useMemo(
    () => (showDismissed ? insights : insights.filter((i) => i.status !== 'dismissed')),
    [insights, showDismissed]
  );

  // Keep the thread pinned to the newest message — but never yank the user
  // down while they're scrolled up reading history (shared thread: status
  // flips and other managers' messages arrive over realtime). Own sends
  // always scroll (forceScrollRef).
  useEffect(() => {
    if (tab !== 'chat' || loading) return;
    const nearBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 200;
    if (didInitialScroll.current && !nearBottom && !forceScrollRef.current) return;
    endRef.current?.scrollIntoView({
      behavior: didInitialScroll.current ? 'smooth' : 'auto',
      block: 'end',
    });
    didInitialScroll.current = true;
    forceScrollRef.current = false;
  }, [messages, thinking, tab, loading]);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    forceScrollRef.current = true;
    const ok = await sendMessage(content, user?.email ?? null);
    // Restore the failed draft only if they haven't typed something new.
    if (!ok) setDraft((d) => (d ? d : content));
    setSending(false);
  };

  const handleRetry = (msg: LunaMessage) => {
    if (sending || msg.id < 0) return;
    retryMessage(msg.id); // re-queue the same row; no duplicate insert
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-full bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center shrink-0">
          <Moon size={20} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Luna</h1>
          <p className="text-sm text-text-muted">Your AI assistant for the bar</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5" role="tablist" aria-label="Luna sections">
        <button
          onClick={() => setTab('chat')}
          role="tab"
          aria-selected={tab === 'chat'}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
            tab === 'chat'
              ? 'bg-primary text-white'
              : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
          }`}
        >
          <MessageCircle size={14} /> Chat
        </button>
        <button
          onClick={() => setTab('insights')}
          role="tab"
          aria-selected={tab === 'insights'}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
            tab === 'insights'
              ? 'bg-primary text-white'
              : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
          }`}
        >
          <Lightbulb size={14} /> Insights
          {newInsightCount > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
              tab === 'insights' ? 'bg-white/25 text-white' : 'bg-primary text-white'
            }`}>
              {newInsightCount > 9 ? '9+' : newInsightCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'insights' ? (
        <div className="pb-8">
          <div className="flex items-center justify-end mb-3">
            <button
              onClick={() => setShowDismissed((s) => !s)}
              className="text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              {showDismissed ? 'Hide dismissed' : 'Show dismissed'}
            </button>
          </div>
          {insightsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-4 bg-surface-hover rounded w-24 mb-3" />
                  <div className="h-4 bg-surface-hover rounded w-2/3 mb-2" />
                  <div className="h-3 bg-surface-hover rounded w-full" />
                </div>
              ))}
            </div>
          ) : visibleInsights.length === 0 ? (
            <div className="card p-10 text-center">
              <Lightbulb size={32} className="mx-auto text-text-muted mb-3" />
              <p className="text-sm font-medium text-text-primary">No insights yet</p>
              <p className="text-xs text-text-muted mt-1">
                Luna will drop briefings, alerts, and suggestions here as she spots them.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleInsights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onSeen={markSeen}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Thread */}
          <div className="space-y-4 pb-28 lg:pb-32">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-14 rounded-2xl bg-surface-hover animate-pulse ${
                      i % 2 === 0 ? 'ml-auto w-3/5' : 'mr-auto w-2/3'
                    }`}
                  />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center mb-3">
                  <Moon size={22} className="text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-medium text-text-primary">Ask Luna anything about the bar</p>
                <p className="text-xs text-text-muted mt-1 mb-4">
                  Sales, inventory, parties, specials — she's watching the whole operation.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setDraft(prompt);
                        textareaRef.current?.focus();
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-hover text-text-secondary hover:bg-surface-active transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} onRetry={handleRetry} />
              ))
            )}
            {thinking && <ThinkingIndicator />}
            {stuck && <OfflineNotice />}
            <div ref={endRef} />
          </div>

          {/* Composer — pinned above the mobile bottom nav, bottom of viewport on desktop */}
          <div className="fixed left-0 right-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] lg:bottom-0 lg:left-64 z-30 bg-surface border-t border-border px-3 py-2.5 lg:px-6 lg:py-3">
            <form
              className="flex items-end gap-2 max-w-3xl mx-auto"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  autoGrow();
                }}
                onKeyDown={(e) => {
                  // Touch keyboards have no Shift — Enter must insert a
                  // newline there; the send button submits.
                  if (e.key === 'Enter' && !e.shiftKey && !coarsePointer) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Luna anything…"
                aria-label="Ask Luna anything"
                className="input-field resize-none min-h-[44px] max-h-32 leading-snug"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Send message to Luna"
                className="btn-primary px-3.5 min-h-[44px] shrink-0"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
