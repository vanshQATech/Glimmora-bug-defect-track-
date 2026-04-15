import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Bug, CheckSquare, FolderKanban, AlertTriangle, Clock,
  TrendingUp, ArrowUpRight, Activity, Sparkles
} from 'lucide-react';

function StatCard({ label, value, icon: Icon, accent, to, trend }) {
  const content = (
    <div className="stat-card group relative overflow-hidden">
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 blur-2xl ${accent}`} />
      <div className="flex items-start justify-between relative">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent} shadow-card`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {to && <ArrowUpRight className="w-4 h-4 text-ink-300 group-hover:text-brand-500 transition-colors" />}
      </div>
      <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mt-3">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-ink-900 tracking-tight">{value}</p>
        {trend && <span className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> {trend}</span>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function Bar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-ink-600">{label}</span>
        <span className="text-sm font-semibold text-ink-900">{value}</span>
      </div>
      <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
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
      <div className="space-y-6">
        <div className="skeleton h-20 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-32" />)}
        </div>
      </div>
    );
  }
  if (!stats) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  const bugTotal = stats.bugs?.total || 0;
  const taskTotal = stats.tasks?.total || 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="card relative overflow-hidden p-6 md:p-8">
        <div className="absolute inset-0 bg-brand-gradient opacity-[0.04]" />
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-brand-gradient rounded-full opacity-10 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-600 text-xs font-semibold uppercase tracking-widest mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Glimmora Workspace
            </div>
            <h1 className="text-3xl font-bold text-ink-900 tracking-tight">
              Welcome back, {user?.first_name} <span className="text-brand-600">.</span>
            </h1>
            <p className="text-ink-500 mt-1.5">Here's what's happening across your projects today.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/projects" className="btn-secondary"><FolderKanban className="w-4 h-4" /> Projects</Link>
            <Link to="/my-work" className="btn-primary"><CheckSquare className="w-4 h-4" /> My Work</Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Active Projects" value={stats.projects} icon={FolderKanban} accent="bg-gradient-to-br from-brand-500 to-brand-700" to="/projects" />
        <StatCard label="Open Bugs" value={stats.bugs?.open || 0} icon={Bug} accent="bg-gradient-to-br from-red-500 to-red-600" />
        <StatCard label="In Progress" value={stats.bugs?.in_progress || 0} icon={Clock} accent="bg-gradient-to-br from-amber-500 to-orange-600" />
        <StatCard label="Critical" value={stats.bugs?.critical || 0} icon={AlertTriangle} accent="bg-gradient-to-br from-orange-500 to-red-600" />
        <StatCard label="My Bugs" value={stats.myBugs || 0} icon={Bug} accent="bg-gradient-to-br from-indigo-500 to-purple-600" to="/my-work" />
        <StatCard label="My Tasks" value={stats.myTasks || 0} icon={CheckSquare} accent="bg-gradient-to-br from-emerald-500 to-teal-600" to="/my-work" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Bug Summary */}
        <div className="card p-6 lg:col-span-1">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Bug Health</h3>
            <span className="chip bg-brand-50 text-brand-700 border-brand-200">{bugTotal} total</span>
          </div>
          <div className="space-y-4">
            <Bar label="Open" value={stats.bugs?.open || 0} total={bugTotal} color="bg-gradient-to-r from-red-400 to-red-500" />
            <Bar label="In Progress" value={stats.bugs?.in_progress || 0} total={bugTotal} color="bg-gradient-to-r from-amber-400 to-amber-500" />
            <Bar label="Done" value={stats.bugs?.done || 0} total={bugTotal} color="bg-gradient-to-r from-emerald-400 to-emerald-500" />
          </div>
        </div>

        {/* Task Summary */}
        <div className="card p-6 lg:col-span-1">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Task Health</h3>
            <span className="chip bg-brand-50 text-brand-700 border-brand-200">{taskTotal} total</span>
          </div>
          <div className="space-y-4">
            <Bar label="To Do" value={stats.tasks?.todo || 0} total={taskTotal} color="bg-gradient-to-r from-blue-400 to-blue-500" />
            <Bar label="In Progress" value={stats.tasks?.in_progress || 0} total={taskTotal} color="bg-gradient-to-r from-amber-400 to-amber-500" />
            <Bar label="Blocked" value={stats.tasks?.blocked || 0} total={taskTotal} color="bg-gradient-to-r from-red-400 to-red-500" />
            <Bar label="Completed" value={stats.tasks?.done || 0} total={taskTotal} color="bg-gradient-to-r from-emerald-400 to-emerald-500" />
            {stats.tasks?.overdue > 0 && <Bar label="Overdue" value={stats.tasks.overdue} total={taskTotal} color="bg-gradient-to-r from-orange-400 to-orange-500" />}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-6 lg:col-span-1">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title flex items-center gap-2"><Activity className="w-4 h-4 text-brand-600" /> Activity</h3>
          </div>
          {stats.recentActivity?.length === 0 ? (
            <div className="text-center py-8 text-ink-400 text-sm">No recent activity</div>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {stats.recentActivity?.map(a => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-brand-gradient text-white flex items-center justify-center text-xs font-bold">
                      {a.user_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-ink-800">
                      <span className="font-semibold">{a.user_name}</span>
                      <span className="text-ink-500"> {a.action} </span>
                      {a.field_changed && <span className="text-ink-500">{a.field_changed}</span>}
                    </p>
                    {(a.old_value || a.new_value) && (
                      <p className="text-xs mt-0.5">
                        {a.old_value && <span className="text-ink-400 line-through">{a.old_value}</span>}
                        {a.old_value && a.new_value && <span className="text-ink-400 mx-1">→</span>}
                        {a.new_value && <span className="text-brand-700 font-medium">{a.new_value}</span>}
                      </p>
                    )}
                    <p className="text-[11px] text-ink-400 mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
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
