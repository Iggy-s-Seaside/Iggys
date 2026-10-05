import type { Message } from '../types';

/** Gmail imports one row per inbound email. Use the newest row in each actual
 * thread; older questions must not inflate the current reply queue. Never
 * merge unrelated enquiries just because the sender or subject is the same. */
export function latestConversations(messages: Message[]): Message[] {
  const newest = new Map<string, Message>();
  for (const message of messages) {
    const key = message.gmail_thread_id ? `gmail:${message.gmail_thread_id}` : `message:${message.id}`;
    const previous = newest.get(key);
    if (!previous || message.created_at > previous.created_at ||
      (message.created_at === previous.created_at && message.id > previous.id)) newest.set(key, message);
  }
  return [...newest.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
