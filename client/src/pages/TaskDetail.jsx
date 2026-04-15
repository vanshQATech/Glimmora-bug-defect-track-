import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, MessageSquare, Send, Link2 } from 'lucide-react';

const TASK_STATUSES = ['To Do', 'In Progress', 'In Review', 'Blocked', 'Done'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

const statusColor = (s) => {
  const map = { 'To Do': 'bg-ink-100 text-ink-700', 'In Progress': 'bg-yellow-100 text-yellow-700', 'In Review': 'bg-blue-100 text-blue-700', 'Blocked': 'bg-red-100 text-red-700', 'Done': 'bg-green-100 text-green-700' };
  return map[s] || 'bg-ink-100 text-ink-700';
};

export default function TaskDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [members, setMembers] = useState([]);
  const [comment, setComment] = useState('');
  const [tab, setTab] = useState('details');

  const fetchTask = () => {
    api.get(`/tasks/${taskId}`).then(res => {
      setTask(res.data);
      api.get(`/projects/${res.data.project_id}`).then(r => setMembers(r.data.members || []));
    }).catch(() => navigate('/'));
  };

  useEffect(() => { fetchTask(); }, [taskId]);

  const updateTask = async (updates) => {
    try {
      await api.put(`/tasks/${taskId}`, updates);
      fetchTask();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await api.post(`/tasks/${taskId}/comments`, { content: comment });
      setComment('');
      fetchTask();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  if (!task) return <div className="text-center py-12 text-ink-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/projects/${task.project_id}`)} className="p-2 text-ink-400 hover:text-ink-600"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <span className={`text-xs px-2 py-1 rounded-full ${statusColor(task.status)}`}>{task.status}</span>
          <h1 className="text-xl font-bold text-ink-900 mt-1">{task.title}</h1>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs text-ink-500 mb-1">Status</label>
            <select value={task.status} onChange={e => updateTask({ status: e.target.value })}
              className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm outline-none">
              {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Priority</label>
            <select value={task.priority} onChange={e => updateTask({ priority: e.target.value })}
              className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Assignee</label>
            <select value={task.assignee_id || ''} onChange={e => updateTask({ assignee_id: e.target.value })}
              className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm outline-none">
              <option value="">Unassigned</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-ink-100">
        {['details', 'comments', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-700'}`}>
            {t} {t === 'comments' ? `(${task.comments?.length || 0})` : ''}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="bg-white card p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div><span className="text-ink-500">Created by:</span> <span className="font-medium ml-2">{task.created_by_name}</span></div>
            <div><span className="text-ink-500">Assignee:</span> <span className="font-medium ml-2">{task.assignee_name || 'Unassigned'}</span></div>
            <div><span className="text-ink-500">Due date:</span> <span className="ml-2">{task.due_date || 'None'}</span></div>
            <div><span className="text-ink-500">Created:</span> <span className="ml-2">{new Date(task.created_at).toLocaleString()}</span></div>
          </div>
          {task.description && <div><h4 className="text-sm font-medium text-ink-700 mb-1">Description</h4><p className="text-sm text-ink-600 whitespace-pre-wrap">{task.description}</p></div>}
          {task.linked_bug_id && (
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-ink-400" />
              <Link to={`/bugs/${task.linked_bug_id}`} className="text-sm text-brand-600 hover:underline">
                Linked Bug #{task.linked_bug_number}: {task.linked_bug_summary}
              </Link>
            </div>
          )}
        </div>
      )}

      {tab === 'comments' && (
        <div className="space-y-4">
          {task.comments?.length === 0 && <p className="text-sm text-ink-400">No comments yet</p>}
          {task.comments?.map(c => (
            <div key={c.id} className="bg-white card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold">
                  {c.user_name?.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="text-sm font-medium">{c.user_name}</span>
                <span className="text-xs text-ink-400">{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-ink-700 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-3">
            <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..."
              className="flex-1 px-4 py-2.5 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-300" />
            <button type="submit" className="px-4 py-2.5 bg-brand-gradient text-white rounded-lg ">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white card p-5">
          {task.history?.length === 0 ? <p className="text-sm text-ink-400">No history</p> : (
            <div className="space-y-3">
              {task.history?.map(h => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-medium">{h.user_name}</span>
                    <span className="text-ink-500"> {h.action}</span>
                    {h.field_changed && <span className="text-ink-500"> {h.field_changed}: </span>}
                    {h.old_value && <span className="text-red-500 line-through">{h.old_value}</span>}
                    {h.old_value && h.new_value && <span className="text-ink-400"> → </span>}
                    {h.new_value && <span className="text-green-600">{h.new_value}</span>}
                    <span className="text-ink-400 text-xs ml-2">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
