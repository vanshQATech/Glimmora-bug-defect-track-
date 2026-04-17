import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { BUG_STATUSES } from '../utils/constants';
import {
  Bug, CheckSquare, FolderKanban, AlertTriangle, Clock,
  ArrowUpRight, Activity, Sparkles, Rocket, Flame, Zap,
  ShieldCheck, BarChart3, Target
} from 'lucide-react';

const STATUS_PALETTE = {
  'New':                        { grad: 'from-slate-300 to-slate-500',     solid: '#64748b', text: 'text-slate-700',   bg: 'bg-slate-500' },
  'Open':                       { grad: 'from-blue-300 to-blue-500',       solid: '#3b82f6', text: 'text-blue-700',    bg: 'bg-blue-500' },
  'In Progress':                { grad: 'from-amber-300 to-amber-500',     solid: '#f59e0b', text: 'text-amber-700',   bg: 'bg-amber-500' },
  'Fixed':                      { grad: 'from-teal-300 to-teal-500',       solid: '#14b8a6', text: 'text-teal-700',    bg: 'bg-teal-500' },
  'Under Deployment':           { grad: 'from-cyan-300 to-cyan-500',       solid: '#06b6d4', text: 'text-cyan-700',    bg: 'bg-cyan-500' },
  'Failed':                     { grad: 'from-red-300 to-red-500',         solid: '#ef4444', text: 'text-red-700',     bg: 'bg-red-500' },
  'Ready for Testing':          { grad: 'from-purple-300 to-purple-500',   solid: '#a855f7', text: 'text-purple-700',  bg: 'bg-purple-500' },
  'Checked by QA':              { grad: 'from-emerald-300 to-emerald-500', solid: '#10b981', text: 'text-emerald-700', bg: 'bg-emerald-500' },
  'Checked by Project Manager': { grad: 'from-green-300 to-green-500',     solid: '#22c55e', text: 'text-green-700',   bg: 'bg-green-500' },
  'Approved by PM':             { grad: 'from-brand-400 to-brand-600',     solid: '#8b5e3c', text: 'text-brand-700',   bg: 'bg-brand-600' },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

function MetricCard({ icon: Icon, label, value, sublabel, gradient, accentColor, to }) {
  const Wrap = to ? Link : 'div';
  const props = to ? { to } : {};
  return (
    <Wrap {...props} className="group relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-card hover:shadow-pop hover:-translate-y-1 transition-all duration-300 block">
      <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-[0.12] blur-3xl ${gradient}`} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className={`w-11 h-11 rounded-xl ${gradient} flex items-center justify-center shadow-card`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {to && (
            <div className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:bg-brand-50 transition-all">
              <ArrowUpRight className="w-4 h-4 text-brand-600" />
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-ink-500">{label}</div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-4xl font-bold text-ink-900 tracking-tight tabular-nums">{value}</div>
            {sublabel && <div className={`text-xs font-semibold ${accentColor || 'text-ink-500'}`}>{sublabel}</div>}
          </div>
        </div>
      </div>
    </Wrap>
  );
}

function DonutChart({ counts, total }) {
  const groups = [
    { label: 'Backlog',       statuses: ['New', 'Open'],                                              color: '#3b82f6' },
    { label: 'In Dev',        statuses: ['In Progress', 'Fixed'],                                     color: '#f59e0b' },
    { label: 'Testing/Deploy',statuses: ['Ready for Testing', 'Under Deployment'],                    color: '#a855f7' },
    { label: 'Failed',        statuses: ['Failed'],                                                   color: '#ef4444' },
    { label: 'Verified',      statuses: ['Checked by QA', 'Checked by Project Manager', 'Approved by PM'], color: '#10b981' },
  ].map(g => ({ ...g, value: g.statuses.reduce((sum, s) => sum + (counts[s] || 0), 0) }));

  const R = 72, SW = 22;
  const C = 2 * Math.PI * R;
  let cum = 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-52 h-52">
        <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
          <circle cx="90" cy="90" r={R} fill="none" stroke="#f1f5f9" strokeWidth={SW} />
          {total > 0 && groups.filter(g => g.value > 0).map((g, i) => {
            const len = (g.value / total) * C;
            const offset = -(cum * C) / total;
            cum += g.value;
            return (
              <circle
                key={g.label} cx="90" cy="90" r={R} fill="none"
                stroke={g.color} strokeWidth={SW}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                className="transition-all duration-700"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-4xl font-bold text-ink-900 tracking-tight tabular-nums">{total}</div>
          <div className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold mt-0.5">Total Bugs</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-1.5 w-full max-w-[220px]">
        {groups.map(g => (
          <div key={g.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: g.color }} />
            <span className="text-ink-600 flex-1 truncate">{g.label}</span>
            <span className="font-bold text-ink-900 tabular-nums">{g.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBars({ counts }) {
  const rawMax = Math.max(...BUG_STATUSES.map(s => counts[s] || 0), 1);
  const niceMax = rawMax <= 5 ? 5 : Math.ceil(rawMax / 5) * 5;
  const gridlines = [niceMax, Math.round(niceMax * 0.75), Math.round(niceMax * 0.5), Math.round(niceMax * 0.25), 0];
  const CH = 180;

  return (
    <div className="w-full">
      <div className="flex gap-3" style={{ height: CH + 8 }}>
        <div className="flex flex-col justify-between text-[10px] text-ink-400 font-medium py-1 pr-1 w-6 text-right">
          {gridlines.map(g => <div key={g}>{g}</div>)}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0 flex flex-col justify-between py-1">
            {gridlines.map((_, i) => (
              <div key={i} className={`border-t ${i === gridlines.length - 1 ? 'border-ink-200' : 'border-dashed border-ink-100'}`} />
            ))}
          </div>
          <div className="absolute inset-0 flex items-end justify-between gap-1.5 py-1">
            {BUG_STATUSES.map(s => {
              const val = counts[s] || 0;
              const pct = niceMax > 0 ? (val / niceMax) * 100 : 0;
              const { grad } = STATUS_PALETTE[s];
              return (
                <div key={s} className="group relative flex-1 h-full flex flex-col items-center justify-end">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity bg-ink-900 text-white text-[10px] font-medium px-2 py-1 rounded-md whitespace-nowrap z-10 pointer-events-none shadow-pop">
                    {s}: <span className="font-bold">{val}</span>
                  </div>
                  {val > 0 && <div className="text-[10px] font-bold text-ink-900 mb-1 tabular-nums">{val}</div>}
                  <div
                    className={`w-full max-w-[40px] rounded-t-lg bg-gradient-to-t ${grad} shadow-sm group-hover:shadow-pop group-hover:-translate-y-0.5 transition-all duration-300`}
                    style={{ height: val > 0 ? `${Math.max(pct, 3)}%` : '2px', opacity: val > 0 ? 1 : 0.25 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 pl-9 flex gap-1.5">
        {BUG_STATUSES.map(s => (
          <div key={s} className="flex-1 text-center text-[9px] text-ink-500 font-medium leading-tight line-clamp-2">
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskMini({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-ink-600 font-medium">{label}</span>
        <span className="text-xs font-bold text-ink-900 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats').then(res => setStats(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <div className="skeleton h-40 w-full rounded-3xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    );
  }
  if (!stats) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  const bugs = stats.bugs || {};
  const tasks = stats.tasks || {};
  const counts = stats.statusBreakdown || {};
  const bugTotal = bugs.total || 0;
  const taskTotal = tasks.total || 0;
  const greeting = getGreeting();

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-6 md:p-10 shadow-pop">
        <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(1200px 600px at 0% 0%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(1000px 500px at 100% 100%, rgba(255,255,255,0.08), transparent 60%)' }} />
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -left-10 -bottom-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-white/90 text-[11px] font-semibold uppercase tracking-[0.2em] mb-4 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
              <Sparkles className="w-3.5 h-3.5" /> Glimmora DefectDesk
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              {greeting}, {user?.first_name}
              <span className="text-white/60">.</span>
            </h1>
            <p className="text-white/80 mt-3 text-sm md:text-base max-w-xl">
              You have <span className="font-bold text-white">{stats.myBugs}</span> open bugs and{' '}
              <span className="font-bold text-white">{stats.myTasks}</span> tasks on your plate today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/projects" className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-white/25 transition-all">
              <FolderKanban className="w-4 h-4" /> Projects
            </Link>
            <Link to="/my-work" className="inline-flex items-center gap-2 bg-white text-brand-700 px-4 py-2.5 rounded-xl font-semibold hover:scale-[1.03] transition-all shadow-card">
              <Rocket className="w-4 h-4" /> My Work
            </Link>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={FolderKanban}
          label="Active Projects"
          value={stats.projects || 0}
          gradient="bg-gradient-to-br from-brand-500 to-brand-700"
          to="/projects"
        />
        <MetricCard
          icon={Bug}
          label="Open Bugs"
          value={(bugs.new_count || 0) + (bugs.open || 0)}
          sublabel={`${bugs.active || 0} active`}
          accentColor="text-red-600"
          gradient="bg-gradient-to-br from-red-500 to-rose-600"
        />
        <MetricCard
          icon={Zap}
          label="In Progress"
          value={bugs.in_progress || 0}
          sublabel={`${bugs.fixed || 0} fixed`}
          accentColor="text-amber-600"
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
        />
        <MetricCard
          icon={Flame}
          label="Critical"
          value={bugs.critical || 0}
          sublabel={bugs.failed ? `${bugs.failed} failed` : 'all clear'}
          accentColor={bugs.critical > 0 ? 'text-red-600' : 'text-emerald-600'}
          gradient="bg-gradient-to-br from-orange-500 to-red-600"
        />
      </div>

      {/* Bug status: donut + bar chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-card">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink-900">Bug Health Overview</h3>
              <p className="text-xs text-ink-500">Across every project · live status distribution</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">{bugs.done || 0} approved</span>
            </div>
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs font-semibold text-red-700">{bugs.failed || 0} failed</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-center">
          <div className="lg:col-span-2 flex justify-center">
            <DonutChart counts={counts} total={bugTotal} />
          </div>
          <div className="lg:col-span-3">
            <StatusBars counts={counts} />
          </div>
        </div>
      </div>

      {/* Bottom row: tasks + my work + activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Task Health */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-ink-900">Task Health</h3>
            </div>
            <span className="chip bg-brand-50 text-brand-700 border-brand-200">{taskTotal} total</span>
          </div>
          <div className="space-y-3">
            <TaskMini label="To Do" value={tasks.todo || 0} total={taskTotal} color="bg-gradient-to-r from-blue-400 to-blue-500" />
            <TaskMini label="In Progress" value={tasks.in_progress || 0} total={taskTotal} color="bg-gradient-to-r from-amber-400 to-amber-500" />
            <TaskMini label="Blocked" value={tasks.blocked || 0} total={taskTotal} color="bg-gradient-to-r from-red-400 to-red-500" />
            <TaskMini label="Completed" value={tasks.done || 0} total={taskTotal} color="bg-gradient-to-r from-emerald-400 to-emerald-500" />
            {tasks.overdue > 0 && (
              <TaskMini label="Overdue" value={tasks.overdue} total={taskTotal} color="bg-gradient-to-r from-orange-400 to-red-500" />
            )}
          </div>
        </div>

        {/* My Work */}
        <Link to="/my-work" className="card p-6 group relative overflow-hidden block hover:shadow-pop transition-all">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-brand-gradient rounded-full opacity-10 blur-3xl group-hover:opacity-20 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-semibold text-ink-900">My Work</h3>
              </div>
              <ArrowUpRight className="w-4 h-4 text-ink-300 group-hover:text-brand-600 transition-colors" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-100">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-card">
                  <Bug className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-ink-900 tabular-nums leading-none">{stats.myBugs || 0}</div>
                  <div className="text-xs text-ink-500 mt-1">assigned bugs</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-card">
                  <CheckSquare className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-ink-900 tabular-nums leading-none">{stats.myTasks || 0}</div>
                  <div className="text-xs text-ink-500 mt-1">open tasks</div>
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Recent Activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-ink-900">Live Activity</h3>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
          {stats.recentActivity?.length === 0 ? (
            <div className="text-center py-8 text-ink-400 text-sm">No recent activity</div>
          ) : (
            <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
              {stats.recentActivity?.slice(0, 12).map(a => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-brand-gradient text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-card">
                    {a.user_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-ink-800 leading-tight">
                      <span className="font-semibold">{a.user_name}</span>
                      <span className="text-ink-500"> {a.action}</span>
                      {a.field_changed && <span className="text-ink-500"> {a.field_changed}</span>}
                    </p>
                    {(a.old_value || a.new_value) && (
                      <p className="text-[11px] mt-0.5">
                        {a.old_value && <span className="text-ink-400 line-through">{a.old_value}</span>}
                        {a.old_value && a.new_value && <span className="text-ink-400 mx-1">→</span>}
                        {a.new_value && <span className="text-brand-700 font-medium">{a.new_value}</span>}
                      </p>
                    )}
                    <p className="text-[10px] text-ink-400 mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
