import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import StatusChip, { PriorityChip } from '../components/StatusChip';
import { Bug, CheckSquare } from 'lucide-react';

export default function MyWork() {
  const [bugs, setBugs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState('bugs');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/bugs/my/assigned'), api.get('/tasks/my/assigned')])
      .then(([b, t]) => { setBugs(b.data); setTasks(t.data); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-4 max-w-[1400px] mx-auto"><div className="skeleton h-20" /><div className="skeleton h-64" /></div>;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="page-title">My Work</h1>
        <p className="text-ink-500 mt-1">Bugs and tasks assigned to you</p>
      </div>

      <div className="flex items-center gap-1 p-1 bg-white border border-ink-100 rounded-xl w-fit shadow-card">
        {[
          { id: 'bugs', label: 'Bugs', icon: Bug, count: bugs.length },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: tasks.length },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-brand-gradient text-white shadow-card' : 'text-ink-600 hover:bg-ink-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-ink-100'}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === 'bugs' && (
        <div className="card overflow-hidden">
          {bugs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-brand-50 mb-3"><Bug className="w-7 h-7 text-brand-600" /></div>
              <p className="text-ink-700 font-medium">No bugs assigned to you</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {bugs.map(b => (
                <Link key={b.id} to={`/bugs/${b.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/50 transition-colors">
                  <span className="text-[11px] font-mono font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded-md border border-brand-100">#{b.bug_number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{b.summary}</p>
                    <p className="text-xs text-ink-500">{b.project_name} · {b.reporter_name}</p>
                  </div>
                  <PriorityChip priority={b.priority} />
                  <StatusChip status={b.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="card overflow-hidden">
          {tasks.length === 0 ? (
            <div className="py-16 text-center">
              <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-brand-50 mb-3"><CheckSquare className="w-7 h-7 text-brand-600" /></div>
              <p className="text-ink-700 font-medium">No tasks assigned to you</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {tasks.map(t => (
                <Link key={t.id} to={`/tasks/${t.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{t.title}</p>
                    <p className="text-xs text-ink-500">{t.project_name} · {t.due_date ? `Due ${t.due_date}` : 'No due date'}</p>
                  </div>
                  <PriorityChip priority={t.priority} />
                  <StatusChip status={t.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
