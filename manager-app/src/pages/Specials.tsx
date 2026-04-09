import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, Sparkles, Image, Palette, FileEdit } from 'lucide-react';
import { useSupabaseCRUD } from '../hooks/useSupabaseCRUD';
import { ConfirmDialog } from '../components/ui/Modal';
import { getAllDrafts, clearDraftByKey } from '../hooks/useDraftPersistence';
import type { Special, DraftState } from '../types';

export function Specials() {
  const { data: specials, loading, update, remove } = useSupabaseCRUD<Special>('specials');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [drafts, setDrafts] = useState<DraftState[]>([]);

  useEffect(() => {
    setDrafts(getAllDrafts());
  }, []);

  const typeBadge = (type: string) => {
    switch (type) {
      case 'drink': return 'badge-primary';
      case 'food': return 'badge-accent';
      case 'seasonal': return 'badge-success';
      default: return 'badge-primary';
    }
  };

  const handleDiscardDraft = (draft: DraftState) => {
    clearDraftByKey(draft.specialId);
    setDrafts(getAllDrafts());
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Specials</h1>
          <p className="text-sm text-text-muted mt-1">{specials.length} total specials</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTemplates(!showTemplates)} className="btn-secondary">
            <Palette size={18} /> Templates
          </button>
          <Link to="/specials/editor" className="btn-primary">
            <Plus size={18} /> New Special
          </Link>
        </div>
      </div>

      {/* Drafts Section */}
      {drafts.length > 0 && (
        <div className="card p-5 mb-6 border-amber-500/30">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <FileEdit size={16} className="text-amber-500" />
            Unsaved Drafts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {drafts.map((draft, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-hover border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {draft.saveForm.title || 'Untitled Draft'}
                  </p>
                  <p className="text-xs text-text-muted">{formatTimeAgo(draft.updatedAt)}</p>
                </div>
                <Link
                  to={draft.specialId ? `/specials/editor/${draft.specialId}` : '/specials/editor'}
                  className="text-xs font-medium text-primary hover:text-primary-hover px-3 py-2 min-h-[44px] flex items-center rounded-lg hover:bg-primary-50"
                >
                  Continue
                </Link>
                <button
                  onClick={() => handleDiscardDraft(draft)}
                  className="text-xs text-text-muted hover:text-danger px-3 py-2 min-h-[44px] flex items-center rounded-lg hover:bg-surface-hover"
                >
                  Discard
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template Quick Pick */}
      {showTemplates && (
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Quick Start with a Template</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { id: 'happy-hour', name: 'Happy Hour', color: 'from-amber-500 to-orange-600' },
              { id: 'dj-night', name: 'DJ Night', color: 'from-purple-600 to-blue-600' },
              { id: 'holiday', name: 'Holiday Special', color: 'from-red-600 to-green-600' },
              { id: 'drink', name: 'Drink Special', color: 'from-teal-500 to-cyan-500' },
              { id: 'food', name: 'Food Special', color: 'from-orange-500 to-red-500' },
              { id: 'sunset-sessions', name: 'Sunset Sessions', color: 'from-amber-500 to-rose-700' },
            ].map((tmpl) => (
              <Link
                key={tmpl.id}
                to={`/specials/editor?template=${tmpl.id}`}
                className="group rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all hover:shadow-card-hover"
              >
                <div className={`h-24 bg-gradient-to-br ${tmpl.color} flex items-center justify-center`}>
                  <span className="text-white font-bold text-sm opacity-80 group-hover:opacity-100 transition-opacity">{tmpl.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-40 bg-surface-hover rounded-lg mb-3" />
              <div className="h-5 bg-surface-hover rounded w-2/3 mb-2" />
              <div className="h-4 bg-surface-hover rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : specials.length === 0 ? (
        <div className="card p-12 text-center">
          <Sparkles size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No specials yet</p>
          <p className="text-sm text-text-muted mt-1">Create your first special or start from a template</p>
          <Link to="/specials/editor" className="btn-primary mt-4 inline-flex">
            <Plus size={18} /> Create Special
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {specials.map((special) => (
            <div key={special.id} className="card-hover overflow-hidden">
              {special.image_url ? (
                <img src={special.image_url} alt={special.title} className="w-full h-44 object-cover" />
              ) : (
                <div className="w-full h-44 bg-gradient-to-br from-surface-hover to-surface-active flex items-center justify-center">
                  <Image size={32} className="text-text-muted" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-text-primary truncate">{special.title}</h3>
                    <p className="text-sm text-text-muted line-clamp-2 mt-1">{special.description}</p>
                  </div>
                  <span className={typeBadge(special.type)}>{special.type}</span>
                </div>
                {special.price && <p className="text-primary font-semibold mt-2">{special.price}</p>}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => update(special.id, { active: !special.active })}
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      special.active ? 'bg-success-light text-green-700' : 'bg-surface-hover text-text-muted'
                    }`}
                  >
                    {special.active ? 'Active' : 'Inactive'}
                  </button>
                  <div className="flex gap-1">
                    <Link to={`/specials/editor/${special.id}`} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary transition-colors">
                      <Edit2 size={14} />
                    </Link>
                    <button onClick={() => setDeleteId(special.id)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-danger transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId); }}
        title="Delete Special"
        message="Are you sure you want to delete this special?"
        confirmLabel="Delete"
      />
    </div>
  );
}
