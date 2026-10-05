import { describe, expect, it } from 'vitest';
import type { Message } from '../types';
import { latestConversations } from './messageConversations';
import { needsReplyNow } from '../utils/triage';

const message = (id: number, overrides: Partial<Message> = {}) => ({
  id, gmail_thread_id: 'same-booking', created_at: `2026-09-${String(id).padStart(2, '0')}T12:00:00Z`,
  category: 'event', needs_reply: true, importance: 'high', status: 'read', ...overrides,
}) as Message;

describe('conversation queue', () => {
  it('shows one latest booking reply instead of every historical question', () => {
    expect(latestConversations([message(3), message(1), message(2)]).map((m) => m.id)).toEqual([3]);
  });
  it('does not revive older unanswered rows when the newest is replied or archived', () => {
    for (const status of ['replied', 'archived'] as const) {
      expect(latestConversations([message(1), message(2, { status })]).filter(needsReplyNow)).toEqual([]);
    }
  });
  it('a new customer follow-up reopens a replied conversation', () => {
    expect(latestConversations([message(1, { status: 'replied' }), message(2)]).filter(needsReplyNow).map((m) => m.id)).toEqual([2]);
  });
  it('keeps contact forms and unrelated threads separate', () => {
    expect(latestConversations([message(1, { gmail_thread_id: null }), message(2, { gmail_thread_id: null }), message(3)])).toHaveLength(3);
  });
});
