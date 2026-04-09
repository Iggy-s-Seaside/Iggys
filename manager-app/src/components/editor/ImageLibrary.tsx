import { useState, useRef } from 'react';
import { X, Upload, Trash2, Search, FolderOpen, Image, Loader2, RefreshCw } from 'lucide-react';
import { useMediaLibrary } from '../../hooks/useMediaLibrary';
import { useImageUpload } from '../../hooks/useImageUpload';
import { ConfirmDialog } from '../ui/Modal';
import type { MediaItem } from '../../types';

interface ImageLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

type TabKey = 'all' | 'editor-bg' | 'specials' | 'events' | 'root';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'editor-bg', label: 'Backgrounds' },
  { key: 'specials', label: 'Specials' },
  { key: 'events', label: 'Events' },
  { key: 'root', label: 'Bar Photos' },
];

export function ImageLibrary({ open, onClose, onSelect }: ImageLibraryProps) {
  const { items, loading, refresh, deleteItem } = useMediaLibrary();
  const { upload, uploading } = useImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);

  if (!open) return null;

  const filtered = items.filter((item) => {
    if (tab !== 'all') {
      if (tab === 'root') {
        if (item.folder !== '') return false;
      } else {
        if (item.folder !== tab) return false;
      }
    }
    if (search) {
      return item.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, 'editor-bg');
    if (url) {
      refresh();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelect = (url: string) => {
    onSelect(url);
    onClose();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative ml-auto w-full max-w-xl bg-surface border-l border-border h-full flex flex-col shadow-modal animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <FolderOpen size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Image Library</h2>
            <span className="text-xs text-text-muted">{items.length} images</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refresh()} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted" title="Refresh">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search + Upload */}
        <div className="px-5 py-3 border-b border-border space-y-3 shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search images..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary text-xs py-2 px-3"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  tab === t.key
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Image size={40} className="mx-auto text-text-muted mb-3" />
              <p className="text-sm text-text-muted">No images found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((item) => (
                <div
                  key={`${item.folder}/${item.name}`}
                  className="group relative rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all cursor-pointer"
                >
                  <div
                    onClick={() => handleSelect(item.url)}
                    className="aspect-square bg-surface-hover"
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors pointer-events-none" />

                  {/* Actions */}
                  <div className="absolute top-1.5 right-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                      className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-danger/80 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none">
                    <p className="text-[10px] text-white truncate">{item.name}</p>
                    <p className="text-[9px] text-white/60">{formatSize(item.size)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteItem(deleteTarget); }}
        title="Delete Image"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
