/**
 * IndexedDB-backed media storage for large blobs (images, videos).
 *
 * Layers reference stored media via "idb://media-{uuid}" strings.
 * This keeps localStorage drafts small (JSON with references only)
 * while persisting multi-MB media across page reloads.
 */

const DB_NAME = 'iggy-media';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

export interface MediaMetadata {
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: string;
}

interface MediaEntry {
  id: string;
  blob: Blob;
  metadata: MediaMetadata;
}

// ── Database lifecycle ──

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

// ── CRUD operations ──

export async function storeMedia(
  id: string,
  blob: Blob,
  metadata: MediaMetadata
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry: MediaEntry = { id, blob, metadata };
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMedia(
  id: string
): Promise<{ blob: Blob; metadata: MediaMetadata } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      const entry = request.result as MediaEntry | undefined;
      if (entry) {
        resolve({ blob: entry.blob, metadata: entry.metadata });
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllMediaIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result as string[]);
    request.onerror = () => reject(request.error);
  });
}

// ── URL resolution ──

const IDB_PREFIX = 'idb://';

/** Active blob URLs mapped to their idb:// source for cleanup */
const activeBlobUrls = new Map<string, string>();

/**
 * Resolve a media source string to a usable URL.
 * - `idb://media-{uuid}` → fetches blob from IndexedDB, returns object URL
 * - HTTP/HTTPS URLs → returned as-is
 * - Data URLs → returned as-is
 */
export async function resolveMediaSrc(src: string): Promise<string> {
  if (!src.startsWith(IDB_PREFIX)) return src;

  const id = src.slice(IDB_PREFIX.length);
  const entry = await getMedia(id);
  if (!entry) {
    console.warn(`[mediaStore] Missing IndexedDB entry for ${src}`);
    return '';
  }

  const blobUrl = URL.createObjectURL(entry.blob);
  activeBlobUrls.set(blobUrl, src);
  return blobUrl;
}

/**
 * Revoke a blob URL created by resolveMediaSrc.
 */
export function revokeMediaUrl(url: string): void {
  if (activeBlobUrls.has(url)) {
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
  }
}

/**
 * Revoke ALL active blob URLs. Call on unmount.
 */
export function revokeAllMediaUrls(): void {
  for (const url of activeBlobUrls.keys()) {
    URL.revokeObjectURL(url);
  }
  activeBlobUrls.clear();
}

// ── Helpers ──

/**
 * Check if a source string is an IndexedDB reference.
 */
export function isIdbRef(src: string): boolean {
  return src.startsWith(IDB_PREFIX);
}

/**
 * Create an idb:// reference string for a media ID.
 */
export function makeIdbRef(id: string): string {
  return `${IDB_PREFIX}${id}`;
}

/**
 * Generate a unique media ID.
 */
export function generateMediaId(): string {
  return `media-${crypto.randomUUID()}`;
}

/**
 * Delete IndexedDB entries not referenced by any active layer.
 * Pass the list of media IDs currently in use (extracted from layer sources).
 */
export async function cleanupOrphanedMedia(activeIds: string[]): Promise<number> {
  const allIds = await getAllMediaIds();
  const activeSet = new Set(activeIds);
  let cleaned = 0;

  for (const id of allIds) {
    if (!activeSet.has(id)) {
      await deleteMedia(id);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Extract the media ID from an idb:// reference, or null if not an idb ref.
 */
export function extractMediaId(src: string): string | null {
  if (!src.startsWith(IDB_PREFIX)) return null;
  return src.slice(IDB_PREFIX.length);
}

/**
 * Get the blob for a media source, regardless of format.
 * - idb:// → fetch from IndexedDB
 * - data URL → convert to blob
 * - HTTP URL → fetch and convert to blob
 */
export async function getMediaBlob(src: string): Promise<Blob | null> {
  if (src.startsWith(IDB_PREFIX)) {
    const id = src.slice(IDB_PREFIX.length);
    const entry = await getMedia(id);
    return entry?.blob ?? null;
  }

  if (src.startsWith('data:')) {
    const res = await fetch(src);
    return res.blob();
  }

  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      const res = await fetch(src);
      return res.blob();
    } catch {
      return null;
    }
  }

  return null;
}
