import { useState, useRef } from 'react';
import { Upload, Trash2, Search, Loader2, RefreshCw, ExternalLink, Copy } from 'lucide-react';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import { useImageUpload } from '../hooks/useImageUpload';
import { ConfirmDialog } from '../components/ui/Modal';
import toast from 'react-hot-toast';
import type { MediaItem } from '../types';

type TabKey = 'all' | 'editor-bg' | 'specials' | 'events' | 'root';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'editor-bg', label: 'Backgrounds' },
  { key: 'specials', label: 'Specials' },
  { key: 'events', label: 'Events' },
  { key: 'root', label: 'Bar Photos' },
];

export function MediaLibraryPage() {
  const { items, loading, refresh, deleteItem } = useMediaLibrary();
  const { upload, uploading } = useImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const filtered = items.filter((item) => {
    if (tab !== 'all') {
      if (tab === 'root') {
        if (item.folder !== '') return false;
      } else {
        if (item.folder !== tab) return false;
      }
    }
    if (search) return item.name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await upload(file, 'editor-bg');
    }
    refresh();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied!');
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatFilename = (name: string) => {
    // Strip leading timestamp prefix (e.g. "1773961532357-") and decode
    const stripped = name.replace(/^\d{10,}-/, '');
    // Remove file extension for display
    const noExt = stripped.replace(/\.\w+$/, '');
    return decodeURIComponent(noExt) || name;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Media Library</h1>
          <p className="text-sm text-text-muted mt-1">{items.length} images</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refresh()} className="btn-secondary" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-primary" disabled={uploading}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Upload
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Search + Tabs */}
      <div className="card p-4 mb-6 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search images..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="aspect-square bg-surface-hover" />
              <div className="px-3 py-2">
                <div className="h-3 bg-surface-hover rounded w-2/3 mb-1.5" />
                <div className="h-2.5 bg-surface-hover rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-muted">No images found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((item) => {
            const cardKey = `${item.folder}/${item.name}`;
            const isActive = activeCard === cardKey;
            return (
            <div key={cardKey} className="group card-hover overflow-hidden">
              <div
                className="aspect-square bg-surface-hover relative"
                onClick={() => setActiveCard(isActive ? null : cardKey)}
              >
                <img src={item.url} alt={formatFilename(item.name)} className="w-full h-full object-cover" loading="lazy" />
                <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 ${isActive ? '!bg-black/40 !opacity-100' : ''}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyUrl(item.url); }}
                    className="p-2 rounded-lg bg-black/60 text-white hover:bg-primary transition-colors"
                    aria-label="Copy URL"
                  >
                    <Copy size={14} />
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg bg-black/60 text-white hover:bg-primary transition-colors"
                    aria-label="Open in new tab"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                    className="p-2 rounded-lg bg-black/60 text-white hover:bg-danger transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="px-3 py-2">
                <p className="text-xs text-text-primary truncate" title={item.name}>{formatFilename(item.name)}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-text-muted">{item.folder || 'root'}</span>
                  <span className="text-[10px] text-text-muted">{formatSize(item.size)}</span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

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
