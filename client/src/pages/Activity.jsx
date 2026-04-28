import { useState, useEffect, useMemo } from 'react';
import api, { API_BASE } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Activity as ActivityIcon, Users, ClipboardList, AlertTriangle, CheckCircle2, Clock, Filter, Plus, Trash2, Download, BarChart3, PieChart as PieIcon, LineChart as LineIcon, FileText } from 'lucide-react';

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
    title: '',
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
    progress_percent: 0,
    remarks: '',
    next_action: '',
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
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-ink-500">Task title</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="Short headline for today's work"
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-500">Progress %</label>
          <div className="mt-1 flex items-center gap-3">
            <input type="range" min="0" max="100" step="5" value={form.progress_percent}
              onChange={e => set('progress_percent', Number(e.target.value))}
              className="flex-1 accent-brand-600" />
            <span className="text-sm font-semibold text-ink-700 w-12 text-right">{form.progress_percent}%</span>
          </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-ink-500">Remarks</label>
          <textarea value={form.remarks} onChange={e => set('remarks', e.target.value)} rows={2}
            placeholder="Anything noteworthy about today's work"
            className="mt-1 w-full px-3 py-2 border border-ink-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-300 outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-500">Next action</label>
          <textarea value={form.next_action} onChange={e => set('next_action', e.target.value)} rows={2}
            placeholder="What you'll do next"
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

