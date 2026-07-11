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

describe('outbox flush — update / delete / malformed / single-flight', () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = { localStorage: memStorage() };
    clear();
  });

  it('replays update and delete entries on the happy path', async () => {
    enqueue({ table: 't', op: 'update', rowId: 1, payload: { mode: 'ok', n: 1 } });
    enqueue({ table: 't', op: 'delete', rowId: 2 });
    const res = await flush(makeSupabase());
    expect(res.flushed).toBe(2);
    expect(size()).toBe(0);
  });

  it('drops a malformed entry (no rowId) WITHOUT counting it as flushed, and notifies', async () => {
    const dropped: string[] = [];
    enqueue({ table: 't', op: 'update', payload: { mode: 'ok' } }); // no rowId — undeliverable
    const res = await flush(makeSupabase(), { onPoisonDrop: (e) => dropped.push(e.op) });
    expect(res.flushed).toBe(0); // never reached the server, so not counted as flushed
    expect(size()).toBe(0); // but it IS removed (not looped forever)
    expect(dropped).toEqual(['update']);
  });

  it('quarantines a server-rejected UPDATE poison entry after the cap, notifying once', async () => {
    const dropped: string[] = [];
    enqueue({ table: 't', op: 'update', rowId: 9, payload: { mode: 'error' } });
    enqueue({ table: 't', op: 'insert', payload: { mode: 'ok', n: 'after' } });
    for (let i = 0; i < 3; i++) await flush(makeSupabase(), { onPoisonDrop: (e) => dropped.push(e.id) });
    expect(size()).toBe(0); // poison update quarantined; the insert behind it drained
    expect(dropped.length).toBe(1);
  });

  it('single-flight: concurrent flush() calls share one in-flight pass (no double-replay)', async () => {
    enqueue({ table: 't', op: 'insert', payload: { mode: 'ok', n: 1 } });
    enqueue({ table: 't', op: 'insert', payload: { mode: 'ok', n: 2 } });
    const [a, b] = await Promise.all([flush(makeSupabase()), flush(makeSupabase())]);
    expect(a).toBe(b); // same in-flight promise returned by reference
    expect(a.flushed).toBe(2);
    expect(size()).toBe(0);
  });
});
