import { describe, expect, it } from 'vitest';
import { collectMissingMessages } from '../../supabase/functions/gmail-sync/pagination';

describe('Gmail catch-up', () => {
  it('reads the next page when every email on page one was already imported', async () => {
    const result = await collectMissingMessages(async (token) => token
      ? { ids: ['new'] } : { ids: ['old'], nextPageToken: 'next' }, async () => new Set(['old']), 40);
    expect(result).toEqual({ todo: ['new'], scanned: 2, truncated: false });
  });
  it('a second run progresses beyond a capped first run', async () => {
    const saved = new Set<string>();
    const list = async () => ({ ids: ['a', 'b', 'c'] });
    const first = await collectMissingMessages(list, async () => saved, 2);
    first.todo.forEach((id) => saved.add(id));
    const second = await collectMissingMessages(list, async () => saved, 2);
    expect(first.truncated).toBe(true);
    expect(second).toEqual({ todo: ['c'], scanned: 3, truncated: false });
  });
  it('surfaces list failures rather than claiming the inbox is current', async () => {
    await expect(collectMissingMessages(async () => { throw new Error('Gmail unavailable'); }, async () => new Set(), 40)).rejects.toThrow('Gmail unavailable');
  });
});
