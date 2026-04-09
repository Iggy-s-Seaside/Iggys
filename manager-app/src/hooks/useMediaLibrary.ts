import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import type { MediaItem } from '../types';

const BUCKET = 'images';
const FOLDERS = ['editor-bg', 'specials', 'events'] as const;
const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

export function useMediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const allItems: MediaItem[] = [];

    for (const folder of FOLDERS) {
      const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (error) {
        console.error(`Error listing ${folder}:`, error.message);
        continue;
      }

      if (data) {
        for (const file of data) {
          if (file.name === '.emptyFolderPlaceholder') continue;
          allItems.push({
            name: file.name,
            folder,
            url: `${BASE_URL}/${folder}/${file.name}`,
            created_at: file.created_at ?? null,
            size: file.metadata?.size ?? 0,
          });
        }
      }
    }

    // Also list root-level images (drink photos, bar photos)
    const { data: rootData } = await supabase.storage.from(BUCKET).list('', {
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (rootData) {
      for (const file of rootData) {
        if (file.name === '.emptyFolderPlaceholder') continue;
        // Skip folders
        if (file.id === null) continue;
        allItems.push({
          name: file.name,
          folder: '',
          url: `${BASE_URL}/${file.name}`,
          created_at: file.created_at ?? null,
          size: file.metadata?.size ?? 0,
        });
      }
    }

    setItems(allItems);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const deleteItem = useCallback(async (item: MediaItem) => {
    const path = item.folder ? `${item.folder}/${item.name}` : item.name;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      return false;
    }
    toast.success('Image deleted');
    await refresh();
    return true;
  }, [refresh]);

  return { items, loading, refresh, deleteItem };
}
