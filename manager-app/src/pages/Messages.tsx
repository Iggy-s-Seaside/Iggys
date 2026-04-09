import { useState, useEffect, useMemo } from 'react';
import {
  Mail, MailOpen, Reply, Archive, Search, Filter, Check, CheckCheck,
  Clock, Phone, User, ArrowLeft, Send, Loader2, StickyNote, MailWarning
} from 'lucide-react';
import { useMessages } from '../hooks/useMessages';
import { supabase } from '../lib/supabase';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import type { Message } from '../types';
import toast from 'react-hot-toast';

type StatusFilter = 'all' | 'unread' | 'read' | 'replied' | 'archived';

export function Messages() {
  const {
    messages, loading, markAsRead, markAsReplied,
    archiveMessage, updateNotes, bulkMarkRead, bulkArchive
  } = useMessages();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showMobileDetail, setShowMobileDetail] = useState(false);

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

      // Call the send-reply Edge Function
      const { data, error } = await supabase.functions.invoke('send-reply', {
        body: {
          to: selected.email,
          subject: selected.subject,
          body: replyText,
          messageId: selected.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Reply sent to ${selected.email}`);
      setReplyText('');
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
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">{selectedIds.size} selected</span>
            <button onClick={() => handleBulkAction('read')} className="btn-ghost text-xs py-1 px-2">
              <Check size={14} /> Mark Read
            </button>
            <button onClick={() => handleBulkAction('archive')} className="btn-ghost text-xs py-1 px-2">
              <Archive size={14} /> Archive
            </button>
          </div>
        )}
      </div>

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
                {/* Message Content */}
                <div className="card p-5">
                  <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                    {selected.message}
                  </p>
                </div>

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
                    <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                      <Reply size={14} />
                      {selected.status === 'replied' ? 'Send Another Reply' : 'Reply'}
                    </h3>
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
