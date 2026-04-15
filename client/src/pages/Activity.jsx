import { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Activity as ActivityIcon, Users, ClipboardList, AlertTriangle, CheckCircle2, Clock, Filter, Plus, Trash2 } from 'lucide-react';

const STATUSES = ['Completed', 'In Progress', 'Blocked'];
const LEAD_ROLES = ['Admin', 'Project Manager', 'Team Lead'];

const todayStr = () => new Date().toISOString().slice(0, 10);

const statusClass = (s) => {
  if (s === 'Completed') return 'bg-green-100 text-green-700';
  if (s === 'Blocked') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
};

function EmptyField({ label }) {
  return <span className="text-ink-300 italic">— {label} —</span>;
}

function StatCard({ icon: Icon, label, value, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white border border-ink-100 rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">{label}</div>
          <div className="text-2xl font-bold text-ink-900">{value}</div>
        </div>
      </div>
    </div>
  );
}

function DailyForm({ projects, onSaved }) {
  const blank = {
    project_id: '',
    update_date: todayStr(),
    module: '',
    tasks_completed: '',
    tasks_in_progress: '',
    tasks_planned: '',
    bugs_worked: '',
    bugs_fixed: '',
    bugs_raised: '',
    blockers: '',
    dependencies: '',
    status: 'In Progress',
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.post('/activity', form);
      setMsg({ type: 'ok', text: 'Update submitted successfully.' });
      setForm({ ...blank, project_id: form.project_id });
      onSaved?.();
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Failed to submit update' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-ink-100 rounded-xl p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink-900 flex items-center gap-2"><Plus className="w-4 h-4 text-brand-600" /> New daily update</h3>
        <span className="text-xs text-ink-400">Date: {form.update_date}</span>
      </div>

      {msg && (
        <div className={`text-sm px-3 py-2 rounded-lg ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-ink-500">Project</label>
          <select value={form.project_id} onChange={e => set('project_id', e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg bg-white text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none">
            <option value="">— Select project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-500">Module / Feature</label>
          <input type="text" value={form.module} onChange={e => set('module', e.target.value)}
            placeholder="e.g. Authentication"
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-500">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg bg-white text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-ink-500">Tasks completed today</label>
          <textarea value={form.tasks_completed} onChange={e => set('tasks_completed', e.target.value)} rows={3}
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-500">Tasks in progress</label>
          <textarea value={form.tasks_in_progress} onChange={e => set('tasks_in_progress', e.target.value)} rows={3}
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-500">Planned for tomorrow</label>
          <textarea value={form.tasks_planned} onChange={e => set('tasks_planned', e.target.value)} rows={3}
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-ink-500">Bugs worked on (IDs)</label>
          <input type="text" value={form.bugs_worked} onChange={e => set('bugs_worked', e.target.value)}
            placeholder="#12, #34"
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-500">Bugs fixed</label>
          <input type="text" value={form.bugs_fixed} onChange={e => set('bugs_fixed', e.target.value)}
            placeholder="#12"
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-500">Bugs raised</label>
          <input type="text" value={form.bugs_raised} onChange={e => set('bugs_raised', e.target.value)}
            placeholder="#56"
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-ink-500">Blockers / Issues</label>
          <textarea value={form.blockers} onChange={e => set('blockers', e.target.value)} rows={2}
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-500">Dependencies</label>
          <textarea value={form.dependencies} onChange={e => set('dependencies', e.target.value)} rows={2}
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-brand-gradient text-white text-sm font-semibold shadow-card hover:shadow-pop disabled:opacity-60">
          {saving ? 'Submitting…' : 'Submit update'}
        </button>
      </div>
    </form>
  );
}

function UpdateRow({ row, onDelete, showEmployee }) {
  return (
    <div className="bg-white border border-ink-100 rounded-xl p-4 shadow-card">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono text-ink-500">{row.update_date}</span>
          {showEmployee && <span className="text-sm font-semibold text-ink-900">{row.employee_name}</span>}
          {row.project_name && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium">{row.project_name}</span>}
          {row.module && <span className="text-xs text-ink-500">· {row.module}</span>}
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusClass(row.status)}`}>{row.status}</span>
        </div>
        {onDelete && (
          <button onClick={() => onDelete(row.id)} className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Completed</div>
          <div className="whitespace-pre-wrap text-ink-700">{row.tasks_completed || <EmptyField label="none" />}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1">In progress</div>
          <div className="whitespace-pre-wrap text-ink-700">{row.tasks_in_progress || <EmptyField label="none" />}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Planned</div>
          <div className="whitespace-pre-wrap text-ink-700">{row.tasks_planned || <EmptyField label="none" />}</div>
        </div>
      </div>
      {(row.bugs_worked || row.bugs_fixed || row.bugs_raised) && (
        <div className="flex gap-4 mt-3 text-xs text-ink-600 flex-wrap">
          {row.bugs_worked && <span><span className="text-ink-400">Worked:</span> {row.bugs_worked}</span>}
          {row.bugs_fixed && <span><span className="text-ink-400">Fixed:</span> {row.bugs_fixed}</span>}
          {row.bugs_raised && <span><span className="text-ink-400">Raised:</span> {row.bugs_raised}</span>}
        </div>
      )}
      {(row.blockers || row.dependencies) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm">
          {row.blockers && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-2">
              <div className="text-[10px] uppercase tracking-wider text-red-500 font-semibold mb-0.5">Blockers</div>
              <div className="whitespace-pre-wrap text-red-800">{row.blockers}</div>
            </div>
          )}
          {row.dependencies && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-2">
              <div className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold mb-0.5">Dependencies</div>
              <div className="whitespace-pre-wrap text-amber-800">{row.dependencies}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  const { user } = useAuth();
  const isLead = LEAD_ROLES.includes(user?.role);

  const [tab, setTab] = useState('mine');
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [myUpdates, setMyUpdates] = useState([]);
  const [teamUpdates, setTeamUpdates] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({ from: '', to: '', user_id: '', project_id: '', status: '' });

  const loadProjects = () => api.get('/projects').then(r => setProjects(r.data || [])).catch(() => {});
  const loadUsers = () => api.get('/users').then(r => setUsers(r.data || [])).catch(() => {});
  const loadMine = () => api.get('/activity/my').then(r => setMyUpdates(r.data || [])).catch(() => {});
  const loadSummary = () => api.get('/activity/summary').then(r => setSummary(r.data)).catch(() => {});

  const loadTeam = () => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) qs.append(k, v); });
    return api.get(`/activity/team?${qs.toString()}`).then(r => setTeamUpdates(r.data || [])).catch(() => {});
  };

  useEffect(() => {
    const jobs = [loadProjects(), loadMine()];
    if (isLead) jobs.push(loadUsers(), loadSummary(), loadTeam());
    Promise.all(jobs).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLead && tab === 'team') loadTeam();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this update?')) return;
    await api.delete(`/activity/${id}`);
    loadMine();
    if (isLead) { loadTeam(); loadSummary(); }
  };

  const afterSave = () => {
    loadMine();
    if (isLead) { loadTeam(); loadSummary(); }
  };

  const tabs = useMemo(() => {
    const t = [{ id: 'mine', label: 'My updates', icon: ClipboardList }];
    if (isLead) t.push({ id: 'team', label: 'Team dashboard', icon: Users });
    return t;
  }, [isLead]);

  if (loading) return <div className="space-y-4 max-w-[1400px] mx-auto"><div className="skeleton h-20" /><div className="skeleton h-64" /></div>;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="page-title flex items-center gap-2"><ActivityIcon className="w-6 h-6 text-brand-600" /> Activity Tracker</h1>
        <p className="text-ink-500 mt-1">Daily updates, progress and blockers</p>
      </div>

      <div className="flex items-center gap-1 p-1 bg-white border border-ink-100 rounded-xl w-fit shadow-card">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-brand-gradient text-white shadow-card' : 'text-ink-600 hover:bg-ink-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'mine' && (
        <div className="space-y-6">
          <DailyForm projects={projects} onSaved={afterSave} />

          <div>
            <h3 className="text-sm font-semibold text-ink-700 mb-3">My recent updates</h3>
            {myUpdates.length === 0 ? (
              <div className="bg-white border border-dashed border-ink-200 rounded-xl p-8 text-center text-sm text-ink-400">
                You haven't submitted any updates yet.
              </div>
            ) : (
              <div className="space-y-3">
                {myUpdates.map(u => <UpdateRow key={u.id} row={u} onDelete={handleDelete} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'team' && isLead && (
        <div className="space-y-6">
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={CheckCircle2} label="Submitted today" value={`${summary.submitted_today} / ${summary.total_active_users}`} tone="green" />
              <StatCard icon={Clock} label="Pending" value={summary.pending_count} tone="amber" />
              <StatCard icon={AlertTriangle} label="Blocked today" value={summary.blocked_today} tone="red" />
              <StatCard icon={CheckCircle2} label="Completed today" value={summary.completed_today} tone="brand" />
            </div>
          )}

          {summary?.pending_users?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Pending submissions today</div>
              <div className="flex flex-wrap gap-2">
                {summary.pending_users.map(u => (
                  <span key={u.id} className="text-xs bg-white border border-amber-200 text-amber-800 px-2 py-1 rounded-full">
                    {u.name} <span className="text-amber-500">· {u.role}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-ink-100 rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-ink-500" />
              <span className="text-sm font-semibold text-ink-700">Filters</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] text-ink-500">From</label>
                <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-ink-100 rounded-lg" />
              </div>
              <div>
                <label className="text-[11px] text-ink-500">To</label>
                <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-ink-100 rounded-lg" />
              </div>
              <div>
                <label className="text-[11px] text-ink-500">Employee</label>
                <select value={filters.user_id} onChange={e => setFilters(f => ({ ...f, user_id: e.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-ink-100 rounded-lg bg-white">
                  <option value="">All</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-ink-500">Project</label>
                <select value={filters.project_id} onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-ink-100 rounded-lg bg-white">
                  <option value="">All</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-ink-500">Status</label>
                <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-ink-100 rounded-lg bg-white">
                  <option value="">All</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-ink-100 rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-700">Team updates</span>
              <span className="text-xs text-ink-400">{teamUpdates.length} entries</span>
            </div>
            {teamUpdates.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-400">No updates match your filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 text-ink-500 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">Employee</th>
                      <th className="text-left px-4 py-2">Project</th>
                      <th className="text-left px-4 py-2">Status</th>
                      <th className="text-left px-4 py-2">Blockers</th>
                      <th className="text-left px-4 py-2">Last Update</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamUpdates.map(u => (
                      <tr key={u.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                        <td className="px-4 py-2 font-mono text-xs text-ink-600">{u.update_date}</td>
                        <td className="px-4 py-2 font-medium text-ink-900">{u.employee_name}</td>
                        <td className="px-4 py-2 text-ink-600">{u.project_name || '—'}</td>
                        <td className="px-4 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusClass(u.status)}`}>{u.status}</span></td>
                        <td className="px-4 py-2 text-ink-600 max-w-[240px] truncate" title={u.blockers || ''}>{u.blockers || '—'}</td>
                        <td className="px-4 py-2 text-ink-500 text-xs">{new Date(u.updated_at || u.created_at).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => handleDelete(u.id)} className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink-700 mb-3">Full entries</h3>
            <div className="space-y-3">
              {teamUpdates.map(u => <UpdateRow key={u.id} row={u} showEmployee onDelete={handleDelete} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
