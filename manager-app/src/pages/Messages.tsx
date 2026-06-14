import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Mail, MailOpen, Reply, Archive, Search, Filter, Check, CheckCheck,
  Clock, Phone, User, ArrowLeft, Send, Loader2, StickyNote, MailWarning, FileText, RefreshCw
} from 'lucide-react';
import { useMessages } from '../hooks/useMessages';
import { useLunaHandoff } from '../hooks/useLunaHandoff';
import { supabase } from '../lib/supabase';
import { syncGmailInbox, fetchGmailThread, type ThreadMessage } from '../lib/partyActions';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import type { Message } from '../types';
import toast from 'react-hot-toast';
import { TemplatePicker } from '../components/messages/TemplatePicker';
import { TemplateManager } from '../components/messages/TemplateManager';

type StatusFilter = 'all' | 'unread' | 'read' | 'replied' | 'archived';

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
        <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{fallback}</p>
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
              {m.date ? format(parseISO(m.date), 'MMM d, h:mm a') : ''}
            </span>
          </div>
          <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{m.body}</p>
        </div>
      ))}
    </div>
  );
}

export function Messages() {
  const {
    messages, loading, refresh, markAsRead, markAsReplied,
    archiveMessage, updateNotes, bulkMarkRead, bulkArchive
  } = useMessages();
  const handoff = useLunaHandoff();
  const [syncing, setSyncing] = useState(false);

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

  const filtered = useMemo(() => {
    let result = messages;
    if (statusFilter !== 'all') {
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

  const handleSaveNotes = async () => {
    if (!selected) return;
    await updateNotes(selected.id, notes);
    toast.success('Notes saved');
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

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col -m-6 lg:-m-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 bg-surface border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          {showMobileDetail && (
            <button
              onClick={() => setShowMobileDetail(false)}
              className="md:hidden p-1.5 rounded-lg hover:bg-surface-hover"
            >
              <ArrowLeft size={18} className="text-text-primary" />
            </button>
          )}
          <h1 className="text-lg font-bold text-text-primary">Messages</h1>
          {unreadCount > 0 && (
            <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-text-muted">{selectedIds.size} selected</span>
              <button onClick={() => handleBulkAction('read')} className="btn-ghost text-xs py-1 px-2">
                <Check size={14} /> Mark Read
              </button>
              <button onClick={() => handleBulkAction('archive')} className="btn-ghost text-xs py-1 px-2">
                <Archive size={14} /> Archive
              </button>
            </>
          )}
          <button
            onClick={handleSyncGmail}
            disabled={syncing}
            title="Pull new emails from the Gmail inbox"
            className="btn-ghost text-xs py-1 px-2"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync Gmail
          </button>
          <button onClick={() => setTemplatesOpen(true)} className="btn-ghost text-xs py-1 px-2">
            <FileText size={14} /> Templates
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
                placeholder="Search messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
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
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <MailWarning size={32} className="mx-auto text-text-muted mb-2" />
                <p className="text-sm text-text-muted">No messages found</p>
              </div>
            ) : (
              filtered.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => handleSelect(msg)}
                  className={`flex items-start gap-3 px-3 py-3 border-b border-border cursor-pointer transition-colors hover:bg-surface-hover ${
                    selectedId === msg.id ? 'bg-surface-hover' : ''
                  } ${msg.status === 'unread' ? 'bg-primary/[0.03]' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(msg.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(msg.id); }}
                    className="mt-1 accent-primary"
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
                    <p className="text-xs text-text-muted truncate mt-0.5">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className={`flex-1 flex flex-col bg-background ${showMobileDetail ? 'flex' : 'hidden md:flex'}`}>
          {selected ? (
            <>
              {/* Detail Header */}
              <div className="px-4 lg:px-6 py-4 bg-surface border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-text-primary truncate">{selected.subject}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-sm text-text-secondary">
                        <User size={13} /> {selected.name}
                      </span>
                      <span className="text-sm text-text-muted">{selected.email}</span>
                      {selected.source === 'gmail' && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-surface-hover text-text-muted px-1.5 py-0.5 rounded">
                          via Gmail
                        </span>
                      )}
                      {selected.phone && (
                        <span className="flex items-center gap-1 text-sm text-text-muted">
                          <Phone size={13} /> {selected.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(selected.status)}
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
                  {format(parseISO(selected.created_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>

              {/* Detail Body */}
              <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
                {/* Message / conversation */}
                {selected.source === 'gmail' ? (
                  <GmailThreadView messages={thread} loading={threadLoading} fallback={selected.message} />
                ) : (
                  <div className="card p-5">
                    <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
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
                        Replied {selected.replied_at && format(parseISO(selected.replied_at), 'MMM d, yyyy h:mm a')}
                        {selected.replied_by && ` by ${selected.replied_by}`}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{selected.reply_text}</p>
                  </div>
                )}

                {/* Reply Form */}
                {selected.status !== 'archived' && (
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <Reply size={14} />
                        {selected.status === 'replied' ? 'Send Another Reply' : 'Reply'}
                      </h3>
                      <TemplatePicker
                        onPick={(body) => setReplyText((prev) => (prev ? `${prev}\n\n${body}` : body))}
                        fillContext={{ contact_name: selected.name }}
                      />
                    </div>
                    <textarea
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
    </div>
  );
}
