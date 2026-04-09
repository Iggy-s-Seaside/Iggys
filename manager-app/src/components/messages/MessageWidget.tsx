import { Link } from 'react-router-dom';
import { Mail, MailOpen, Clock } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { Message } from '../../types';

interface MessageWidgetProps {
  messages: Message[];
  loading?: boolean;
}

export function MessageWidget({ messages, loading }: MessageWidgetProps) {
  const unread = messages.filter((m) => m.status === 'unread');
  const recent = messages.slice(0, 5);

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-text-primary">Messages</h2>
          {unread.length > 0 && (
            <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unread.length}
            </span>
          )}
        </div>
        <Link to="/messages" className="text-sm text-primary hover:text-primary-hover">
          View all
        </Link>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-8 h-8 bg-surface-hover rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-surface-hover rounded w-1/2 mb-1" />
                <div className="h-3 bg-surface-hover rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="p-8 text-center text-text-muted text-sm">No messages yet</div>
      ) : (
        <div className="divide-y divide-border">
          {recent.map((msg) => (
            <Link
              key={msg.id}
              to="/messages"
              className="flex items-start gap-3 px-5 py-3 hover:bg-surface-hover transition-colors"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.status === 'unread' ? 'bg-primary/10' : 'bg-surface-hover'
              }`}>
                {msg.status === 'unread' ? (
                  <Mail size={14} className="text-primary" />
                ) : (
                  <MailOpen size={14} className="text-text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${msg.status === 'unread' ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                    {msg.name}
                  </p>
                  <span className="text-xs text-text-muted shrink-0 flex items-center gap-1">
                    <Clock size={10} />
                    {formatDistanceToNow(parseISO(msg.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-text-muted truncate">{msg.subject}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
