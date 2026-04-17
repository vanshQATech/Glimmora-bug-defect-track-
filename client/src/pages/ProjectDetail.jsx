import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { API_BASE } from '../utils/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import StatusChip, { PriorityChip } from '../components/StatusChip';
import { BUG_STATUSES, TASK_STATUSES, PRIORITIES, SEVERITIES } from '../utils/constants';
import {
  Plus, Bug, CheckSquare, Users, Search, Download, ArrowLeft, UserPlus, Mail,
  X, Layers, List, Calendar, FolderKanban, Trash2, BarChart3
} from 'lucide-react';

const KANBAN_COLUMNS = ['To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'];

const STATUS_PALETTE = {
  'New':                        { grad: 'from-slate-300 to-slate-500',     dot: 'bg-slate-500',   text: 'text-slate-700' },
  'Open':                       { grad: 'from-blue-300 to-blue-500',       dot: 'bg-blue-500',    text: 'text-blue-700' },
  'In Progress':                { grad: 'from-amber-300 to-amber-500',     dot: 'bg-amber-500',   text: 'text-amber-700' },
  'Fixed':                      { grad: 'from-teal-300 to-teal-500',       dot: 'bg-teal-500',    text: 'text-teal-700' },
  'Under Deployment':           { grad: 'from-cyan-300 to-cyan-500',       dot: 'bg-cyan-500',    text: 'text-cyan-700' },
  'Failed':                     { grad: 'from-red-300 to-red-500',         dot: 'bg-red-500',     text: 'text-red-700' },
  'Ready for Testing':          { grad: 'from-purple-300 to-purple-500',   dot: 'bg-purple-500',  text: 'text-purple-700' },
  'Checked by QA':              { grad: 'from-emerald-300 to-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  'Checked by Project Manager': { grad: 'from-green-300 to-green-500',     dot: 'bg-green-500',   text: 'text-green-700' },
  'Approved by PM':             { grad: 'from-brand-300 to-brand-600',     dot: 'bg-brand-600',   text: 'text-brand-700' },
};

function BugStatusChart({ bugs }) {
  const total = bugs.length;
  const counts = BUG_STATUSES.reduce((acc, s) => {
    acc[s] = bugs.filter(b => b.status === s).length;
    return acc;
  }, {});
  const rawMax = Math.max(...Object.values(counts), 1);
  const niceMax = rawMax <= 5 ? 5 : Math.ceil(rawMax / 5) * 5;
  const gridlines = [niceMax, Math.round(niceMax * 0.75), Math.round(niceMax * 0.5), Math.round(niceMax * 0.25), 0];
  const CHART_H = 220;

  return (
    <div className="mt-6 rounded-2xl border border-ink-100 bg-gradient-to-br from-white via-ink-50/30 to-brand-50/20 p-5 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-card">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink-900">Bug Status Overview</h3>
            <p className="text-xs text-ink-500">Distribution across workflow stages</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-brand-gradient px-5 py-2.5 shadow-card">
          <div className="text-[10px] uppercase tracking-widest text-white/80 font-semibold">Total</div>
          <div className="text-3xl font-bold text-white leading-none">{total}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex gap-3" style={{ height: CHART_H + 12 }}>
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between text-[10px] text-ink-400 font-medium py-1 pr-1 w-6 text-right">
          {gridlines.map(g => <div key={g}>{g}</div>)}
        </div>

        {/* Plot area */}
        <div className="relative flex-1">
          {/* Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between py-1">
            {gridlines.map((_, i) => (
              <div
                key={i}
                className={`border-t ${i === gridlines.length - 1 ? 'border-ink-200' : 'border-dashed border-ink-100'}`}
              />
            ))}
          </div>

          {/* Bars */}
          <div className="absolute inset-0 flex items-end justify-between gap-1.5 py-1">
            {BUG_STATUSES.map(s => {
              const val = counts[s];
              const pct = niceMax > 0 ? (val / niceMax) * 100 : 0;
              const { grad } = STATUS_PALETTE[s] || { grad: 'from-ink-300 to-ink-500' };
              return (
                <div key={s} className="group relative flex-1 h-full flex flex-col items-center justify-end">
                  {/* tooltip */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity bg-ink-900 text-white text-[10px] font-medium px-2 py-1 rounded-md whitespace-nowrap z-10 pointer-events-none shadow-pop">
                    {s}: <span className="font-bold">{val}</span>
                  </div>
                  {/* count label */}
                  {val > 0 && (
                    <div className="text-[11px] font-bold text-ink-900 mb-1 tabular-nums">{val}</div>
                  )}
                  {/* bar */}
                  <div
                    className={`w-full max-w-[44px] rounded-t-lg bg-gradient-to-t ${grad} shadow-sm group-hover:shadow-pop group-hover:-translate-y-0.5 transition-all duration-300`}
                    style={{ height: val > 0 ? `${Math.max(pct, 3)}%` : '2px', opacity: val > 0 ? 1 : 0.25 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t border-ink-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2">
        {BUG_STATUSES.map(s => {
          const { dot, text } = STATUS_PALETTE[s] || { dot: 'bg-ink-400', text: 'text-ink-700' };
          return (
            <div key={s} className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0`} />
              <span className="text-[11px] text-ink-600 font-medium truncate flex-1" title={s}>{s}</span>
              <span className={`text-[11px] font-bold ${text} tabular-nums`}>{counts[s]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const [filterAssignee, setFilterAssignee] = useState('');
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
    api.get(`/bugs/project/${projectId}`, { params: { search, status: filterStatus, priority: filterPriority, assignee_id: filterAssignee } }).then(r => setBugs(r.data));
    api.get(`/tasks/project/${projectId}`, { params: { search, status: filterStatus, priority: filterPriority } }).then(r => setTasks(r.data));
    api.get('/users').then(r => setAllUsers(r.data));
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [projectId, search, filterStatus, filterPriority, filterAssignee]);

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
    catch (err) {
      const msg = err.response?.data?.error || err.response?.statusText || err.message || 'Failed';
      const status = err.response?.status ? `[${err.response.status}] ` : '';
      alert(`${status}${msg}`);
      console.error('updateBugAssignee error:', err);
    }
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

  const exportBugsPdf = () => {
    if (!bugs || bugs.length === 0) { alert('No bugs to export'); return; }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const projectName = project?.name || 'Project';
    const generatedAt = new Date().toLocaleString();

    doc.setFontSize(16);
    doc.setTextColor(40);
    doc.text(`${projectName} — Bug Report`, 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Generated: ${generatedAt}`, 40, 58);
    doc.text(`Total bugs: ${bugs.length}`, 40, 72);

    const rows = bugs.map(b => [
      b.bug_number ? `#${b.bug_number}` : '—',
      b.summary || '',
      b.status || '',
      b.priority || '',
      b.severity || '',
      b.assignee_name || '—',
      b.reporter_name || '—',
      b.created_at ? new Date(b.created_at).toLocaleDateString() : '',
    ]);

    autoTable(doc, {
      head: [['ID', 'Summary', 'Status', 'Priority', 'Severity', 'Assignee', 'Reporter', 'Created']],
      body: rows,
      startY: 90,
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 260 },
        2: { cellWidth: 70 },
        3: { cellWidth: 60 },
        4: { cellWidth: 60 },
        5: { cellWidth: 90 },
        6: { cellWidth: 90 },
        7: { cellWidth: 70 },
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}  ·  Glimmora DefectDesk`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 20
        );
      },
    });

    const safeName = projectName.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    doc.save(`bugs_${safeName}_${Date.now()}.pdf`);
  };

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

        <BugStatusChart bugs={bugs} />
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
            <button key={t.id} onClick={() => { setTab(t.id); setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); }}
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
          {tab === 'bugs' && (
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="input w-auto">
              <option value="">All Assignees</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          )}
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
              <button onClick={exportBugsPdf} className="btn-secondary"><Download className="w-4 h-4" /> PDF</button>
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
                  {importStatus.result.header_map && (
                    <div className="bg-ink-50 border border-ink-100 rounded-lg p-3 text-[11px] text-ink-600 max-h-40 overflow-y-auto">
                      <div className="font-semibold text-ink-800 mb-1">Detected columns → mapped to</div>
                      <ul className="space-y-0.5 font-mono">
                        {Object.entries(importStatus.result.header_map).map(([raw, mapped]) => (
                          <li key={raw}>
                            <span className="text-ink-700">{raw}</span>
                            <span className="text-ink-400"> → </span>
                            <span className="text-brand-600">{mapped}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
