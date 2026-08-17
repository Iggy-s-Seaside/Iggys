import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, MailOpen, Reply, Archive, Search, Filter, Check, CheckCheck,
  Clock, Phone, User, ArrowLeft, Send, Loader2, StickyNote, MailWarning, FileText, RefreshCw,
  PartyPopper, Zap, Moon, ChevronDown, MailCheck
} from 'lucide-react';
import { useMessages } from '../hooks/useMessages';
import { ErrorState } from '../components/ui/ErrorState';
import { useLunaHandoff } from '../hooks/useLunaHandoff';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { syncGmailInbox, fetchGmailThread, type ThreadMessage } from '../lib/partyActions';
import { createPartyFromLead, findOpenPartyForContact } from '../utils/partyUpsell';
import { Modal } from '../components/ui/Modal';
import { parseISO, formatDistanceToNow } from 'date-fns';
import { safeFmtDate } from '../utils/format';
import type { Message, Party } from '../types';
import { needsReplyNow, messageTriage, categoryLabel, isSolicitation } from '../utils/triage';
import { canAcknowledge, buildAcknowledgement } from '../utils/acknowledge';
import toast from 'react-hot-toast';
import { TemplatePicker } from '../components/messages/TemplatePicker';
import { TemplateManager } from '../components/messages/TemplateManager';

type StatusFilter = 'all' | 'needs' | 'unread' | 'read' | 'replied' | 'archived';

// Throttle Gmail auto-sync across page remounts (module-level, not per-mount).
let lastAutoSync = 0;
const AUTO_SYNC_MS = 5 * 60 * 1000;

/** Full Gmail conversation (inbound + the bar's sent replies). Falls back to the
 * single stored message if the thread can't be loaded. */
