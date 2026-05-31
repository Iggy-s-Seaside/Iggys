import { Link } from 'react-router-dom';
import { Square } from 'lucide-react';
import type { Todo } from '../../types';

interface TodoWidgetProps {
  todos: Todo[];
  loading?: boolean;
  onToggle: (id: number, done: boolean) => void;
}

export function TodoWidget({ todos, loading, onToggle }: TodoWidgetProps) {
  const open = todos.filter((t) => !t.done);
  const preview = open.slice(0, 5);

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-text-primary">To-Do</h2>
          {open.length > 0 && (
            <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{open.length}</span>
          )}
        </div>
        <Link to="/todos" className="text-sm text-primary hover:text-primary-hover">View all</Link>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-5 h-5 bg-surface-hover rounded" />
              <div className="h-4 bg-surface-hover rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : preview.length === 0 ? (
        <div className="p-8 text-center text-text-muted text-sm">All caught up 🎉</div>
      ) : (
        <div className="divide-y divide-border">
          {preview.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3">
              <button onClick={() => onToggle(t.id, true)} className="text-text-muted hover:text-primary transition-colors shrink-0" aria-label="Mark done">
                <Square size={18} />
              </button>
              <p className="text-sm text-text-primary truncate flex-1">{t.title}</p>
              {t.priority === 'high' && <span className="text-xs text-danger font-medium shrink-0">high</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
