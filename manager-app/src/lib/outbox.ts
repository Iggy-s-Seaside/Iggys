import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Offline write outbox.
 *
 * A localStorage-backed, in-order queue of writes that failed because the
 * device was offline. The CRUD layer enqueues a write when its network call
 * fails; on reconnect (or next mount) `flush` replays the queue against a live
 * Supabase client and drops each entry that lands successfully.
 *
 * Framework-agnostic by design — no React imports — so it can be driven from a
 * hook, a service worker, or a plain timer. It is also deliberately defensive:
 * a corrupt/oversized localStorage value must never crash a write, so every
 * read/write is wrapped and `enqueue` never throws.
 */

export type OutboxOp = 'insert' | 'update' | 'delete';

export interface OutboxEntry {
  /** Stable, sortable id (time-based + random suffix). */
  id: string;
  table: string;
  op: OutboxOp;
  /** Row data for insert/update; ignored for delete. */
  payload?: Record<string, unknown>;
  /** Target row id for update/delete; ignored for insert. */
  rowId?: number | string;
  /** Epoch ms; entries replay oldest-first. */
  createdAt: number;
  /** How many replay passes this entry has come back with a data-level Supabase
   *  error. Used to quarantine a poison entry instead of deadlocking the queue. */
  attempts?: number;
}

export interface FlushResult {
  /** Count of entries successfully replayed and removed this pass. */
  flushed: number;
  /** Count of entries still queued after this pass (failures + untouched). */
  remaining: number;
}

const STORAGE_KEY = 'iggys.outbox.v1';

/**
 * Cap the queue so a long offline stretch can't blow past localStorage's ~5MB
 * budget. When full we drop the oldest entry (FIFO eviction) to make room.
 */
const MAX_ENTRIES = 200;

/**
 * How many replay passes an entry may return a data-level Supabase error
 * (NOT NULL / FK / RLS / unique violation) before it is dropped. A genuine
 * network failure THROWS instead and is retried indefinitely — only
 * server-rejected entries count here, so one poison row can't wedge the queue.
 */
const MAX_REPLAY_ATTEMPTS = 3;

/** True when the browser reports no network interface up. SSR-safe. */
export function isOffline(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    // Accessing localStorage can throw in some privacy modes / sandboxed iframes.
    return false;
  }
}

function readQueue(): OutboxEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Trust-but-verify: keep only entries that still look like OutboxEntry.
    return parsed.filter(
      (e): e is OutboxEntry =>
        e != null &&
        typeof e.id === 'string' &&
        typeof e.table === 'string' &&
        (e.op === 'insert' || e.op === 'update' || e.op === 'delete') &&
        typeof e.createdAt === 'number',
    );
  } catch (err) {
    console.error('[outbox] read failed:', err);
    return [];
  }
}

function writeQueue(entries: OutboxEntry[]): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    // Quota exceeded or serialization failure — drop the oldest half and retry
    // once so we degrade gracefully instead of wedging the queue.
    console.error('[outbox] write failed:', err);
    try {
      const trimmed = entries.slice(Math.ceil(entries.length / 2));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* give up silently — the in-memory caller already has its data */
    }
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Append a pending write. `id` and `createdAt` are filled in if omitted.
 * Never throws — a failed enqueue must not break the optimistic UI path that
 * called it.
 */
export function enqueue(
  entry: Omit<OutboxEntry, 'id' | 'createdAt'> & Partial<Pick<OutboxEntry, 'id' | 'createdAt'>>,
): OutboxEntry | null {
  try {
    const full: OutboxEntry = {
      id: entry.id ?? makeId(),
      table: entry.table,
      op: entry.op,
      payload: entry.payload,
      rowId: entry.rowId,
      createdAt: entry.createdAt ?? Date.now(),
    };
    const queue = readQueue();
    queue.push(full);
    // FIFO eviction if we're over the cap (oldest entries fall off the front).
    const capped = queue.length > MAX_ENTRIES ? queue.slice(queue.length - MAX_ENTRIES) : queue;
    writeQueue(capped);
    return full;
  } catch (err) {
    console.error('[outbox] enqueue failed:', err);
    return null;
  }
}

/** All queued entries, oldest-first. */
export function getAll(): OutboxEntry[] {
  return readQueue().sort((a, b) => a.createdAt - b.createdAt);
}

/** Number of queued entries. */
export function size(): number {
  return readQueue().length;
}

/** Drop the entire queue. */
export function clear(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[outbox] clear failed:', err);
  }
}

/**
 * Replay queued writes in order against a live Supabase client. Each entry is
 * removed only on success; a failure leaves it (and everything after it that we
 * stop processing) in place for the next flush. Returns counts for this pass.
 *
 * Stops at the first failure so writes against the same row stay ordered
 * (e.g. an insert that hasn't landed must not be followed by its update).
 */
