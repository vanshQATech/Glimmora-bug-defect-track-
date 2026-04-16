import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { API_BASE } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StatusChip, { PriorityChip } from '../components/StatusChip';
import { BUG_STATUSES, PRIORITIES, SEVERITIES } from '../utils/constants';
import {
  ArrowLeft, Paperclip, MessageSquare, Send, FileDown, ExternalLink,
  Calendar, User, Bug as BugIcon, Activity, Clock, Plus
} from 'lucide-react';

export default function BugDetail() {
  const { bugId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bug, setBug] = useState(null);
  const [members, setMembers] = useState([]);
  const [comment, setComment] = useState('');
  const [editForm, setEditForm] = useState({});

  const fetchBug = () => {
    api.get(`/bugs/${bugId}`).then(res => {
      setBug(res.data);
      setEditForm({
        status: res.data.status,
        priority: res.data.priority,
        severity: res.data.severity,
        assignee_id: res.data.assignee_id || '',
        qa_owner_id: res.data.qa_owner_id || '',
      });
      api.get(`/projects/${res.data.project_id}`).then(r => setMembers(r.data.members || []));
    }).catch(() => navigate('/'));
  };

  useEffect(() => { fetchBug(); /* eslint-disable-next-line */ }, [bugId]);

  const updateBug = async (updates) => {
    try { await api.put(`/bugs/${bugId}`, updates); fetchBug(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try { await api.post(`/bugs/${bugId}/comments`, { content: comment }); setComment(''); fetchBug(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const uploadAttachments = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const formData = new FormData();
    files.forEach(f => formData.append('attachments', f));
    try {
      await api.post(`/bugs/${bugId}/attachments`, formData);
      fetchBug();
    } catch (err) { alert(err.response?.data?.error || 'Upload failed'); }
    e.target.value = '';
  };

  const downloadPdf = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/bugs/${bugId}/pdf?token=${token}`, '_blank');
  };

  if (!bug) return <div className="space-y-4 max-w-6xl mx-auto"><div className="skeleton h-24" /><div className="skeleton h-64" /></div>;

  const Section = ({ title, children }) => (
    <div>
      <h4 className="text-[11px] uppercase tracking-wide font-semibold text-ink-500 mb-1.5">{title}</h4>
      <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">{children}</p>
    </div>
  );

  const metaRow = (label, value) => value ? (
    <div className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-sm text-ink-800 font-medium text-right">{value}</span>
    </div>
  ) : null;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Top bar */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate(`/projects/${bug.project_id}`)} className="btn-ghost p-2 flex-shrink-0"><ArrowLeft className="w-5 h-5" /></button>
          <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center shadow-card flex-shrink-0">
            <BugIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100">#{bug.bug_number}</span>
              <StatusChip status={bug.status} />
              <PriorityChip priority={bug.priority} />
            </div>
            <h1 className="text-2xl font-bold text-ink-900 mt-2 tracking-tight">{bug.summary}</h1>
          </div>
          <button onClick={downloadPdf} className="btn-primary"><FileDown className="w-4 h-4" /> Download PDF</button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 space-y-5">
            <h3 className="section-title">Description</h3>
            {bug.description ? <Section>{bug.description}</Section> : <p className="text-sm text-ink-400 italic">No description provided.</p>}
          </div>

          {(bug.steps_to_reproduce || bug.expected_result || bug.actual_result) && (
            <div className="card p-6 space-y-5">
              <h3 className="section-title">Reproduction</h3>
              {bug.steps_to_reproduce && <Section title="Steps to Reproduce">{bug.steps_to_reproduce}</Section>}
              {bug.expected_result && <Section title="Expected Result">{bug.expected_result}</Section>}
              {bug.actual_result && <Section title="Actual Result">{bug.actual_result}</Section>}
            </div>
          )}

          {/* Attachments */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title flex items-center gap-2"><Paperclip className="w-4 h-4 text-brand-600" /> Attachments <span className="text-ink-400 font-normal">({bug.attachments?.length || 0})</span></h3>
              <label className="btn-ghost p-2 cursor-pointer flex items-center gap-1 text-xs">
                <Plus className="w-4 h-4" /> Add Files
                <input type="file" multiple className="hidden" onChange={uploadAttachments} />
              </label>
            </div>
            {bug.attachments?.length === 0 ? (
              <p className="text-sm text-ink-400 italic">No files attached.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {bug.attachments?.map(a => (
                  <a key={a.id} href={`${API_BASE}/uploads/${a.filename}`} target="_blank" rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden border border-ink-100 hover:shadow-pop hover:-translate-y-0.5 transition-all">
                    {a.mimetype?.startsWith('image/') ? (
                      <img src={`${API_BASE}/uploads/${a.filename}`} alt={a.original_name} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 bg-brand-50 flex items-center justify-center">
                        <Paperclip className="w-10 h-10 text-brand-400" />
                      </div>
                    )}
                    <p className="text-xs text-ink-600 truncate p-2 border-t border-ink-100">{a.original_name}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — activity rail */}
        <div className="space-y-6">
          {/* Meta */}
          <div className="card p-5">
            <h3 className="section-title mb-3">Details</h3>
            <div className="space-y-0.5">
              <div className="py-2">
                <label className="label">Status</label>
                <select value={editForm.status || ''} onChange={e => { setEditForm({...editForm, status: e.target.value}); updateBug({ status: e.target.value }); }} className="input">
                  {BUG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="py-2">
                <label className="label">Priority</label>
                <select value={editForm.priority || ''} onChange={e => { setEditForm({...editForm, priority: e.target.value}); updateBug({ priority: e.target.value }); }} className="input">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="py-2">
                <label className="label">Severity</label>
                <select value={editForm.severity || ''} onChange={e => { setEditForm({...editForm, severity: e.target.value}); updateBug({ severity: e.target.value }); }} className="input">
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="py-2">
                <label className="label">Assignee</label>
                <select value={editForm.assignee_id || ''} onChange={e => { setEditForm({...editForm, assignee_id: e.target.value}); updateBug({ assignee_id: e.target.value || null }); }} className="input">
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
              <div className="py-2">
                <label className="label">QA Owner</label>
                <select value={editForm.qa_owner_id || ''} onChange={e => { setEditForm({...editForm, qa_owner_id: e.target.value}); updateBug({ qa_owner_id: e.target.value || null }); }} className="input">
                  <option value="">None</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
            </div>
            <div className="divider my-4" />
            {metaRow('Reporter', bug.reporter_name)}
            {metaRow('Module', bug.module)}
            {metaRow('Environment', bug.environment)}
            {metaRow('Browser', bug.browser)}
            {metaRow('Device', bug.device)}
            {metaRow('Due Date', bug.due_date)}
            {bug.url && (
              <div className="py-2">
                <span className="text-xs text-ink-500">URL</span>
                <a href={bug.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-brand-700 hover:underline truncate">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{bug.url}</span>
                </a>
              </div>
            )}
            {metaRow('Created', new Date(bug.created_at).toLocaleString())}
            {metaRow('Updated', new Date(bug.updated_at).toLocaleString())}
          </div>

          {/* Comments */}
          <div className="card p-5">
            <h3 className="section-title mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-brand-600" /> Comments <span className="text-ink-400 font-normal">({bug.comments?.length || 0})</span></h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {bug.comments?.length === 0 && <p className="text-sm text-ink-400 italic">Be the first to comment.</p>}
              {bug.comments?.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-gradient text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {c.user_name?.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-ink-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-ink-900">{c.user_name}</span>
                        <span className="text-[11px] text-ink-400">{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-ink-700 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={addComment} className="flex gap-2 mt-4 pt-4 border-t border-ink-100">
              <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment…" className="input flex-1" />
              <button type="submit" className="btn-primary px-3"><Send className="w-4 h-4" /></button>
            </form>
          </div>

          {/* Activity */}
          <div className="card p-5">
            <h3 className="section-title mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-brand-600" /> Activity</h3>
            {bug.history?.length === 0 ? <p className="text-sm text-ink-400 italic">No activity yet.</p> : (
              <div className="relative space-y-4 max-h-96 overflow-y-auto pr-1">
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-ink-100" />
                {bug.history?.map(h => (
                  <div key={h.id} className="flex gap-3 relative">
                    <div className="w-6 h-6 rounded-full bg-white border-2 border-brand-300 flex items-center justify-center flex-shrink-0 z-10">
                      <Clock className="w-3 h-3 text-brand-600" />
                    </div>
                    <div className="flex-1 text-sm pb-1">
                      <p className="text-ink-800">
                        <span className="font-semibold">{h.user_name}</span>
                        <span className="text-ink-500"> {h.action}</span>
                        {h.field_changed && <span className="text-ink-500"> {h.field_changed}</span>}
                      </p>
                      {(h.old_value || h.new_value) && (
                        <p className="text-xs mt-0.5">
                          {h.old_value && <span className="text-ink-400 line-through">{h.old_value}</span>}
                          {h.old_value && h.new_value && <span className="text-ink-400 mx-1">→</span>}
                          {h.new_value && <span className="text-brand-700 font-medium">{h.new_value}</span>}
                        </p>
                      )}
                      <p className="text-[11px] text-ink-400 mt-0.5">{new Date(h.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
