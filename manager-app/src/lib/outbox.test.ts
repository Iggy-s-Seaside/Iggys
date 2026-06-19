import { describe, it, expect, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enqueue, flush, clear, size } from './outbox';

// In-memory localStorage + online navigator so the outbox runs under Node.
function memStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}

// Mock Supabase whose result is driven by the entry payload's `mode`:
//   'ok' -> { error: null }, 'error' -> returns a Supabase error (data-level),
//   'throw' -> rejects (network failure).
function makeSupabase(): SupabaseClient {
  const result = (payload?: Record<string, unknown>) => {
    const mode = payload?.mode;
    if (mode === 'throw') return Promise.reject(new Error('network down'));
    if (mode === 'error') return Promise.resolve({ error: { message: 'constraint violation' } });
    return Promise.resolve({ error: null });
  };
  return {
    from: () => ({
      insert: (payload: Record<string, unknown>) => result(payload),
      update: (payload: Record<string, unknown>) => ({ eq: () => result(payload) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  } as unknown as SupabaseClient;
}

describe('outbox flush — poison-entry quarantine', () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = { localStorage: memStorage() };
    clear();
  });

  it('drains the whole queue on the happy path', async () => {
    enqueue({ table: 't', op: 'insert', payload: { mode: 'ok', n: 1 } });
    enqueue({ table: 't', op: 'insert', payload: { mode: 'ok', n: 2 } });
    enqueue({ table: 't', op: 'insert', payload: { mode: 'ok', n: 3 } });
    const res = await flush(makeSupabase());
    expect(res.flushed).toBe(3);
    expect(size()).toBe(0);
  });

  it('quarantines a server-rejected poison entry after a few passes, unblocking the rest', async () => {
    enqueue({ table: 't', op: 'insert', payload: { mode: 'ok', n: 'A' } });
    enqueue({ table: 't', op: 'insert', payload: { mode: 'error', n: 'B-poison' } });
    enqueue({ table: 't', op: 'insert', payload: { mode: 'ok', n: 'C' } });

    // Pass 1: A flushes, B errors (attempt 1) and blocks C.
    await flush(makeSupabase());
    expect(size()).toBe(2); // B + C remain

    // Passes 2 & 3: B keeps erroring; on the 3rd it hits the cap, gets dropped,
    // and C finally flushes behind it.
    await flush(makeSupabase());
    await flush(makeSupabase());
    expect(size()).toBe(0); // poison B quarantined, C drained
  });

  it('NEVER drops an entry on a network throw — preserves it (and order) for retry', async () => {
    enqueue({ table: 't', op: 'insert', payload: { mode: 'throw', n: 'X' } });
    enqueue({ table: 't', op: 'insert', payload: { mode: 'ok', n: 'Y' } });

    for (let i = 0; i < 5; i++) await flush(makeSupabase());
    // X throws every pass -> break before Y; nothing is dropped (true offline replay).
    expect(size()).toBe(2);
  });
});