let flushing: Promise<FlushResult> | null = null;

export interface FlushOptions {
  /** Called once for each entry PERMANENTLY dropped without ever reaching the
   *  server — a poison entry that exhausted its retries, or a malformed entry
   *  with no target rowId. Lets the UI surface the otherwise-silent offline-write
   *  loss (e.g. a toast) instead of only a console.error. */
  onPoisonDrop?: (entry: OutboxEntry) => void;
}

export async function flush(supabase: SupabaseClient, opts: FlushOptions = {}): Promise<FlushResult> {
  // Single-flight guard: useSupabaseCRUD mounts on 10+ screens and each calls
  // flush() on mount + on the window 'online' event. Without this, two flushes
  // would read the same not-yet-removed entry (removeById only runs AFTER the
  // network insert resolves) and replay it twice — a duplicate INSERT. Concurrent
  // callers share the one in-flight pass.
  if (flushing) return flushing;
  flushing = doFlush(supabase, opts).finally(() => { flushing = null; });
  return flushing;
}

async function doFlush(supabase: SupabaseClient, opts: FlushOptions = {}): Promise<FlushResult> {
  const queue = getAll();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  let flushed = 0;

  for (const entry of queue) {
    let returnedError = false; // server rejected it (data-level — won't self-heal)
    let threw = false;         // network failure (request didn't reach the server)
    let malformed = false;     // no rowId to target — undeliverable, drop + notify
    try {
      if (entry.op === 'insert') {
        const { error } = await supabase
          .from(entry.table)
          .insert((entry.payload ?? {}) as Record<string, unknown>);
        returnedError = !!error;
        if (error) console.error(`[outbox] replay insert ${entry.table} failed:`, error.message);
      } else if (entry.op === 'update') {
        if (entry.rowId == null) {
          // Malformed entry — can't target a row; drop it rather than loop forever.
          console.error('[outbox] update entry missing rowId, dropping:', entry.id);
          malformed = true;
        } else {
          const { error } = await supabase
            .from(entry.table)
            .update((entry.payload ?? {}) as Record<string, unknown>)
            .eq('id', entry.rowId);
          returnedError = !!error;
          if (error) console.error(`[outbox] replay update ${entry.table} failed:`, error.message);
        }
      } else {
        // delete
        if (entry.rowId == null) {
          console.error('[outbox] delete entry missing rowId, dropping:', entry.id);
          malformed = true;
        } else {
          const { error } = await supabase.from(entry.table).delete().eq('id', entry.rowId);
          returnedError = !!error;
          if (error) console.error(`[outbox] replay delete ${entry.table} failed:`, error.message);
        }
      }
    } catch (err) {
      // Network throw — keep the entry and bail so order is preserved; retry next pass.
      console.error('[outbox] replay threw:', err);
      threw = true;
    }

    if (threw) break;

    if (malformed) {
      // Undeliverable (no target row): drop it and surface the loss. It never
      // reached the server, so it must NOT be counted as a flushed write.
      opts.onPoisonDrop?.(entry);
      removeById(entry.id);
      continue;
    }

    if (returnedError) {
      // The server rejected this entry (RLS / FK / NOT NULL / unique). It won't
      // heal on plain retry, but give it a few passes (it may be transient, or
      // depend on an earlier entry landing first), then QUARANTINE it so one bad
      // row can't wedge everything queued behind it forever.
      const attempts = (entry.attempts ?? 0) + 1;
      if (attempts >= MAX_REPLAY_ATTEMPTS) {
        console.error(`[outbox] dropping poison entry ${entry.id} (${entry.op} ${entry.table}) after ${attempts} failed attempts`);
        opts.onPoisonDrop?.(entry);
        removeById(entry.id);
        continue;
      }
      bumpAttempts(entry.id, attempts);
      break;
    }

    // Success: the entry was written to the server — remove just this one and continue.
    // (Malformed entries are handled+dropped above and never reach here.)
    removeById(entry.id);
    flushed += 1;
  }

  return { flushed, remaining: size() };
}

function removeById(id: string): void {
  const queue = readQueue().filter((e) => e.id !== id);
  writeQueue(queue);
}

function bumpAttempts(id: string, attempts: number): void {
  const queue = readQueue().map((e) => (e.id === id ? { ...e, attempts } : e));
  writeQueue(queue);
}

/**
 * Fire `cb` whenever the browser regains connectivity (window `online` event).
 * Returns an unsubscribe function. No-op (returns a no-op cleanup) outside the
 * browser.
 */
export function subscribeOnline(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