function ProgressBar({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden">
        <div className="h-full bg-brand-gradient" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-ink-600 w-9 text-right font-mono">{pct}%</span>
    </div>
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
      {row.title && <div className="mt-2 text-sm font-semibold text-ink-900">{row.title}</div>}
      <div className="mt-2"><ProgressBar value={row.progress_percent} /></div>
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
      {(row.remarks || row.next_action) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm">
          {row.remarks && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-0.5">Remarks</div>
              <div className="whitespace-pre-wrap text-ink-700">{row.remarks}</div>
            </div>
          )}
          {row.next_action && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-0.5">Next action</div>
              <div className="whitespace-pre-wrap text-ink-700">{row.next_action}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CHART_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];

function BarChart({ data, valueLabel = 'count', max }) {
  if (!data || data.length === 0) return <div className="text-sm text-ink-400 italic">No data</div>;
  const peak = max ?? Math.max(...data.map(d => Number(d.value) || 0), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const v = Number(d.value) || 0;
        const w = (v / peak) * 100;
        return (
          <div key={`${d.label}-${i}`} className="flex items-center gap-3 text-xs">
            <div className="w-32 truncate text-ink-700" title={d.label}>{d.label}</div>
            <div className="flex-1 h-5 bg-ink-50 rounded relative overflow-hidden">
              <div className="h-full rounded transition-all" style={{ width: `${w}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
            </div>
            <div className="w-14 text-right font-mono text-ink-700">{v}{valueLabel === 'pct' ? '%' : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

function PieChart({ data }) {
  if (!data || data.length === 0) return <div className="text-sm text-ink-400 italic">No data</div>;
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
  const size = 160;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  let offset = 0;
  const slices = data.map((d, i) => {
    const v = Number(d.value) || 0;
    const frac = v / total;
    const start = offset;
    const end = offset + frac;
    offset = end;
    const a0 = start * 2 * Math.PI - Math.PI / 2;
    const a1 = end * 2 * Math.PI - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    const path = frac >= 1
      ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
      : `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
    return { path, color: CHART_COLORS[i % CHART_COLORS.length], label: d.label, value: v, pct: Math.round(frac * 100) };
  });
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1" />)}
      </svg>
      <div className="space-y-1 text-xs">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: s.color }} />
            <span className="text-ink-700">{s.label}</span>
            <span className="text-ink-400 font-mono">· {s.value} ({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data }) {
  if (!data || data.length === 0) return <div className="text-sm text-ink-400 italic">No data</div>;
  const w = 520;
  const h = 180;
  const pad = { top: 12, right: 12, bottom: 28, left: 32 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const peak = Math.max(...data.map(d => Math.max(Number(d.value) || 0, Number(d.completed) || 0)), 1);
  const x = (i) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => pad.top + innerH - (v / peak) * innerH;
  const buildPath = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(Number(d[key]) || 0).toFixed(1)}`).join(' ');
  const totalPath = buildPath('value');
  const completedPath = buildPath('completed');
  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-ink-400">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const yy = pad.top + innerH - t * innerH;
          return (
            <g key={i}>
              <line x1={pad.left} x2={w - pad.right} y1={yy} y2={yy} stroke="#eef0f4" />
              <text x={pad.left - 6} y={yy + 3} fontSize="9" textAnchor="end" fill="currentColor">{Math.round(peak * t)}</text>
            </g>
          );
        })}
        <path d={totalPath} fill="none" stroke="#7c3aed" strokeWidth="2" />
        <path d={completedPath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 3" />
        {data.map((d, i) => (
          <g key={`pt-${i}`}>
            <circle cx={x(i)} cy={y(Number(d.value) || 0)} r="3" fill="#7c3aed" />
            <circle cx={x(i)} cy={y(Number(d.completed) || 0)} r="3" fill="#10b981" />
            {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0) && (
              <text x={x(i)} y={h - 8} fontSize="9" textAnchor="middle" fill="currentColor">{String(d.label).slice(5)}</text>
            )}
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-4 text-xs text-ink-600 mt-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-brand-600 inline-block" /> Total updates</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-green-500 inline-block" style={{ borderTop: '2px dashed #10b981' }} /> Completed</span>
      </div>
    </div>
  );
}

function ChartCard({ icon: Icon, title, children }) {
  return (
    <div className="bg-white border border-ink-100 rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      </div>
      {children}
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
  const [charts, setCharts] = useState(null);

  const loadProjects = () => api.get('/projects').then(r => setProjects(r.data || [])).catch(() => {});
  const loadUsers = () => api.get('/users').then(r => setUsers(r.data || [])).catch(() => {});
  const loadMine = () => api.get('/activity/my').then(r => setMyUpdates(r.data || [])).catch(() => {});
  const loadSummary = () => api.get('/activity/summary').then(r => setSummary(r.data)).catch(() => {});

  const buildTeamQuery = () => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) qs.append(k, v); });
    return qs.toString();
  };

  const loadTeam = () => api.get(`/activity/team?${buildTeamQuery()}`)
    .then(r => setTeamUpdates(r.data || [])).catch(() => {});

  const loadCharts = () => {
    const qs = new URLSearchParams();
    if (filters.from) qs.append('from', filters.from);
    if (filters.to) qs.append('to', filters.to);
    if (filters.project_id) qs.append('project_id', filters.project_id);
    return api.get(`/activity/charts?${qs.toString()}`).then(r => setCharts(r.data)).catch(() => {});
  };

  const downloadCsv = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/activity/export.csv?${buildTeamQuery()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team-updates-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Failed to download CSV');
    }
  };

  useEffect(() => {
    const jobs = [loadProjects(), loadMine()];
    if (isLead) jobs.push(loadUsers(), loadSummary(), loadTeam(), loadCharts());
    Promise.all(jobs).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLead && tab === 'team') { loadTeam(); loadCharts(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this update?')) return;
    await api.delete(`/activity/${id}`);
    loadMine();
    if (isLead) { loadTeam(); loadSummary(); loadCharts(); }
  };

  const afterSave = () => {
    loadMine();
    if (isLead) { loadTeam(); loadSummary(); loadCharts(); }
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

          {charts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard icon={BarChart3} title="Completed updates per employee">
                <BarChart data={charts.byEmployeeCompleted} />
              </ChartCard>
              <ChartCard icon={PieIcon} title="Status breakdown">
                <PieChart data={charts.statusBreakdown} />
              </ChartCard>
              <ChartCard icon={LineIcon} title="Daily team progress">
                <LineChart data={charts.dailyTrend} />
              </ChartCard>
              <ChartCard icon={BarChart3} title="Work distribution by project">
                <BarChart data={charts.byProject} />
              </ChartCard>
              <ChartCard icon={BarChart3} title="Avg. completion % by employee">
                <BarChart data={charts.byEmployeeProgress} max={100} valueLabel="pct" />
              </ChartCard>
            </div>
          )}

          <div className="bg-white border border-ink-100 rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-ink-700">Team updates</span>
                <span className="text-xs text-ink-400">{teamUpdates.length} entries</span>
              </div>
              <button onClick={downloadCsv}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-ink-100 text-ink-700 hover:bg-ink-50">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
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
                      <th className="text-left px-4 py-2">Title</th>
                      <th className="text-left px-4 py-2">Status</th>
                      <th className="text-left px-4 py-2">Progress</th>
                      <th className="text-left px-4 py-2">Blockers</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamUpdates.map(u => (
                      <tr key={u.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                        <td className="px-4 py-2 font-mono text-xs text-ink-600">{u.update_date}</td>
                        <td className="px-4 py-2 font-medium text-ink-900">{u.employee_name}</td>
                        <td className="px-4 py-2 text-ink-600">{u.project_name || '—'}</td>
                        <td className="px-4 py-2 text-ink-700 max-w-[220px] truncate" title={u.title || ''}>{u.title || '—'}</td>
                        <td className="px-4 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusClass(u.status)}`}>{u.status}</span></td>
                        <td className="px-4 py-2"><ProgressBar value={u.progress_percent} /></td>
                        <td className="px-4 py-2 text-ink-600 max-w-[200px] truncate" title={u.blockers || ''}>{u.blockers || '—'}</td>
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
