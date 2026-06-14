import { useState } from 'react';
import { Plus, Trash2, CheckSquare, Square, Loader2, Flag } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { useTodos } from '../hooks/useTodos';
import { ErrorState } from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import Select from '../components/ui/Select';
import { TODO_PRIORITIES, type Todo, type TodoPriority } from '../types';

const PRIORITY_LABELS: Record<TodoPriority, string> = { low: 'Low', normal: 'Normal', high: 'High' };

const PRIORITY_STYLE: Record<TodoPriority, string> = {
  high: 'text-danger',
  normal: 'text-primary',
  low: 'text-text-muted',
};

function fmtDue(d: string | null) {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d'); } catch { return d; }
}
function isOverdue(t: Todo) {
  if (t.done || !t.due_date) return false;
  try { return isPast(parseISO(t.due_date + 'T23:59:59')); } catch { return false; }
}

export function Todos() {
  const { todos, loading, error, refresh, add, toggle, update, remove } = useTodos();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    const ok = await add({
      title: title.trim(),
      details: details.trim() || null,
      priority,
      due_date: dueDate || null,
      created_by: user?.email ?? null,
    });
    setAdding(false);
    if (ok) {
      setTitle('');
      setDetails('');
      setPriority('normal');
      setDueDate('');
    }
  };

  const openCount = todos.filter((t) => !t.done).length;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">To-Do</h1>
        <p className="text-sm text-text-muted mt-1">
          Shared task list{openCount > 0 ? ` — ${openCount} open` : ''}
        </p>
      </div>

      {/* Add task */}
      <form onSubmit={handleAdd} className="card p-4 mb-5 space-y-3">
        <input className="input-field" placeholder="What needs doing?" value={title}
          onChange={(e) => setTitle(e.target.value)} />
        <input className="input-field" placeholder="Details (optional)" value={details}
          onChange={(e) => setDetails(e.target.value)} />
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Priority</label>
            <Select<TodoPriority>
              variant="manager"
              leadingIcon={Flag}
              value={priority}
              onChange={setPriority}
              options={TODO_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
            />
          </div>
          <div>
            <label className="label">Due</label>
            <input type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex-1" />
          <button type="submit" disabled={adding || !title.trim()} className="btn-primary">
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />} Add task
          </button>
        </div>
      </form>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse h-14" />)}</div>
      ) : error && todos.length === 0 ? (
        <ErrorState onRetry={refresh} description="We couldn't load the task list. Your tasks are safe." />
      ) : todos.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckSquare size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">Nothing on the list</p>
          <p className="text-sm text-text-muted mt-1">Add a task above to get started.</p>
        </div>
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {todos.map((t) => (
            <div key={t.id} className="flex items-start gap-3 px-4 sm:px-5 py-3">
              <button onClick={() => toggle(t.id, !t.done)} className="mt-0.5 text-text-muted hover:text-primary transition-colors shrink-0" aria-label={t.done ? 'Mark not done' : 'Mark done'}>
                {t.done ? <CheckSquare size={20} className="text-primary" /> : <Square size={20} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${t.done ? 'line-through text-text-muted' : 'text-text-primary font-medium'}`}>{t.title}</p>
                {t.details && <p className="text-xs text-text-muted mt-0.5 whitespace-pre-wrap">{t.details}</p>}
                <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs">
                  {!t.done && (
                    <span className={`flex items-center gap-1 ${PRIORITY_STYLE[t.priority]}`}>
                      <Flag size={11} /> {t.priority}
                    </span>
                  )}
                  {t.due_date && (
                    <span className={isOverdue(t) ? 'text-danger font-medium' : 'text-text-muted'}>
                      Due {fmtDue(t.due_date)}{isOverdue(t) ? ' (overdue)' : ''}
                    </span>
                  )}
                  {t.created_by && <span className="text-text-muted">by {t.created_by.split('@')[0]}</span>}
                </div>
              </div>
              {!t.done && (
                <select
                  value={t.priority}
                  onChange={(e) => update(t.id, { priority: e.target.value as TodoPriority })}
                  className="text-xs bg-transparent border border-border rounded-md px-1.5 py-1 text-text-secondary shrink-0 hidden sm:block"
                  aria-label="Change priority"
                >
                  {TODO_PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
                </select>
              )}
              <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-danger transition-colors shrink-0" aria-label="Delete task">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
