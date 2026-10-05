import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { TOOL_GROUPS } from '../lib/appNavigation';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';

export function Tools() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const { role } = useAuth();
  const group = TOOL_GROUPS.find((g) => g.id === params.get('section'));
  const tools = (group ? group.tools : TOOL_GROUPS.flatMap((g) => g.tools))
    .filter((t) => !t.ownerOnly || role === 'owner')
    .filter((t) => `${t.title} ${t.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="max-w-4xl mx-auto">
    <PageHeader title={group?.title || 'What do you need to do?'} subtitle={group?.description || 'Choose a task. The everyday things are always in the main navigation.'} />
    {group && <button className="btn-secondary mb-5" onClick={() => { setParams({}); setSearch(''); }}><ArrowLeft size={18} /> All tasks</button>}
    <label className="block mb-6">
      <span className="sr-only">Find a task</span>
      <div className="relative"><Search size={20} className="absolute left-4 top-3.5 text-text-muted" /><input type="search" className="input-field pl-12 min-h-[48px]" placeholder="Find a task, such as stock or invoices" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    </label>
    {!group && !search ? <div className="task-directory grid sm:grid-cols-2 gap-4">
      {TOOL_GROUPS.map((g) => <button key={g.id} onClick={() => setParams({ section: g.id })} className="card-hover p-6 text-left flex items-center gap-4 min-h-[120px]">
        <span className="flex-1"><span className="block text-lg font-semibold">{g.title}</span><span className="block text-sm text-text-secondary mt-2">{g.description}</span></span><ChevronRight size={22} className="text-primary" />
      </button>)}
    </div> : <div className="space-y-3">
      {tools.map((t) => <Link key={t.to} to={t.to} className="card-hover p-5 flex items-center gap-4 min-h-[88px]"><span className="flex-1"><span className="block font-semibold">{t.title}</span><span className="block text-sm text-text-secondary mt-1">{t.description}</span></span><ChevronRight size={20} className="text-primary" /></Link>)}
      {!tools.length && <p className="card p-6 text-text-secondary">No matching task. Try “booking”, “menu” or “staff”.</p>}
    </div>}
  </div>;
}