function GmailThreadView({ messages, loading, fallback }: { messages: ThreadMessage[]; loading: boolean; fallback: string }) {
  if (loading && messages.length === 0) {
    return (
      <div className="card p-5 animate-pulse space-y-2">
        <div className="h-3 bg-surface-hover rounded w-1/3" />
        <div className="h-3 bg-surface-hover rounded w-full" />
        <div className="h-3 bg-surface-hover rounded w-5/6" />
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div className="card p-5">
        <p className="text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed">{fallback}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {messages.length > 1 && (
        <p className="text-xs text-text-muted px-1">{messages.length} messages in this conversation</p>
      )}
      {messages.map((m) => (
        <div key={m.id} className={`card p-4 ${m.from_me ? 'border-primary/30 bg-primary/[0.03]' : ''}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-text-primary">
              {m.from_me ? "Iggy's Seaside" : (m.from_name || m.from_email)}
            </span>
            <span className="text-[11px] text-text-muted shrink-0">
              {safeFmtDate(m.date, 'MMM d, h:mm a')}
            </span>
          </div>
          <p className="text-sm text-text-secondary whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
        </div>
      ))}
    </div>
  );
}

export function Messages() {
  const {
    messages, loading, error, refresh, markAsRead, markAsReplied,
    archiveMessage, updateNotes, bulkMarkRead, bulkArchive
  } = useMessages();
  const handoff = useLunaHandoff();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [convertingParty, setConvertingParty] = useState(false);
  // A same-contact open party found at Make-a-party time — drives the
  // duplicate-warning dialog. Dismissing it (X/Escape/backdrop) is a no-op.
  const [dupParty, setDupParty] = useState<Party | null>(null);
  const [drafting, setDrafting] = useState(false);

  const handleSyncGmail = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await syncGmailInbox();
      lastAutoSync = Date.now();
      toast.success(
        r.synced > 0
          ? `${r.synced} new email${r.synced === 1 ? '' : 's'} pulled from Gmail`
          : 'Inbox is up to date'
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gmail sync failed');
    }
    setSyncing(false);
  };

  // Silent background sync while the inbox is open (throttled, no toast).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await syncGmailInbox();
        if (!cancelled) await refresh();
      } catch { /* silent — manual button surfaces errors */ }
    };
    if (Date.now() - lastAutoSync > AUTO_SYNC_MS) {
      lastAutoSync = Date.now();
      run();
    }
    const iv = setInterval(() => {
      lastAutoSync = Date.now();
      run();
    }, AUTO_SYNC_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [refresh]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Tracks the live selection so an async Luna draft only lands if the user is
  // still on the message it was requested for (no dropping A's draft into B).
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Cleanup: if the component unmounts while a Luna draft is in-flight, clear the
  // timeout and remove the Supabase channel so we don't leak or setState on an
  // unmounted tree.
  useEffect(() => {
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, []);

  const filtered = useMemo(() => {
    let result = messages;
    if (statusFilter === 'needs') {
      result = result.filter(needsReplyNow);
    } else if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.message.toLowerCase().includes(q)
      );
    }
    return result;
  }, [messages, statusFilter, search]);

  // How many reservations/requests are still waiting on a reply (drives the
  // filter-chip count + the pinned "Needs a reply" section).
  const needsReplyCount = useMemo(() => messages.filter(needsReplyNow).length, [messages]);

  // Split the current view into the pinned high-priority board + the rest.
  // Oldest-waiting first so the most overdue reply is on top. Solicitations
  // (cold pitches) are pulled OUT of the regular list entirely — they render
  // in their own collapsed section below, never on the "Needs a reply" board.
  const { needsReplyList, regularList } = useMemo(() => {
    const byOldest = (a: Message, b: Message) => a.created_at.localeCompare(b.created_at);
    if (statusFilter === 'needs') {
      return { needsReplyList: [...filtered].sort(byOldest), regularList: [] as Message[] };
    }
    const showSection = statusFilter === 'all' || statusFilter === 'unread' || statusFilter === 'read';
    if (!showSection) return { needsReplyList: [] as Message[], regularList: filtered };
    const nr: Message[] = [];
    const rest: Message[] = [];
    for (const m of filtered) {
      if (needsReplyNow(m)) nr.push(m);
      else if (!isSolicitation(m)) rest.push(m);
    }
    nr.sort(byOldest);
    return { needsReplyList: nr, regularList: rest };
  }, [filtered, statusFilter]);

  // Cold pitches collected below the inbox. Collapsed by default; the manager
  // reviews or bulk-archives them — nothing is ever auto-archived.
  const solicitationList = useMemo(() => {
    const showSection = statusFilter === 'all' || statusFilter === 'unread' || statusFilter === 'read';
    if (!showSection) return [] as Message[];
    return filtered.filter(isSolicitation);
  }, [filtered, statusFilter]);
  const [solicitationsOpen, setSolicitationsOpen] = useState(false);

  const handleArchiveSolicitations = async () => {
    const ids = solicitationList.map((m) => m.id);
    if (ids.length === 0) return;
    await bulkArchive(ids); // reversible status flip — they stay in the Archived filter
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    toast.success(`Archived ${ids.length} solicitation${ids.length === 1 ? '' : 's'}`);
  };

  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  );

  // Auto-mark as read when selected
  useEffect(() => {
    if (selected && selected.status === 'unread') {
      markAsRead(selected.id);
    }
  }, [selected, markAsRead]);

  // Sync notes when selection changes
  useEffect(() => {
    setNotes(selected?.notes || '');
    setReplyText('');
  }, [selected]);

  // Luna handoff: a draft_reply insight deep-links here with the target message
  // id in the payload and Luna's drafted reply. Select that message and pre-fill
  // the reply box — the manager always reviews and taps Send themselves.
  const handoffMsgId = useMemo(() => {
    const raw = handoff.payload?.messageId ?? handoff.payload?.message_id;
    return typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : null;
  }, [handoff.payload]);
  const replySeeded = useRef(false);

  // Step 1: once messages load, open the target conversation from the handoff.
  useEffect(() => {
    if (replySeeded.current) return;
    if (handoffMsgId == null) return;
    if (!messages.some((m) => m.id === handoffMsgId)) return;
    setSelectedId(handoffMsgId);
    setShowMobileDetail(true);
  }, [handoffMsgId, messages]);

  // Step 2: when the target conversation is the active one, seed the drafted
  // reply. Runs after the selection-reset effect above, so the draft survives.
  useEffect(() => {
    if (replySeeded.current) return;
    if (!handoff.draft || handoffMsgId == null) return;
    if (selected?.id !== handoffMsgId) return;
    replySeeded.current = true;
    setReplyText(handoff.draft);
  }, [handoff.draft, handoffMsgId, selected]);

  // Load the Gmail conversation for the selected message (when it's from Gmail).
  const refetchThread = async () => {
    const msg = messages.find((m) => m.id === selectedId);
    if (!msg || msg.source !== 'gmail') {
      setThread([]);
      return;
    }
    setThreadLoading(true);
    try {
      setThread(await fetchGmailThread({ threadId: msg.gmail_thread_id, messageId: msg.gmail_id }));
    } catch {
      setThread([]); // fall back to the single stored message
    }
    setThreadLoading(false);
  };

  // Only refetch when the selection changes (not on every realtime message update).
  useEffect(() => {
    let cancelled = false;
    const msg = messages.find((m) => m.id === selectedId);
    setThread([]);
    if (!msg || msg.source !== 'gmail') return;
    setThreadLoading(true);
    fetchGmailThread({ threadId: msg.gmail_thread_id, messageId: msg.gmail_id })
      .then((t) => { if (!cancelled) setThread(t); })
      .catch(() => { if (!cancelled) setThread([]); })
      .finally(() => { if (!cancelled) setThreadLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleSelect = (msg: Message) => {
    setSelectedId(msg.id);
    setShowMobileDetail(true);
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setReplying(true);

    try {
      // Get the current session token for auth
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Not authenticated. Please log in again.');
        setReplying(false);
        return;
      }

      // Call the send-reply Edge Function. gmailId threads the reply into the
      // original Gmail conversation (In-Reply-To/References + threadId).
      const { data, error } = await supabase.functions.invoke('send-reply', {
        body: {
          to: selected.email,
          subject: selected.subject,
          body: replyText,
          messageId: selected.id,
          gmailId: selected.gmail_id ?? undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Reply sent to ${selected.email}`);
      setReplyText('');
      if (selected.source === 'gmail') refetchThread(); // show the sent reply in the thread
    } catch (err) {
      console.error('Reply failed:', err);
      // Fallback: save reply to DB even if Gmail send fails
      const ok = await markAsReplied(selected.id, replyText);
      if (ok) {
        toast.error('Gmail send failed — reply saved to database. Check Edge Function logs.');
        setReplyText('');
      } else {
        toast.error('Failed to send reply. Please try again.');
      }
    }

    setReplying(false);
  };

  // On-demand: ask the home-lab Luna to draft a reply via her existing bridge —
  // insert a pending luna_messages row; when she answers (role='luna',
  // reply_to=this id), drop her draft into the reply box. Reuses the same Q&A
  // pipeline as the Luna chat (no bridge changes). The manager always reviews +
  // taps Send themselves — nothing is auto-sent.
  const askLunaToDraft = async () => {
    if (!selected || drafting) return;
    const targetId = selected.id;
    setDrafting(true);
    const prompt =
      `Draft a short, warm reply in Bradley's voice to this customer email for Iggy's Seaside. ` +
      `Return ONLY the ready-to-send reply body (a couple of sentences), no subject line and no preamble. ` +
      `Answer their question if you can from what you know; otherwise be friendly and ask for the detail you need.\n\n` +
      `From: ${selected.name} <${selected.email}>\n` +
      `Subject: ${selected.subject}\n\n` +
      `${selected.message}`;
    const { data, error } = await supabase
      .from('luna_messages')
      .insert({ role: 'user', content: prompt, status: 'pending', author_email: user?.email ?? null })
      .select('id')
      .single();
    if (error || !data) {
      setDrafting(false);
      toast.error('Could not reach Luna. Try again.');
      return;
    }
    const reqId = (data as { id: number }).id;
    toast('Luna is drafting a reply…', { icon: '🌙' });
    let settled = false;
    const finish = (text?: string) => {
      if (settled) return;
      settled = true;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      setDrafting(false);
      if (text) {
        if (selectedIdRef.current === targetId) {
          setReplyText(text.trim());
          toast.success('Luna drafted a reply — review & send');
        } else {
          toast('Luna finished a draft for the other message.');
        }
      }
    };
    channelRef.current = supabase
      .channel(`luna-draft-${reqId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'luna_messages', filter: `reply_to=eq.${reqId}` },
        (payload) => {
          const row = payload.new as { role?: string; content?: string };
          if (row.role === 'luna' && row.content) finish(row.content);
        }
      )
      .subscribe();
    // Luna reasons before answering (30-90s typical). Give her up to 2.5 min.
    timerRef.current = setTimeout(() => {
      if (!settled) {
        finish();
        toast('Luna is taking a while — her draft will land in the Luna tab.');
      }
    }, 150000);
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    await updateNotes(selected.id, notes);
    toast.success('Notes saved');
  };

  // Reviewer stage (replaces the retired auto-reply trigger): pre-fill the
  // reply composer with the standard warm acknowledgement, personalised to the
  // sender. This NEVER sends — the manager reads, edits if they want, and
  // presses the existing Send Reply themselves. That human review is the point.
  const replyBoxRef = useRef<HTMLTextAreaElement>(null);
  const handleAcknowledge = () => {
    if (!selected || !canAcknowledge(selected)) return;
    setReplyText(buildAcknowledgement(selected.name, selected.subject));
    replyBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    replyBoxRef.current?.focus();
    toast('Acknowledgement drafted — review it, then press Send Reply', { icon: '✉️' });
  };

  // Convert an inbox lead into a private-party inquiry, pre-filled from the
  // sender and subject. Reuses the app's standard party-create path and sends no
  // email — the message stays in the inbox; this is purely additive.
  const handleMakeParty = async () => {
    if (!selected || convertingParty) return;
    setConvertingParty(true);
    // Same-contact guard: converting two messages from one thread once minted
    // two pipeline cards for a single booking. Surface the existing open party
    // in a dialog with explicit choices — plain dismissal does nothing.
    const existing = await findOpenPartyForContact(selected.email, selected.name);
    setConvertingParty(false);
    if (existing) {
      setDupParty(existing);
      return;
    }
    await convertLeadToParty();
  };

  const convertLeadToParty = async () => {
    if (!selected || convertingParty) return;
    setConvertingParty(true);
    // Luna's extracted event details (date/time/guests/space/price) pre-fill the
    // party form so the manager doesn't re-type what's already in the thread.
    const ed = (selected.luna_classification?.event_details ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const num = (v: unknown) => (typeof v === 'number' ? v : null);
    const party = await createPartyFromLead({
      contactName: selected.name,
      contactEmail: selected.email,
      contactPhone: selected.phone || str(ed.contact_phone),
      title: selected.subject?.trim() || `Party — ${selected.name}`,
      eventDate: str(ed.event_date),
      startTime: str(ed.start_time),
      endTime: str(ed.end_time),
      guestCount: num(ed.guest_count),
      space: str(ed.space),
      depositAmount: num(ed.deposit),
      estTotal: num(ed.est_total),
      extractedNotes: str(ed.notes),
      internalNotes: `Started from an inbox message${
        selected.subject?.trim() ? ` (“${selected.subject.trim()}”)` : ''
      }.${selected.message?.trim() ? `\n\n${selected.message.trim()}` : ''}`,
      source: selected.source === 'gmail' ? 'email' : 'website',
    });
    setConvertingParty(false);
    if (party) navigate(`/parties/${party.id}`);
  };

  const handleBulkAction = async (action: 'read' | 'archive') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (action === 'read') await bulkMarkRead(ids);
    else await bulkArchive(ids);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statusIcon = (status: Message['status']) => {
    switch (status) {
      case 'unread': return <Mail size={14} className="text-primary" />;
      case 'read': return <MailOpen size={14} className="text-text-muted" />;
      case 'replied': return <Reply size={14} className="text-green-500" />;
      case 'archived': return <Archive size={14} className="text-text-muted" />;
    }
  };

  const statusBadge = (status: Message['status']) => {
    const classes: Record<string, string> = {
      unread: 'bg-primary/10 text-primary',
      read: 'bg-surface-hover text-text-muted',
      replied: 'bg-success-light text-green-700 dark:text-green-400',
      archived: 'bg-surface-hover text-text-muted',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${classes[status]}`}>
        {status}
      </span>
    );
  };

  const unreadCount = messages.filter(m => m.status === 'unread').length;

  // One inbox row. High-priority "needs a reply" items get an amber accent + a
  // category pill (Reservation / Private event / Request) so they read as the
  // priority queue.
  const renderRow = (msg: Message) => {
    const nr = needsReplyNow(msg);
    const sol = !nr && isSolicitation(msg);
    return (
      <div
        key={msg.id}
        onClick={() => handleSelect(msg)}
        className={`flex items-start gap-3 px-3 py-3 border-b border-border cursor-pointer transition-colors hover:bg-surface-hover ${
          selectedId === msg.id ? 'bg-surface-hover' : ''
        } ${msg.status === 'unread' ? 'bg-primary/[0.03]' : ''} ${nr ? 'border-l-2 border-l-amber-500' : ''}`}
      >
        <input
          type="checkbox"
          checked={selectedIds.has(msg.id)}
          onChange={(e) => { e.stopPropagation(); toggleSelect(msg.id); }}
          aria-label="Select message"
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${msg.status === 'unread' ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
              {msg.name}
            </span>
            <span className="text-xs text-text-muted shrink-0">
              {formatDistanceToNow(parseISO(msg.created_at), { addSuffix: true })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {statusIcon(msg.status)}
            <span className={`text-xs truncate ${msg.status === 'unread' ? 'font-medium text-text-primary' : 'text-text-muted'}`}>
              {msg.subject}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {nr && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                {categoryLabel(messageTriage(msg).category)}
              </span>
            )}
            {sol && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-hover text-text-muted">
                Solicitation
              </span>
            )}
            <p className="text-xs text-text-muted truncate">{msg.message}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-0 h-[calc(100dvh-4rem-6.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] lg:h-[calc(100dvh-4rem)]">
      {/* Header — lg:pr-16 keeps the action buttons clear of the global fixed notification bell (top-right). */}
      <div className="flex items-center justify-between gap-2 px-4 lg:px-6 lg:pr-16 py-3 bg-surface border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {showMobileDetail && (
            <button
              onClick={() => setShowMobileDetail(false)}
              className="md:hidden min-h-[44px] min-w-[44px] -ml-1.5 inline-flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors"
              aria-label="Back to messages"
            >
              <ArrowLeft size={18} className="text-text-primary" />
            </button>
          )}
          <h1 className="text-lg font-bold text-text-primary truncate">Messages</h1>
          {unreadCount > 0 && (
            <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-text-muted hidden sm:inline">{selectedIds.size} selected</span>
              <button onClick={() => handleBulkAction('read')} className="btn-ghost text-xs py-1 px-2" aria-label="Mark read">
                <Check size={14} /> <span className="hidden sm:inline">Mark Read</span>
              </button>
              <button onClick={() => handleBulkAction('archive')} className="btn-ghost text-xs py-1 px-2" aria-label="Archive">
                <Archive size={14} /> <span className="hidden sm:inline">Archive</span>
              </button>
            </>
          )}
          <button
            onClick={handleSyncGmail}
            disabled={syncing}
            title="Pull new emails from the Gmail inbox"
            className="btn-ghost text-xs py-1 px-2"
            aria-label="Sync Gmail"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} <span className="hidden sm:inline">Sync Gmail</span>
          </button>
          <button onClick={() => setTemplatesOpen(true)} className="btn-ghost text-xs py-1 px-2" aria-label="Templates">
            <FileText size={14} /> <span className="hidden sm:inline">Templates</span>
          </button>
        </div>
      </div>

      <TemplateManager open={templatesOpen} onClose={() => setTemplatesOpen(false)} />

      <div className="flex flex-1 min-h-0">
        {/* Message List */}
        <div className={`w-full md:w-96 lg:w-[420px] bg-surface border-r border-border flex flex-col ${showMobileDetail ? 'hidden md:flex' : 'flex'}`}>
          {/* Search + Filter */}
          <div className="px-3 py-2 border-b border-border space-y-2 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                className="input-field pl-8 text-xs py-2"
                type="search"
                aria-label="Search messages"
                placeholder="Search messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
              {needsReplyCount > 0 && (
                <button
                  onClick={() => setStatusFilter('needs')}
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    statusFilter === 'needs'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25'
                  }`}
                >
                  <Zap size={11} /> Needs reply ({needsReplyCount})
                </button>
              )}
              {(['all', 'unread', 'read', 'replied', 'archived'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === f
                      ? 'bg-primary text-white'
                      : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
                  }`}
                >
                  {f === 'all' ? `All (${messages.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${messages.filter(m => m.status === f).length})`}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="px-3 py-3.5 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-4 bg-surface-hover rounded w-24" />
                      <div className="h-3 bg-surface-hover rounded w-16" />
                    </div>
                    <div className="h-3 bg-surface-hover rounded w-20 mb-1.5" />
                    <div className="h-3 bg-surface-hover rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : error && messages.length === 0 ? (
              <ErrorState
                onRetry={refresh}
                offline
                className="m-3"
                description="We couldn't load your inbox. No messages were lost."
              />
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <MailWarning size={32} className="mx-auto text-text-muted mb-2" />
                <p className="text-sm text-text-muted">No messages found</p>
              </div>
            ) : (
              <>
                {needsReplyList.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-3 py-1.5 bg-amber-500/10 backdrop-blur-sm border-b border-amber-500/20 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Zap size={12} /> Needs a reply ({needsReplyList.length})
                    </div>
                    {needsReplyList.map(renderRow)}
                  </div>
                )}
                {regularList.length > 0 && (
                  <div>
                    {needsReplyList.length > 0 && (
                      <div className="px-3 py-1.5 bg-surface-hover/60 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                        Everything else
                      </div>
                    )}
                    {regularList.map(renderRow)}
                  </div>
                )}
                {solicitationList.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-surface-hover/60 border-t border-border flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSolicitationsOpen((v) => !v)}
                        aria-expanded={solicitationsOpen}
                        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary transition-colors min-h-[32px]"
                      >
                        <ChevronDown size={12} className={`transition-transform ${solicitationsOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
                        Solicitations ({solicitationList.length})
                      </button>
                      <button
                        type="button"
                        onClick={handleArchiveSolicitations}
                        className="btn-ghost text-xs py-1 px-2"
                        title="Archive all solicitations (reversible — they stay in the Archived filter)"
                      >
                        <Archive size={13} /> Archive all
                      </button>
                    </div>
                    {solicitationsOpen && solicitationList.map(renderRow)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Message Detail */}
        {/* min-w-0 is load-bearing: a flex item defaults to min-width:auto, so
            without it this panel cannot shrink below its content's intrinsic
            width. One long URL or email address in a message then widens the
            panel past the viewport — and because the app shell is
            overflow-x-hidden (DashboardLayout), the overflow is not scrollable,
            it is simply CUT OFF on the right. That is the "I can't read the
            right side of an email" bug. */}
        <div className={`flex-1 min-w-0 flex flex-col bg-background ${showMobileDetail ? 'flex' : 'hidden md:flex'}`}>
          {selected ? (
            <>
              {/* Detail Header */}
              <div className="px-4 lg:px-6 py-4 bg-surface border-b border-border shrink-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-text-primary truncate">{selected.subject}</h2>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 mt-1 min-w-0">
                      <span className="flex items-center gap-1 text-sm text-text-secondary min-w-0">
                        <User size={13} className="shrink-0" /> <span className="truncate">{selected.name}</span>
                      </span>
                      <a
                        href={`mailto:${selected.email}`}
                        aria-label={`Email ${selected.name}`}
                        className="text-sm text-text-muted truncate max-w-full hover:text-primary hover:underline transition-colors"
                      >
                        {selected.email}
                      </a>
                      {selected.source === 'gmail' && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-surface-hover text-text-muted px-1.5 py-0.5 rounded self-start shrink-0">
                          via Gmail
                        </span>
                      )}
                      {selected.phone && (
                        <a
                          href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`}
                          aria-label={`Call ${selected.name}`}
                          className="flex items-center gap-1 text-sm text-text-muted hover:text-primary transition-colors"
                        >
                          <Phone size={13} className="shrink-0" /> {selected.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {statusBadge(selected.status)}
                    {canAcknowledge(selected) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        <Zap size={11} /> Awaiting first reply
                      </span>
                    )}
                    {canAcknowledge(selected) && (
                      <button
                        onClick={handleAcknowledge}
                        title="Pre-fill the standard warm acknowledgement — you review it, then press Send Reply. Nothing is sent automatically."
                        className="btn-secondary text-xs py-1 px-2"
                      >
                        <MailCheck size={14} /> Acknowledge
                      </button>
                    )}
                    <button
                      onClick={handleMakeParty}
                      disabled={convertingParty}
                      title="Turn this inquiry into a private-party lead (no email sent)"
                      className="btn-secondary text-xs py-1 px-2"
                    >
                      {convertingParty ? <Loader2 size={14} className="animate-spin" /> : <PartyPopper size={14} />}
                      Make a party
                    </button>
                    {selected.status !== 'archived' && (
                      <button
                        onClick={() => archiveMessage(selected.id)}
                        className="btn-ghost text-xs py-1 px-2"
                      >
                        <Archive size={14} /> Archive
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-text-muted">
                  <Clock size={12} />
                  {safeFmtDate(selected.created_at, 'MMM d, yyyy h:mm a')}
                </div>
              </div>

              {/* Detail Body */}
              <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
                {/* Message / conversation */}
                {selected.source === 'gmail' ? (
                  <GmailThreadView messages={thread} loading={threadLoading} fallback={selected.message} />
                ) : (
                  <div className="card p-5">
                    <p className="text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed">
                      {selected.message}
                    </p>
                  </div>
                )}

                {/* Previous Reply */}
                {selected.reply_text && (
                  <div className="card p-5 border-green-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCheck size={14} className="text-green-500" />
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">
                        Replied {selected.replied_at && safeFmtDate(selected.replied_at, 'MMM d, yyyy h:mm a')}
                        {selected.replied_by && ` by ${selected.replied_by}`}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{selected.reply_text}</p>
                  </div>
                )}

                {/* Reply Form */}
                {selected.status !== 'archived' && (
                  <div className="card p-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <Reply size={14} />
                        {selected.status === 'replied' ? 'Send Another Reply' : 'Reply'}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={askLunaToDraft}
                          disabled={drafting}
                          className="btn-ghost text-xs"
                          title="Ask Luna to draft a reply you can review"
                        >
                          {drafting ? <Loader2 size={14} className="animate-spin" /> : <Moon size={14} />}
                          <span className="hidden sm:inline">Ask Luna to draft</span>
                        </button>
                        <TemplatePicker
                          onPick={(body) => setReplyText((prev) => (prev ? `${prev}\n\n${body}` : body))}
                          fillContext={{ contact_name: selected.name }}
                        />
                      </div>
                    </div>
                    <textarea
                      ref={replyBoxRef}
                      className="input-field min-h-[100px] resize-y mb-3"
                      placeholder={`Reply to ${selected.name}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-text-muted">
                        Will be sent to {selected.email} via Gmail
                      </p>
                      <button
                        onClick={handleReply}
                        disabled={replying || !replyText.trim()}
                        className="btn-primary text-sm"
                      >
                        {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Send Reply
                      </button>
                    </div>
                  </div>
                )}

                {/* Internal Notes */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <StickyNote size={14} />
                    Internal Notes
                  </h3>
                  <textarea
                    className="input-field min-h-[60px] resize-y mb-2"
                    placeholder="Add private notes about this inquiry..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={notes === (selected.notes || '')}
                    className="btn-secondary text-xs"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Filter size={40} className="mx-auto text-text-muted mb-3" />
                <p className="text-sm text-text-muted">Select a message to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Duplicate-party warning: two explicit choices; X/Escape/backdrop is a
          plain dismiss (no create, no navigation). */}
      <Modal open={!!dupParty} onClose={() => setDupParty(null)} title="Already in the pipeline" maxWidth="max-w-sm">
        <p className="text-text-secondary text-sm mb-6">
          {selected?.name} already has an open party
          {dupParty?.title?.trim() ? ` — “${dupParty.title.trim()}”` : ''}
          {dupParty?.event_date ? ` (${dupParty.event_date})` : ''}, status {dupParty?.status}.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => {
              const p = dupParty;
              setDupParty(null);
              if (p) navigate(`/parties/${p.id}`);
            }}
            className="btn-secondary"
          >
            Open existing
          </button>
          <button
            onClick={() => {
              setDupParty(null);
              convertLeadToParty();
            }}
            className="btn-primary"
          >
            Create anyway
          </button>
        </div>
      </Modal>
    </div>
  );
}
