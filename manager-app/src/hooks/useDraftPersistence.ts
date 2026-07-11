import { useEffect, useCallback, useRef } from 'react';
import type { EditorState, DraftState, TextLayer } from '../types';
import { resolveMediaSrc, revokeAllMediaUrls, isIdbRef } from '../lib/mediaStore';

const DRAFT_PREFIX = 'iggy-draft-';

/**
 * Strip non-persistable URLs from state before saving to localStorage.
 * - `idb://` refs → kept (IndexedDB will resolve them on load)
 * - `http(s)://` URLs → kept (Supabase URLs)
 * - `blob:` URLs → replaced with '' (ephemeral, can't survive reload)
 * - `data:` URLs → replaced with '' (too large for localStorage)
 */
function sanitizeStateForStorage(state: EditorState): EditorState {
  const sanitizeSrc = (src: string | null | undefined): string | null => {
    if (!src) return null;
    if (src.startsWith('idb://')) return src;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    // blob: and data: URLs are not persistable in localStorage
    return null;
  };

  const sanitizeLayer = (layer: TextLayer): TextLayer => {
    const sanitized = { ...layer };
    if (sanitized.imageSrc) {
      sanitized.imageSrc = sanitizeSrc(sanitized.imageSrc) ?? undefined;
    }
    if (sanitized.videoSrc) {
      sanitized.videoSrc = sanitizeSrc(sanitized.videoSrc) ?? undefined;
    }
    // videoPosterSrc is a small data URL (single JPEG frame) — keep it for thumbnails
    // It's typically < 50KB so safe for localStorage
    return sanitized;
  };

  return {
    ...state,
    backgroundImage: sanitizeSrc(state.backgroundImage) ?? null,
    layers: state.layers.map(sanitizeLayer),
  };
}

/**
 * Resolve all idb:// references in a loaded draft state to blob URLs.
 * This is async because IndexedDB reads are async.
 */
async function resolveStateMediaRefs(state: EditorState): Promise<EditorState> {
  const resolveLayer = async (layer: TextLayer): Promise<TextLayer> => {
    const resolved = { ...layer };

    if (resolved.imageSrc && isIdbRef(resolved.imageSrc)) {
      const url = await resolveMediaSrc(resolved.imageSrc);
      if (url) {
        // Keep the idb:// ref as a backup, use blob URL for rendering
        resolved.imageSrc = url;
      }
    }

    if (resolved.videoSrc && isIdbRef(resolved.videoSrc)) {
      const url = await resolveMediaSrc(resolved.videoSrc);
      if (url) {
        resolved.videoSrc = url;
      }
    }

    return resolved;
  };

  const resolvedLayers = await Promise.all(state.layers.map(resolveLayer));

  let backgroundImage = state.backgroundImage;
  if (backgroundImage && isIdbRef(backgroundImage)) {
    backgroundImage = await resolveMediaSrc(backgroundImage);
  }

  return {
    ...state,
    backgroundImage,
    layers: resolvedLayers,
  };
}

/**
 * Read whatever draft JSON is already on disk for a key, tolerating storage
 * access failures the same way the rest of this module does. Exported so the
 * autosave seeding invariant below can be unit-tested without mounting the hook.
 */
export function readExistingDraftJson(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function useDraftPersistence(
  specialId: string | undefined,
  state: EditorState,
  saveForm: DraftState['saveForm']
) {
  const draftKey = `${DRAFT_PREFIX}${specialId || 'new'}`;
  // Last-written draft JSON, used by the autosave tick below to skip no-op
  // writes. Seeded from disk (see the effect right below) rather than '' —
  // an empty seed here is what let a pristine first tick clobber a real
  // draft while the "Resume your draft?" prompt was still undecided.
  const lastSavedRef = useRef<string>('');

  // Seed lastSavedRef from whatever is already on disk for this key BEFORE
  // the autosave interval below can fire. Without this, a fresh mount over
  // an existing draft starts lastSavedRef at '', so the first 5s tick always
  // sees a "change" (pristine state !== '') and overwrites the real draft —
  // even while the restore-vs-discard prompt is still undecided. Seeding to
  // the actual on-disk snapshot means an untouched state compares equal and
  // the tick is skipped; a genuine edit still diffs and saves normally.
  useEffect(() => {
    lastSavedRef.current = readExistingDraftJson(draftKey);
  }, [draftKey]);

  // Auto-save every 5 seconds (sanitized — no blob/data URLs)
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const sanitizedState = sanitizeStateForStorage(state);
        const draft: DraftState = {
          editorState: sanitizedState,
          saveForm,
          updatedAt: new Date().toISOString(),
          specialId: specialId ? Number(specialId) : undefined,
        };
        const serialized = JSON.stringify(draft);

        // Only save if changed
        if (serialized !== lastSavedRef.current) {
          localStorage.setItem(draftKey, serialized);
          lastSavedRef.current = serialized;
        }
      } catch (e) {
        // localStorage quota exceeded — silently fail
        console.warn('[draft] Auto-save failed:', e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [state, saveForm, draftKey, specialId]);

  // Save on beforeunload (sanitized)
  useEffect(() => {
    const handler = () => {
      try {
        const sanitizedState = sanitizeStateForStorage(state);
        const draft: DraftState = {
          editorState: sanitizedState,
          saveForm,
          updatedAt: new Date().toISOString(),
          specialId: specialId ? Number(specialId) : undefined,
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // Can't do much in beforeunload — silently fail
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state, saveForm, draftKey, specialId]);

  // Load draft (async — resolves idb:// references to blob URLs)
  const loadDraft = useCallback(async (): Promise<DraftState | null> => {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return null;
    try {
      const draft = JSON.parse(raw) as DraftState;
      // Resolve any idb:// media references to blob URLs
      draft.editorState = await resolveStateMediaRefs(draft.editorState);
      return draft;
    } catch {
      return null;
    }
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
    lastSavedRef.current = '';
    // Clean up any blob URLs we created from idb:// resolution
    revokeAllMediaUrls();
  }, [draftKey]);

  const hasDraft = useCallback((): boolean => {
    return localStorage.getItem(draftKey) !== null;
  }, [draftKey]);

  return { loadDraft, clearDraft, hasDraft };
}

// Utility to get all drafts (for Specials page) — sync, no media resolution
export function getAllDrafts(): DraftState[] {
  const drafts: DraftState[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DRAFT_PREFIX)) {
      try {
        const draft = JSON.parse(localStorage.getItem(key)!) as DraftState;
        drafts.push(draft);
      } catch {
        // ignore invalid drafts
      }
    }
  }
  return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function clearDraftByKey(specialId?: number) {
  const key = `${DRAFT_PREFIX}${specialId || 'new'}`;
  localStorage.removeItem(key);
}
