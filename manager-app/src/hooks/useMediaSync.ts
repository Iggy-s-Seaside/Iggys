import { useCallback, useRef } from 'react';
import { useImageUpload } from './useImageUpload';
import { getMedia, extractMediaId } from '../lib/mediaStore';

interface SyncEntry {
  mediaId: string;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  supabaseUrl?: string;
}

/**
 * Background media sync: uploads IndexedDB-stored media to Supabase storage
 * in the background, without blocking the user's editing flow.
 *
 * Returns a callback that:
 * - Takes an idb:// ref string
 * - Uploads the blob to Supabase in the background
 * - Returns a Promise<string | null> with the Supabase public URL on success
 */
export function useMediaSync() {
  const { upload } = useImageUpload();
  const syncMap = useRef<Map<string, SyncEntry>>(new Map());

  const syncToSupabase = useCallback(async (
    idbRef: string,
    folder = 'media'
  ): Promise<string | null> => {
    const mediaId = extractMediaId(idbRef);
    if (!mediaId) return null;

    // Already synced or in progress?
    const existing = syncMap.current.get(mediaId);
    if (existing?.status === 'done' && existing.supabaseUrl) {
      return existing.supabaseUrl;
    }
    if (existing?.status === 'uploading') {
      // Wait for the in-progress upload — poll briefly
      return new Promise((resolve) => {
        const check = setInterval(() => {
          const entry = syncMap.current.get(mediaId);
          if (entry?.status === 'done') {
            clearInterval(check);
            resolve(entry.supabaseUrl ?? null);
          } else if (entry?.status === 'failed') {
            clearInterval(check);
            resolve(null);
          }
        }, 500);
        // Timeout after 60s
        setTimeout(() => { clearInterval(check); resolve(null); }, 60000);
      });
    }

    // Start upload
    syncMap.current.set(mediaId, { mediaId, status: 'uploading' });

    try {
      const entry = await getMedia(mediaId);
      if (!entry) {
        syncMap.current.set(mediaId, { mediaId, status: 'failed' });
        return null;
      }

      const ext = entry.metadata.filename.split('.').pop() || 'bin';
      const file = new File([entry.blob], `${mediaId}.${ext}`, {
        type: entry.metadata.mimeType,
      });

      const url = await upload(file, folder);
      if (url) {
        syncMap.current.set(mediaId, { mediaId, status: 'done', supabaseUrl: url });
        return url;
      } else {
        syncMap.current.set(mediaId, { mediaId, status: 'failed' });
        return null;
      }
    } catch {
      syncMap.current.set(mediaId, { mediaId, status: 'failed' });
      return null;
    }
  }, [upload]);

  return { syncToSupabase };
}
