import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Briefcase, Plus, Clock, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Send, Users, Activity, TrendingUp, Calendar, Filter, FolderOpen } from 'lucide-react';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['Pending', 'In Progress', 'On Hold', 'Completed'];

const priorityColor = (p) => {
  const map = { 'Critical': 'text-red-600 bg-red-50', 'High': 'text-orange-600 bg-orange-50', 'Medium': 'text-yellow-600 bg-yellow-50', 'Low': 'text-ink-600 bg-ink-50' };
  return map[p] || 'text-ink-600 bg-ink-50';
};

const statusColor = (s) => {
  const map = { 'Pending': 'bg-blue-100 text-blue-700', 'In Progress': 'bg-yellow-100 text-yellow-700', 'On Hold': 'bg-orange-100 text-orange-700', 'Completed': 'bg-green-100 text-green-700' };
  return map[s] || 'bg-ink-100 text-ink-700';
};

const progressColor = (pct) => {
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 60) return 'bg-blue-500';
  if (pct >= 30) return 'bg-yellow-500';
  return 'bg-red-400';
};

const avatar = (firstName, lastName) => (
  <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
    {(firstName?.[0] || '').toUpperCase()}{(lastName?.[0] || '').toUpperCase()}
  </div>
);

export default function Workspace() {
  const { user } = useAuth();
  const [tab, setTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState({ users: [], recentUpdates: [] });
  const [allUsers, setAllUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const [updateForm, setUpdateForm] = useState({ update_text: '', progress_percent: 0, blockers: '', update_date: today });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assigned_to: '', project_id: '', priority: 'Medium', deadline: '' });
  const [loading, setLoading] = useState(true);

  // Progress feed state
  const [feedUpdates, setFeedUpdates] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedUser, setFeedUser] = useState('');
  const [feedProject, setFeedProject] = useState('');
  const [feedFrom, setFeedFrom] = useState('');
  const [feedTo, setFeedTo] = useState('');

  // Members + projects state
  const [membersProjects, setMembersProjects] = useState([]);

  const isManager = ['Admin', 'Project Manager'].includes(user?.role);

  const fetchTasks = () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterUser) params.assigned_to = filterUser;
    api.get('/workspace/tasks', { params }).then(r => setTasks(r.data)).catch(console.error);
  };

  const fetchActivity = () => {
    api.get('/workspace/activity').then(r => setActivity(r.data)).catch(console.error);
  };

  const fetchFeed = () => {
    setFeedLoading(true);
    const params = {};
    if (feedUser) params.user_id = feedUser;
    if (feedProject) params.project_id = feedProject;
    if (feedFrom) params.from_date = feedFrom;
    if (feedTo) params.to_date = feedTo;
    api.get('/workspace/progress-feed', { params })
      .then(r => setFeedUpdates(r.data))
      .catch(console.error)
      .finally(() => setFeedLoading(false));
  };

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/workspace/tasks').then(r => setTasks(r.data)),
      api.get('/workspace/activity').then(r => setActivity(r.data)),
      api.get('/workspace/members-projects').then(r => setMembersProjects(r.data)),
      isManager ? api.get('/users').then(r => setAllUsers(r.data.filter(u => u.is_active))) : Promise.resolve(),
      api.get('/projects').then(r => setProjects(r.data)),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchTasks(); }, [filterStatus, filterUser]);
  useEffect(() => { if (tab === 'feed') fetchFeed(); }, [tab, feedUser, feedProject, feedFrom, feedTo]);

  const createTask = async (e) => {
    e.preventDefault();
    try {
      await api.post('/workspace/tasks', taskForm);
      setShowCreateModal(false);
      setTaskForm({ title: '', description: '', assigned_to: '', project_id: '', priority: 'Medium', deadline: '' });
      fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      await api.put(`/workspace/tasks/${taskId}`, { status });
      fetchTasks();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const submitUpdate = async (taskId) => {
    try {
      await api.post(`/workspace/tasks/${taskId}/updates`, updateForm);
      setUpdateForm({ update_text: '', progress_percent: 0, blockers: '', update_date: today });
      fetchAll();
      const r = await api.get(`/workspace/tasks/${taskId}`);
      setExpandedTask(r.data);
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const toggleExpand = async (taskId) => {
    if (expandedTask?.id === taskId) { setExpandedTask(null); return; }
    try {
      const r = await api.get(`/workspace/tasks/${taskId}`);
      setExpandedTask(r.data);
    } catch (err) { console.error(err); }
  };

  const overdueTasks = tasks.filter(t => t.deadline < today && t.status !== 'Completed');
  const pendingTasks = tasks.filter(t => t.status === 'Pending');
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress');
  const completedTasks = tasks.filter(t => t.status === 'Completed');

  if (loading) return <div className="text-center py-12 text-ink-500">Loading workspace...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Workspace</h1>
          <p className="text-ink-500 mt-1">Track work assignments and daily progress</p>
        </div>
        {isManager && (
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-gradient text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Assign Work
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-ink-500">Pending</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{pendingTasks.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-ink-500">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{inProgressTasks.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-ink-500">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{overdueTasks.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs text-ink-500">Completed</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{completedTasks.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-ink-100">
        {[
          { key: 'tasks', label: 'Work Tasks', icon: Briefcase },
          { key: 'feed', label: 'Progress Feed', icon: TrendingUp },
          { key: 'activity', label: 'Team Activity', icon: Users },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Work Tasks Tab */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none">
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {isManager && (
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                className="px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none">
                <option value="">All Members</option>
                {allUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            )}
          </div>

          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="bg-white card p-12 text-center text-ink-400">
                <Briefcase className="w-10 h-10 mx-auto mb-2" />
                <p>No work tasks found</p>
              </div>
            ) : tasks.map(t => (
              <div key={t.id} className="bg-white card overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-ink-50" onClick={() => toggleExpand(t.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-ink-900 truncate">{t.title}</p>
                      {t.deadline < today && t.status !== 'Completed' && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">OVERDUE</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-500">
                      <span>Assigned to: <strong className="text-ink-700">{t.assigned_to_name}</strong></span>
                      <span>By: {t.assigned_by_name}</span>
                      {t.project_name && <span>Project: {t.project_name}</span>}
                      <span>Deadline: <strong className={t.deadline < today && t.status !== 'Completed' ? 'text-red-600' : 'text-ink-700'}>{t.deadline}</strong></span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColor(t.priority)}`}>{t.priority}</span>
                  <select value={t.status} onChange={e => { e.stopPropagation(); updateTaskStatus(t.id, e.target.value); }}
                    className={`text-xs px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${statusColor(t.status)}`}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="w-20 flex items-center gap-1">
                    <div className="flex-1 h-2 bg-ink-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${progressColor(t.latest_progress || 0)}`} style={{ width: `${t.latest_progress || 0}%` }} />
                    </div>
                    <span className="text-xs text-ink-500 w-8 text-right">{t.latest_progress || 0}%</span>
                  </div>
                  {expandedTask?.id === t.id ? <ChevronUp className="w-4 h-4 text-ink-400" /> : <ChevronDown className="w-4 h-4 text-ink-400" />}
                </div>

                {expandedTask?.id === t.id && (
                  <div className="border-t border-ink-100 px-5 py-4 space-y-4 bg-ink-50">
                    {t.description && (
                      <div>
                        <h4 className="text-xs font-medium text-ink-500 mb-1">Description</h4>
                        <p className="text-sm text-ink-700 whitespace-pre-wrap">{t.description}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-medium text-ink-500 mb-2">Daily Updates ({expandedTask.updates?.length || 0})</h4>
                      {expandedTask.updates?.length === 0 ? (
                        <p className="text-xs text-ink-400">No updates yet</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {expandedTask.updates?.map(u => (
                            <div key={u.id} className="bg-white rounded-lg border border-ink-100 p-3">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-ink-900">{u.user_name}</span>
                                  <span className="text-xs text-ink-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{u.update_date}</span>
                                </div>
                                <span className="text-xs font-semibold text-brand-600">{u.progress_percent}%</span>
                              </div>
                              <p className="text-sm text-ink-700">{u.update_text}</p>
                              {u.blockers && (
                                <p className="text-xs text-red-600 mt-1"><AlertTriangle className="w-3 h-3 inline mr-1" />Blocker: {u.blockers}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {(t.assigned_to === user.id || isManager) && t.status !== 'Completed' && (
                      <div className="bg-white rounded-lg border border-ink-100 p-4 space-y-3">
                        <h4 className="text-sm font-medium text-ink-700">Submit Daily Update</h4>
                        <textarea value={updateForm.update_text} onChange={e => setUpdateForm({ ...updateForm, update_text: e.target.value })}
                          placeholder="What did you work on?"
                          rows={2} className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-300" />
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-ink-500 mb-1">Date</label>
                            <input type="date" value={updateForm.update_date}
                              onChange={e => setUpdateForm({ ...updateForm, update_date: e.target.value })}
                              className="w-full px-3 py-1.5 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-300" />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-500 mb-1">Progress ({updateForm.progress_percent}%)</label>
                            <input type="range" min="0" max="100" step="5" value={updateForm.progress_percent}
                              onChange={e => setUpdateForm({ ...updateForm, progress_percent: parseInt(e.target.value) })}
                              className="w-full mt-2" />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-500 mb-1">Blockers (optional)</label>
                            <input type="text" value={updateForm.blockers} onChange={e => setUpdateForm({ ...updateForm, blockers: e.target.value })}
                              placeholder="Any blockers?"
                              className="w-full px-3 py-1.5 border border-ink-200 rounded-lg text-sm outline-none" />
                          </div>
                        </div>
                        <button onClick={() => submitUpdate(t.id)} disabled={!updateForm.update_text.trim()}
                          className="flex items-center gap-2 px-4 py-2 bg-brand-gradient text-white rounded-lg text-sm font-medium disabled:opacity-50">
                          <Send className="w-4 h-4" /> Submit Update
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Feed Tab */}
      {tab === 'feed' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-ink-500" />
              <span className="text-sm font-medium text-ink-700">Filter Progress</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {isManager && (
                <div>
                  <label className="block text-xs text-ink-500 mb-1">Team Member</label>
                  <select value={feedUser} onChange={e => setFeedUser(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none">
                    <option value="">All Members</option>
                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-ink-500 mb-1">Project</label>
                <select value={feedProject} onChange={e => setFeedProject(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none">
                  <option value="">All Projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">From Date</label>
                <input type="date" value={feedFrom} onChange={e => setFeedFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">To Date</label>
                <input type="date" value={feedTo} onChange={e => setFeedTo(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none" />
              </div>
            </div>
            {(feedUser || feedProject || feedFrom || feedTo) && (
              <button onClick={() => { setFeedUser(''); setFeedProject(''); setFeedFrom(''); setFeedTo(''); }}
                className="mt-3 text-xs text-brand-600 hover:underline">
                Clear filters
              </button>
            )}
          </div>

          {/* Feed */}
          {feedLoading ? (
            <div className="text-center py-8 text-ink-400 text-sm">Loading...</div>
          ) : feedUpdates.length === 0 ? (
            <div className="bg-white card p-12 text-center text-ink-400">
              <TrendingUp className="w-10 h-10 mx-auto mb-2" />
              <p>No progress updates found</p>
              {(feedUser || feedProject || feedFrom || feedTo) && (
                <p className="text-xs mt-1">Try adjusting your filters</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Group by date */}
              {Object.entries(
                feedUpdates.reduce((acc, u) => {
                  if (!acc[u.update_date]) acc[u.update_date] = [];
                  acc[u.update_date].push(u);
                  return acc;
                }, {})
              ).map(([date, entries]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-4 h-4 text-ink-400" />
                    <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <div className="flex-1 h-px bg-ink-100" />
                    <span className="text-xs text-ink-400">{entries.length} update{entries.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2 pl-7">
                    {entries.map(u => (
                      <div key={u.id} className="bg-white card p-4">
                        <div className="flex items-start gap-3">
                          {avatar(u.user_first_name, u.user_last_name)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-ink-900">{u.user_name}</span>
                                {u.project_name && (
                                  <span className="text-xs px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full font-medium">{u.project_name}</span>
                                )}
                                <span className="text-xs text-ink-400">on: {u.task_title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-semibold text-ink-700">{u.progress_percent}%</span>
                                <div className="w-16 h-2 bg-ink-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${progressColor(u.progress_percent)}`} style={{ width: `${u.progress_percent}%` }} />
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-ink-700 mb-1">{u.update_text}</p>
                            {u.blockers && (
                              <p className="text-xs text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Blocker: {u.blockers}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Activity Tab */}
      {tab === 'activity' && (
        <div className="space-y-6">
          {/* Members + Projects summary */}
          <div className="bg-white card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-semibold text-ink-900">Members & Projects</h3>
              </div>
              <span className="text-xs text-ink-500">{membersProjects.length} member{membersProjects.length !== 1 ? 's' : ''}</span>
            </div>
            {membersProjects.length === 0 ? (
              <p className="text-sm text-ink-400">No members found</p>
            ) : (
              <div className="divide-y divide-ink-50">
                {membersProjects.map(u => (
                  <div key={u.id} className="py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {u.first_name[0]}{u.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-ink-900">{u.first_name} {u.last_name}</span>
                        <span className="text-xs text-ink-400">{u.role}</span>
                        <span className="ml-auto text-xs text-ink-500 shrink-0">{u.active_tasks} active task{u.active_tasks !== 1 ? 's' : ''}</span>
                        {isManager && (
                          <button
                            onClick={() => { setTaskForm(f => ({ ...f, assigned_to: u.id })); setShowCreateModal(true); }}
                            className="flex items-center gap-1 text-xs px-2 py-0.5 bg-brand-gradient text-white rounded-full font-medium shrink-0">
                            <Plus className="w-3 h-3" /> Assign
                          </button>
                        )}
                      </div>
                      {u.projects.length === 0 ? (
                        <span className="text-xs text-ink-400 italic">No projects assigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {u.projects.map(p => (
                            <span key={p.project_id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">
                              <FolderOpen className="w-3 h-3" />
                              {p.project_name}
                              <span className="text-brand-400">({p.active_count} active)</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task stats + recent updates */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-ink-700">Task Overview</h3>
              <div className="space-y-2">
                {activity.users?.map(u => (
                  <div key={u.id} className="bg-white card p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-sm font-bold">
                        {u.first_name[0]}{u.last_name[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink-900">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-ink-500">{u.role}</p>
                      </div>
                      {u.last_activity && (
                        <span className="text-xs text-ink-400">Last active: {new Date(u.last_activity).toLocaleDateString()}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-yellow-50 rounded-lg py-1.5">
                        <p className="text-lg font-bold text-yellow-600">{u.active_tasks}</p>
                        <p className="text-xs text-ink-500">Active</p>
                      </div>
                      <div className="bg-red-50 rounded-lg py-1.5">
                        <p className="text-lg font-bold text-red-600">{u.overdue_tasks}</p>
                        <p className="text-xs text-ink-500">Overdue</p>
                      </div>
                      <div className="bg-green-50 rounded-lg py-1.5">
                        <p className="text-lg font-bold text-green-600">{u.completed_tasks}</p>
                        <p className="text-xs text-ink-500">Done</p>
                      </div>
                    </div>
                  </div>
                ))}
                {activity.users?.length === 0 && <p className="text-sm text-ink-400">No team members</p>}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-ink-700">Recent Updates</h3>
              <div className="space-y-2">
                {activity.recentUpdates?.length === 0 ? (
                  <p className="text-sm text-ink-400">No updates yet</p>
                ) : activity.recentUpdates?.map(u => (
                  <div key={u.id} className="bg-white card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-ink-900">{u.user_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-brand-600">{u.progress_percent}%</span>
                        <span className="text-xs text-ink-400">{u.update_date}</span>
                      </div>
                    </div>
                    <p className="text-xs text-ink-500 mb-1">on: {u.task_title}</p>
                    <p className="text-sm text-ink-700">{u.update_text}</p>
                    {u.blockers && (
                      <p className="text-xs text-red-600 mt-1"><AlertTriangle className="w-3 h-3 inline mr-1" />{u.blockers}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Work Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowCreateModal(false); setTaskForm({ title: '', description: '', assigned_to: '', project_id: '', priority: 'Medium', deadline: '' }); }}>
          <form onClick={e => e.stopPropagation()} onSubmit={createTask} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-semibold">Assign Work Task
              {taskForm.assigned_to && allUsers.find(u => u.id === taskForm.assigned_to) && (
                <span className="ml-2 text-sm font-normal text-brand-600">
                  → {allUsers.find(u => u.id === taskForm.assigned_to)?.first_name} {allUsers.find(u => u.id === taskForm.assigned_to)?.last_name}
                </span>
              )}
            </h2>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Title *</label>
              <input type="text" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} required
                className="w-full px-4 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Description</label>
              <textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={3}
                className="w-full px-4 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Assign To *</label>
                <select value={taskForm.assigned_to} onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })} required
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none">
                  <option value="">Select member</option>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Project (optional)</label>
                <select value={taskForm.project_id} onChange={e => setTaskForm({ ...taskForm, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none">
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Priority</label>
                <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Deadline *</label>
                <input type="date" value={taskForm.deadline} onChange={e => setTaskForm({ ...taskForm, deadline: e.target.value })} required
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => { setShowCreateModal(false); setTaskForm({ title: '', description: '', assigned_to: '', project_id: '', priority: 'Medium', deadline: '' }); }} className="px-4 py-2 text-sm text-ink-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-brand-gradient text-white rounded-lg text-sm font-medium">Assign Work</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
