import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { API_BASE } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StatusChip, { PriorityChip } from '../components/StatusChip';
import { BUG_STATUSES, TASK_STATUSES, PRIORITIES, SEVERITIES } from '../utils/constants';
import {
  Plus, Bug, CheckSquare, Users, Search, Download, ArrowLeft, UserPlus, Mail,
  X, Layers, List, Calendar, FolderKanban, Trash2
} from 'lucide-react';

const KANBAN_COLUMNS = ['To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'];

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [bugs, setBugs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [tab, setTab] = useState('bugs');
  const [taskView, setTaskView] = useState('board');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showBugModal, setShowBugModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [bugForm, setBugForm] = useState({ summary: '', description: '', steps_to_reproduce: '', expected_result: '', actual_result: '', url: '', module: '', environment: '', browser: '', device: '', due_date: '', assignee_id: '', qa_owner_id: '', priority: 'Medium', severity: 'Major' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignee_id: '', priority: 'Medium', due_date: '', linked_bug_id: '' });
  const [files, setFiles] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const importInputRef = useRef(null);

  const fetchAll = () => {
    api.get(`/projects/${projectId}`).then(r => setProject(r.data)).catch(() => navigate('/projects'));
    api.get(`/bugs/project/${projectId}`, { params: { search, status: filterStatus, priority: filterPriority } }).then(r => setBugs(r.data));
    api.get(`/tasks/project/${projectId}`, { params: { search, status: filterStatus, priority: filterPriority } }).then(r => setTasks(r.data));
    api.get('/users').then(r => setAllUsers(r.data));
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [projectId, search, filterStatus, filterPriority]);

  const createBug = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('project_id', projectId);
    Object.entries(bugForm).forEach(([k, v]) => { if (v) formData.append(k, v); });
    files.forEach(f => formData.append('attachments', f));
    try {
      await api.post('/bugs', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowBugModal(false);
      setBugForm({ summary: '', description: '', steps_to_reproduce: '', expected_result: '', actual_result: '', url: '', module: '', environment: '', browser: '', device: '', due_date: '', assignee_id: '', qa_owner_id: '', priority: 'Medium', severity: 'Major' });
      setFiles([]);
      fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const createTask = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tasks', { ...taskForm, project_id: projectId });
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', assignee_id: '', priority: 'Medium', due_date: '', linked_bug_id: '' });
      fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const addMember = async (userId) => {
    try { await api.post(`/projects/${projectId}/members`, { user_id: userId }); fetchAll(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const canManageProject = user?.role === 'Admin';

  const deleteProject = async () => {
    if (!project) return;
    const ok = window.confirm(
      `Delete project "${project.name}"?\n\nThis will permanently remove all bugs, tasks, members, comments, and attachments. This cannot be undone.`
    );
    if (!ok) return;
    try {
      await api.delete(`/projects/${projectId}`);
      navigate('/projects');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete project');
    }
  };

  const inviteByEmail = async (e) => {
    e.preventDefault();
    setInviteLoading(true); setInviteStatus(null);
    try {
      const res = await api.post(`/projects/${projectId}/invite`, { email: inviteEmail });
      setInviteStatus({ type: 'success', message: res.data.message });
      setInviteEmail(''); fetchAll();
      setTimeout(() => { setShowInviteModal(false); setInviteStatus(null); }, 2500);
    } catch (err) {
      setInviteStatus({ type: 'error', message: err.response?.data?.error || 'Failed to send invite' });
    } finally { setInviteLoading(false); }
  };

  const updateBugStatus = async (bugId, status) => {
    try { await api.put(`/bugs/${bugId}`, { status }); fetchAll(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };
  const updateBugAssignee = async (bugId, assignee_id) => {
    try { await api.put(`/bugs/${bugId}`, { assignee_id: assignee_id || null }); fetchAll(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };
  const updateTaskStatus = async (taskId, status) => {
    try { await api.put(`/tasks/${taskId}`, { status }); fetchAll(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const exportBugs = () => { window.open(`/api/dashboard/export/bugs?project_id=${projectId}`, '_blank'); };
  const exportTasks = () => { window.open(`/api/dashboard/export/tasks?project_id=${projectId}`, '_blank'); };

  const downloadBlob = async (url, filename) => {
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(err.response?.data?.error || 'Download failed');
    }
  };

  const exportBugsXlsx = () => downloadBlob(`/bugs/project/${projectId}/export`, `bugs_${project?.name || 'project'}.xlsx`);
  const downloadImportTemplate = () => downloadBlob(`/bugs/project/${projectId}/import-template`, 'bugs_import_template.xlsx');

  const handleImportFile = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setImportStatus({ loading: true });
    try {
      const res = await api.post(`/bugs/project/${projectId}/import`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportStatus({ loading: false, result: res.data });
      fetchAll();
    } catch (err) {
      const detail = err.response?.data?.error
        || err.response?.statusText
        || err.message
        || 'Import failed';
      const status = err.response?.status;
      setImportStatus({ loading: false, error: status ? `[${status}] ${detail}` : detail });
      console.error('Import error:', err);
    }
  };

  const onDragStart = (e, taskId) => { e.dataTransfer.setData('taskId', taskId); };
  const onDrop = (e, status) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('taskId');
    if (id) updateTaskStatus(id, status);
  };

  if (!project) return <div className="space-y-4"><div className="skeleton h-24" /><div className="skeleton h-12" /><div className="skeleton h-64" /></div>;

  const members = project.members || [];
  const memberIds = members.map(m => m.id);
  const nonMembers = allUsers.filter(u => !memberIds.includes(u.id) && u.is_active);
  const canManage = ['Admin', 'Project Manager'].includes(user?.role);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="card relative overflow-hidden p-6">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-brand-gradient rounded-full opacity-10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <button onClick={() => navigate('/projects')} className="btn-ghost p-2"><ArrowLeft className="w-5 h-5" /></button>
          <div className={`w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-card flex-shrink-0`}>
            <FolderKanban className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-ink-900 tracking-tight">{project.name}</h1>
            {project.description && <p className="text-ink-500 mt-1">{project.description}</p>}
          </div>
          {canManageProject && (
            <button
              onClick={deleteProject}
              className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
              title="Delete project"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>

        <div className="relative grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          {[
            { label: 'Open Bugs', val: project.stats?.open_bugs || 0, c: 'text-red-600', bg: 'bg-red-50' },
            { label: 'In Progress', val: project.stats?.in_progress_bugs || 0, c: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Done', val: project.stats?.done_bugs || 0, c: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Total Tasks', val: project.taskStats?.total_tasks || 0, c: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Members', val: members.length, c: 'text-brand-600', bg: 'bg-brand-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center border border-ink-100`}>
              <p className={`text-2xl font-bold ${s.c}`}>{s.val}</p>
              <p className="text-[11px] uppercase tracking-wide text-ink-500 mt-0.5 font-semibold">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white border border-ink-100 rounded-xl w-fit shadow-card">
        {[
          { id: 'bugs', label: 'Bugs', icon: Bug, count: bugs.length },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: tasks.length },
          { id: 'members', label: 'Members', icon: Users, count: members.length },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setFilterStatus(''); setFilterPriority(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-brand-gradient text-white shadow-card' : 'text-ink-600 hover:bg-ink-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-ink-100'}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      {tab !== 'members' && (
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-auto">
            <option value="">All Statuses</option>
            {(tab === 'bugs' ? BUG_STATUSES : TASK_STATUSES).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="input w-auto">
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {tab === 'tasks' && (
            <div className="flex items-center gap-1 p-0.5 bg-ink-100 rounded-lg ml-1">
              <button onClick={() => setTaskView('board')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium ${taskView === 'board' ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500'}`}><Layers className="w-3.5 h-3.5" /> Board</button>
              <button onClick={() => setTaskView('list')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium ${taskView === 'list' ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500'}`}><List className="w-3.5 h-3.5" /> List</button>
            </div>
          )}
          <button onClick={tab === 'bugs' ? exportBugs : exportTasks} className="btn-secondary"><Download className="w-4 h-4" /> CSV</button>
          {tab === 'bugs' && (
            <>
              <button onClick={exportBugsXlsx} className="btn-secondary"><Download className="w-4 h-4" /> Excel</button>
              {canManage && (
                <button onClick={() => { setImportStatus(null); setShowImportModal(true); }} className="btn-secondary">
                  <Plus className="w-4 h-4" /> Import
                </button>
              )}
            </>
          )}
          <button onClick={() => tab === 'bugs' ? setShowBugModal(true) : setShowTaskModal(true)} className="btn-primary ml-auto">
            <Plus className="w-4 h-4" /> New {tab === 'bugs' ? 'Bug' : 'Task'}
          </button>
        </div>
      )}

      {/* Bug list */}
      {tab === 'bugs' && (
        <div className="card overflow-hidden">
          {bugs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-brand-50 mb-3"><Bug className="w-7 h-7 text-brand-600" /></div>
              <p className="text-ink-700 font-medium">No bugs found</p>
              <p className="text-ink-500 text-sm">Report the first bug to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {bugs.map(b => (
                <div key={b.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/50 transition-colors">
                  <span className="text-[11px] font-mono font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded-md border border-brand-100">#{b.bug_number}</span>
                  <Link to={`/bugs/${b.id}`} className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate hover:text-brand-700">{b.summary}</p>
                    <p className="text-xs text-ink-500 mt-0.5">{b.reporter_name} · {new Date(b.created_at).toLocaleDateString()}</p>
                  </Link>
                  <PriorityChip priority={b.priority} />
                  <select value={b.status} onChange={e => updateBugStatus(b.id, e.target.value)} onClick={e => e.stopPropagation()}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-ink-200 bg-white outline-none cursor-pointer font-medium">
                    {BUG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={b.assignee_id || ''} onChange={e => updateBugAssignee(b.id, e.target.value)} onClick={e => e.stopPropagation()}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-ink-200 bg-white outline-none cursor-pointer max-w-[140px]">
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks — Kanban or List */}
      {tab === 'tasks' && taskView === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {KANBAN_COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col || (col === 'Completed' && t.status === 'Done'));
            return (
              <div key={col} className="flex-shrink-0 w-80" onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, col)}>
                <div className="card p-3 h-full min-h-[400px] bg-ink-50/40">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-semibold text-ink-800">{col}</h3>
                    <span className="chip bg-white text-ink-600 border-ink-200">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map(t => (
                      <Link key={t.id} to={`/tasks/${t.id}`} draggable onDragStart={e => onDragStart(e, t.id)}
                        className="block bg-white rounded-lg p-3 border border-ink-100 shadow-card hover:shadow-pop hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing">
                        <p className="text-sm font-semibold text-ink-900 line-clamp-2">{t.title}</p>
                        {t.description && <p className="text-xs text-ink-500 line-clamp-2 mt-1">{t.description}</p>}
                        <div className="flex items-center gap-2 mt-3">
                          <PriorityChip priority={t.priority} />
                          {t.due_date && <span className="text-[11px] text-ink-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> {t.due_date}</span>}
                          {t.assignee_name && (
                            <span className="ml-auto w-6 h-6 rounded-full bg-brand-gradient text-white flex items-center justify-center text-[10px] font-bold">
                              {t.assignee_name[0]}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                    {colTasks.length === 0 && <div className="text-xs text-ink-400 text-center py-6">Drop tasks here</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'tasks' && taskView === 'list' && (
        <div className="card overflow-hidden">
          {tasks.length === 0 ? (
            <div className="py-16 text-center text-ink-400"><CheckSquare className="w-10 h-10 mx-auto mb-2" /><p>No tasks found</p></div>
          ) : (
            <div className="divide-y divide-ink-100">
              {tasks.map(t => (
                <Link key={t.id} to={`/tasks/${t.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{t.title}</p>
                    <p className="text-xs text-ink-500 mt-0.5">by {t.created_by_name} · {t.due_date ? `Due ${t.due_date}` : 'No due date'}</p>
                  </div>
                  <PriorityChip priority={t.priority} />
                  <StatusChip status={t.status} />
                  {t.assignee_name && <span className="text-xs text-ink-500">{t.assignee_name}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members */}
      {tab === 'members' && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex gap-3">
              <button onClick={() => setShowMemberModal(true)} className="btn-primary"><UserPlus className="w-4 h-4" /> Add Existing User</button>
              <button onClick={() => { setShowInviteModal(true); setInviteStatus(null); setInviteEmail(''); }} className="btn-secondary"><Mail className="w-4 h-4" /> Invite by Email</button>
            </div>
          )}
          <div className="card divide-y divide-ink-100 overflow-hidden">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-full bg-brand-gradient text-white flex items-center justify-center text-sm font-bold">
                  {m.first_name[0]}{m.last_name[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink-900">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-ink-500">{m.email}</p>
                </div>
                <span className="chip bg-brand-50 text-brand-700 border-brand-200">{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Bug Modal */}
      {showBugModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowBugModal(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={createBug} className="card p-6 w-full max-w-3xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-ink-900">Report Bug</h2>
                <p className="text-sm text-ink-500">Capture every detail the dev team will need</p>
              </div>
              <button type="button" onClick={() => setShowBugModal(false)} className="text-ink-400 hover:text-ink-900"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="label">Summary *</label>
              <input type="text" value={bugForm.summary} onChange={e => setBugForm({...bugForm, summary: e.target.value})} required className="input" placeholder="One-line description of the bug" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea value={bugForm.description} onChange={e => setBugForm({...bugForm, description: e.target.value})} rows={3} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Steps to Reproduce</label>
                <textarea value={bugForm.steps_to_reproduce} onChange={e => setBugForm({...bugForm, steps_to_reproduce: e.target.value})} rows={3} className="input" />
              </div>
              <div>
                <label className="label">Expected Result</label>
                <textarea value={bugForm.expected_result} onChange={e => setBugForm({...bugForm, expected_result: e.target.value})} rows={3} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Actual Result</label>
              <textarea value={bugForm.actual_result} onChange={e => setBugForm({...bugForm, actual_result: e.target.value})} rows={2} className="input" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="label">Module</label><input value={bugForm.module} onChange={e => setBugForm({...bugForm, module: e.target.value})} className="input" placeholder="e.g. Checkout" /></div>
              <div><label className="label">Environment</label><input value={bugForm.environment} onChange={e => setBugForm({...bugForm, environment: e.target.value})} className="input" placeholder="Staging / Prod" /></div>
              <div><label className="label">Browser</label><input value={bugForm.browser} onChange={e => setBugForm({...bugForm, browser: e.target.value})} className="input" placeholder="Chrome 124" /></div>
              <div><label className="label">Device</label><input value={bugForm.device} onChange={e => setBugForm({...bugForm, device: e.target.value})} className="input" placeholder="Desktop / iOS" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">URL / Screen Path</label><input type="text" value={bugForm.url} onChange={e => setBugForm({...bugForm, url: e.target.value})} className="input" /></div>
              <div><label className="label">Due Date</label><input type="date" value={bugForm.due_date} onChange={e => setBugForm({...bugForm, due_date: e.target.value})} className="input" /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Assignee</label>
                <select value={bugForm.assignee_id} onChange={e => setBugForm({...bugForm, assignee_id: e.target.value})} className="input">
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">QA Owner</label>
                <select value={bugForm.qa_owner_id} onChange={e => setBugForm({...bugForm, qa_owner_id: e.target.value})} className="input">
                  <option value="">None</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select value={bugForm.priority} onChange={e => setBugForm({...bugForm, priority: e.target.value})} className="input">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Severity</label>
                <select value={bugForm.severity} onChange={e => setBugForm({...bugForm, severity: e.target.value})} className="input">
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Attachments</label>
              <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files))} className="text-sm text-ink-600 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:font-medium hover:file:bg-brand-100" />
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t border-ink-100">
              <button type="button" onClick={() => setShowBugModal(false)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Create Bug</button>
            </div>
          </form>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowTaskModal(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={createTask} className="card p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink-900">Create Task</h2>
              <button type="button" onClick={() => setShowTaskModal(false)} className="text-ink-400"><X className="w-5 h-5" /></button>
            </div>
            <div><label className="label">Title *</label><input type="text" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} required className="input" /></div>
            <div><label className="label">Description</label><textarea value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} rows={3} className="input" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Assignee</label>
                <select value={taskForm.assignee_id} onChange={e => setTaskForm({...taskForm, assignee_id: e.target.value})} className="input">
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})} className="input">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Due Date</label><input type="date" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} className="input" /></div>
              <div>
                <label className="label">Linked Bug</label>
                <select value={taskForm.linked_bug_id} onChange={e => setTaskForm({...taskForm, linked_bug_id: e.target.value})} className="input">
                  <option value="">None</option>
                  {bugs.map(b => <option key={b.id} value={b.id}>#{b.bug_number} {b.summary}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t border-ink-100">
              <button type="button" onClick={() => setShowTaskModal(false)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Create Task</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowMemberModal(false)}>
          <div onClick={e => e.stopPropagation()} className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-ink-900">Add Member</h2>
              <button onClick={() => setShowMemberModal(false)} className="text-ink-400"><X className="w-5 h-5" /></button>
            </div>
            {nonMembers.length === 0 ? <p className="text-sm text-ink-500">All users are already members</p> : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {nonMembers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 hover:bg-ink-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-gradient text-white flex items-center justify-center text-sm font-bold">{u.first_name[0]}{u.last_name[0]}</div>
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-ink-500">{u.email} · {u.role}</p>
                      </div>
                    </div>
                    <button onClick={() => { addMember(u.id); setShowMemberModal(false); }} className="btn-primary text-xs px-3 py-1.5">Add</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => { if (!inviteLoading) { setShowInviteModal(false); setInviteStatus(null); } }}>
          <form onClick={e => e.stopPropagation()} onSubmit={inviteByEmail} className="card p-6 w-full max-w-md space-y-4">
            <div>
              <h2 className="text-xl font-bold text-ink-900">Invite to {project.name}</h2>
              <p className="text-sm text-ink-500 mt-1">Send an email invitation to join this project.</p>
            </div>
            <div>
              <label className="label">Email address</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required disabled={inviteLoading} placeholder="colleague@example.com" className="input" />
            </div>
            {inviteStatus && (
              <div className={`text-sm px-4 py-3 rounded-lg border ${inviteStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {inviteStatus.message}
              </div>
            )}
            <div className="flex gap-3 justify-end pt-2 border-t border-ink-100">
              <button type="button" onClick={() => { setShowInviteModal(false); setInviteStatus(null); }} disabled={inviteLoading} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={inviteLoading} className="btn-primary min-w-[140px]">
                {inviteLoading ? 'Sending…' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Import Bugs Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-ink-100">
              <h3 className="text-lg font-semibold text-ink-900">Import bugs from Excel</h3>
              <button onClick={() => setShowImportModal(false)} className="text-ink-400 hover:text-ink-900"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-ink-600">
                Upload an <strong>.xlsx</strong> or <strong>.csv</strong> file with your bugs.
                The first row must contain column headers.
              </p>
              <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-xs text-ink-600">
                <div className="font-semibold text-ink-800 mb-1">Supported columns (case-insensitive)</div>
                <code className="block text-[11px] leading-relaxed">
                  summary* · description · steps_to_reproduce · expected_result · actual_result ·<br/>
                  url · status · priority · severity · module · environment · browser · device · due_date · assignee_email
                </code>
                <div className="mt-1 text-[11px] text-ink-500">* required</div>
              </div>

              <button onClick={downloadImportTemplate} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                <Download className="w-3 h-3" /> Download import template
              </button>

              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={e => { if (e.target.files?.[0]) handleImportFile(e.target.files[0]); }}
                className="hidden"
              />

              {!importStatus && (
                <button onClick={() => importInputRef.current?.click()} className="btn-primary w-full">
                  <Plus className="w-4 h-4" /> Choose file
                </button>
              )}

              {importStatus?.loading && (
                <div className="text-sm text-ink-600 text-center py-4">Importing…</div>
              )}

              {importStatus?.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {importStatus.error}
                </div>
              )}

              {importStatus?.result && (
                <div className="space-y-2">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                    Imported <strong>{importStatus.result.created}</strong> bugs
                    {importStatus.result.skipped > 0 && <> · skipped <strong>{importStatus.result.skipped}</strong></>}
                  </div>
                  {importStatus.result.errors?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 max-h-40 overflow-y-auto">
                      <div className="font-semibold mb-1">Row errors:</div>
                      <ul className="space-y-0.5">
                        {importStatus.result.errors.slice(0, 20).map((er, i) => (
                          <li key={i}>Row {er.row}: {er.error}</li>
                        ))}
                        {importStatus.result.errors.length > 20 && <li>…and {importStatus.result.errors.length - 20} more</li>}
                      </ul>
                    </div>
                  )}
                  <button onClick={() => { setImportStatus(null); setShowImportModal(false); }} className="btn-primary w-full">
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
