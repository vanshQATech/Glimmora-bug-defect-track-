import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Plus, FolderKanban, Bug, Users, X, Search, Trash2 } from 'lucide-react';

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const fetchProjects = () => {
    api.get('/projects').then(res => setProjects(res.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', form);
      setForm({ name: '', description: '' });
      setShowCreate(false);
      fetchProjects();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create project');
    }
  };

  const canCreate = ['Admin', 'Project Manager'].includes(user?.role);
  const canDelete = user?.role === 'Admin';

  const handleDelete = async (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = window.confirm(
      `Delete project "${project.name}"?\n\nThis will permanently remove all bugs, tasks, members, comments, and attachments for this project. This cannot be undone.`
    );
    if (!ok) return;
    try {
      await api.delete(`/projects/${project.id}`);
      fetchProjects();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete project');
    }
  };
  const filtered = projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

  const gradients = [
    'from-brand-500 to-brand-700',
    'from-indigo-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-sky-500 to-blue-600',
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="text-ink-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''} in your workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="input pl-10 w-64"
            />
          </div>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> New Project
            </button>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowCreate(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={handleCreate} className="card p-6 w-full max-w-md space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">Create Project</h2>
                <p className="text-sm text-ink-500">Start tracking bugs and tasks</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="text-ink-400 hover:text-ink-900"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="label">Project Name</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input" placeholder="e.g. Apollo Mobile" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="input" placeholder="What is this project about?" />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Create Project</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({length: 6}).map((_, i) => <div key={i} className="skeleton h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-brand-50 mb-4">
            <FolderKanban className="w-8 h-8 text-brand-600" />
          </div>
          <p className="text-ink-700 font-semibold mb-1">{query ? 'No projects match your search' : 'No projects yet'}</p>
          <p className="text-ink-500 text-sm">{canCreate ? 'Create your first project to get started.' : 'Ask an admin to add you to a project.'}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p, i) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="card card-hover p-5 group relative overflow-hidden">
              <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full bg-gradient-to-br ${gradients[i % gradients.length]} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />
              {canDelete && (
                <button
                  onClick={(e) => handleDelete(e, p)}
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center shadow-card`}>
                    <FolderKanban className="w-5 h-5 text-white" />
                  </div>
                  <span className={`chip ${p.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-ink-100 text-ink-600 border-ink-200'}`}>
                    {p.status}
                  </span>
                </div>
                <h3 className="font-semibold text-ink-900 text-lg tracking-tight mb-1">{p.name}</h3>
                {p.description && <p className="text-sm text-ink-500 line-clamp-2 mb-4">{p.description}</p>}
                <div className="flex items-center gap-4 pt-3 border-t border-ink-100 text-xs text-ink-500">
                  <span className="flex items-center gap-1.5"><Bug className="w-3.5 h-3.5" /> <span className="font-semibold text-ink-800">{p.bug_count || 0}</span> bugs</span>
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> <span className="font-semibold text-ink-800">{p.member_count || 0}</span></span>
                  {p.open_bugs > 0 && <span className="ml-auto chip bg-red-50 text-red-700 border-red-200">{p.open_bugs} open</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
