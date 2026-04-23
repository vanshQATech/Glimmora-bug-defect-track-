import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { API_ORIGIN } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { PRIORITIES, SEVERITIES } from '../utils/constants';
import {
  ArrowLeft, ClipboardCheck, CheckCircle2, XCircle, MinusCircle, Clock,
  Bug, Link2, PlayCircle, Save, X, History, Edit3, Trash2,
  Paperclip, Upload, FileText,
} from 'lucide-react';

const TC_STATUSES = ['Not Run', 'Pass', 'Fail', 'Blocked'];
const CASE_TYPES = ['Positive', 'Negative', 'Edge'];

const CASE_TYPE_CHIP = {
  'Positive': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Negative': 'bg-red-50 text-red-700 border-red-200',
  'Edge':     'bg-purple-50 text-purple-700 border-purple-200',
};

const attachmentUrl = (filename) => `${API_ORIGIN}/api/uploads/${filename}`;

const STATUS_CHIP = {
  'Pass':    'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Fail':    'bg-red-50 text-red-700 border-red-200',
  'Blocked': 'bg-amber-50 text-amber-700 border-amber-200',
  'Not Run': 'bg-ink-100 text-ink-600 border-ink-200',
};
const STATUS_ICON = {
  'Pass':    CheckCircle2,
  'Fail':    XCircle,
  'Blocked': MinusCircle,
  'Not Run': Clock,
};

export default function TestCaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tc, setTc] = useState(null);
  const [members, setMembers] = useState([]);
  const [projectBugs, setProjectBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);

  const [exec, setExec] = useState({
    status: 'Pass',
    actual_result: '',
    comments: '',
    linked_bug_id: '',
    auto_create_bug: true,
  });
  const [execFiles, setExecFiles] = useState([]);
  const [caseFiles, setCaseFiles] = useState([]);
  const [uploadingCaseFiles, setUploadingCaseFiles] = useState(false);

  const [editForm, setEditForm] = useState({
    title: '', description: '', preconditions: '', steps: '', expected_result: '',
    priority: 'Medium', severity: 'Major', case_type: 'Positive', assignee_id: '',
  });

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateBugModal, setShowCreateBugModal] = useState(false);
  const [bugForm, setBugForm] = useState({
    summary: '', description: '', steps_to_reproduce: '',
    expected_result: '', actual_result: '',
    priority: 'High', severity: 'Major', assignee_id: '',
  });

  const fetchCase = async () => {
    try {
      const r = await api.get(`/testcases/cases/${caseId}`);
      setTc(r.data);
      setEditForm({
        title: r.data.title || '',
        description: r.data.description || '',
        preconditions: r.data.preconditions || '',
        steps: r.data.steps || '',
        expected_result: r.data.expected_result || '',
        priority: r.data.priority || 'Medium',
        severity: r.data.severity || 'Major',
        case_type: r.data.case_type || 'Positive',
        assignee_id: r.data.assignee_id || '',
      });
      setExec(e => ({ ...e, actual_result: r.data.actual_result || '' }));

      // Load project members + bugs for linking/assignment
      const [proj, bugsRes] = await Promise.all([
        api.get(`/projects/${r.data.project_id}`),
        api.get(`/bugs/project/${r.data.project_id}`),
      ]);
      setMembers(proj.data.members || []);
      setProjectBugs(bugsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCase(); }, [caseId]);

  const saveCase = async () => {
    setSaving(true);
    try {
      await api.put(`/testcases/cases/${caseId}`, {
        ...editForm,
        assignee_id: editForm.assignee_id || null,
      });
      setEdit(false);
      fetchCase();
    } catch (err) {
      alert(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteCase = async () => {
    if (!window.confirm(`Delete test case TC-${tc.tc_number}?`)) return;
    try {
      await api.delete(`/testcases/cases/${caseId}`);
      navigate(`/test-cases/${tc.project_id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const recordExecution = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('status', exec.status);
      fd.append('actual_result', exec.actual_result || '');
      fd.append('comments', exec.comments || '');
      if (exec.linked_bug_id) fd.append('linked_bug_id', exec.linked_bug_id);
      // Only ask server to auto-create bug on Fail and when user did not manually pick an existing bug
      if (exec.status === 'Fail' && exec.auto_create_bug && !exec.linked_bug_id) {
        fd.append('auto_create_bug', 'true');
      }
      execFiles.forEach(f => fd.append('attachments', f));

      const r = await api.post(`/testcases/cases/${caseId}/execute`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setExec({ status: 'Pass', actual_result: '', comments: '', linked_bug_id: '', auto_create_bug: true });
      setExecFiles([]);
      await fetchCase();

      if (r.data.created_bug) {
        const bugNum = r.data.created_bug.bug_number;
        if (window.confirm(`Failure logged and bug #${bugNum} auto-created in this project. Open the bug now?`)) {
          navigate(`/bugs/${r.data.created_bug.id}`);
        }
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Execution failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadCaseFiles = async (e) => {
    e.preventDefault();
    if (caseFiles.length === 0) return;
    setUploadingCaseFiles(true);
    try {
      const fd = new FormData();
      caseFiles.forEach(f => fd.append('attachments', f));
      await api.post(`/testcases/cases/${caseId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCaseFiles([]);
      fetchCase();
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingCaseFiles(false);
    }
  };

  const deleteAttachment = async (attId) => {
    if (!window.confirm('Remove this attachment?')) return;
    try {
      await api.delete(`/testcases/attachments/${attId}`);
      fetchCase();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const linkExistingBug = async (bugId) => {
    try {
      await api.post(`/testcases/cases/${caseId}/link-bug`, { bug_id: bugId });
      setShowLinkModal(false);
      fetchCase();
    } catch (err) {
      alert(err.response?.data?.error || 'Link failed');
    }
  };

  const unlinkBug = async () => {
    try {
      await api.put(`/testcases/cases/${caseId}`, { linked_bug_id: '' });
      fetchCase();
    } catch (err) {
      alert(err.response?.data?.error || 'Unlink failed');
    }
  };

  const openCreateBug = () => {
    setBugForm({
      summary: tc?.title ? `[TC-${tc.tc_number}] ${tc.title}` : '',
      description: tc?.description || '',
      steps_to_reproduce: tc?.steps || '',
      expected_result: tc?.expected_result || '',
      actual_result: tc?.actual_result || exec.actual_result || '',
      priority: tc?.priority || 'High',
      severity: tc?.severity || 'Major',
      assignee_id: tc?.assignee_id || '',
    });
    setShowCreateBugModal(true);
  };

  const submitCreateBug = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post(`/testcases/cases/${caseId}/create-bug`, {
        ...bugForm,
        assignee_id: bugForm.assignee_id || null,
      });
      setShowCreateBugModal(false);
      fetchCase();
      // Optional: navigate to bug
      if (window.confirm('Bug created. Open it now?')) {
        navigate(`/bugs/${r.data.id}`);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Bug creation failed');
    }
  };

  if (loading || !tc) {
    return <div className="p-10 text-center text-ink-500">Loading…</div>;
  }

  const Icon = STATUS_ICON[tc.status] || Clock;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div>
        <Link to={`/test-cases/${tc.project_id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to {tc.project_name}
        </Link>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center shadow-card flex-shrink-0">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded">TC-{tc.tc_number}</span>
                <span className={`chip ${STATUS_CHIP[tc.status]}`}>
                  <Icon className="w-3 h-3" />
                  {tc.status}
                </span>
                <span className={`chip ${CASE_TYPE_CHIP[tc.case_type] || 'bg-ink-100 text-ink-600 border-ink-200'}`}>{tc.case_type || 'Positive'}</span>
                <span className="chip bg-ink-100 text-ink-700 border-ink-200">{tc.priority}</span>
                <span className="chip bg-ink-100 text-ink-700 border-ink-200">{tc.severity}</span>
              </div>
              <h1 className="text-2xl font-bold text-ink-900 tracking-tight">{tc.title}</h1>
              <p className="text-sm text-ink-500 mt-1">
                Scenario: <span className="font-medium text-ink-700">{tc.scenario_name}</span>
                {tc.assignee_name && <> · Assigned to <span className="font-medium text-ink-700">{tc.assignee_name}</span></>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {edit ? (
              <>
                <button onClick={() => setEdit(false)} className="btn-ghost"><X className="w-4 h-4" /> Cancel</button>
                <button onClick={saveCase} disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> Save</button>
              </>
            ) : (
              <>
                <button onClick={() => setEdit(true)} className="btn-secondary"><Edit3 className="w-4 h-4" /> Edit</button>
                <button onClick={deleteCase} className="btn-ghost text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /> Delete</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details card */}
          <div className="card p-6 space-y-5">
            <DetailField
              label="Description"
              value={tc.description}
              edit={edit}
              onChange={v => setEditForm({ ...editForm, description: v })}
              editValue={editForm.description}
              multiline
            />
            <DetailField
              label="Pre-conditions"
              value={tc.preconditions}
              edit={edit}
              onChange={v => setEditForm({ ...editForm, preconditions: v })}
              editValue={editForm.preconditions}
              multiline
            />
            <DetailField
              label="Test Steps"
              value={tc.steps}
              edit={edit}
              onChange={v => setEditForm({ ...editForm, steps: v })}
              editValue={editForm.steps}
              multiline
              mono
            />
            <DetailField
              label="Expected Result"
              value={tc.expected_result}
              edit={edit}
              onChange={v => setEditForm({ ...editForm, expected_result: v })}
              editValue={editForm.expected_result}
              multiline
            />
            <DetailField
              label="Latest Actual Result"
              value={tc.actual_result}
              edit={false}
              multiline
              emptyLabel="No execution yet"
            />

            {edit && (
              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-ink-100">
                <div>
                  <label className="label">Case Type</label>
                  <select value={editForm.case_type} onChange={e => setEditForm({ ...editForm, case_type: e.target.value })} className="input">
                    {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Assignee</label>
                  <select value={editForm.assignee_id} onChange={e => setEditForm({ ...editForm, assignee_id: e.target.value })} className="input">
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value })} className="input">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Severity</label>
                  <select value={editForm.severity} onChange={e => setEditForm({ ...editForm, severity: e.target.value })} className="input">
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Attachments on the test case */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-brand-600" />
                <h2 className="section-title">Attachments</h2>
                <span className="text-xs text-ink-500">
                  {(tc.attachments || []).filter(a => !a.execution_id).length}
                </span>
              </div>
            </div>
            <AttachmentGallery
              attachments={(tc.attachments || []).filter(a => !a.execution_id)}
              onDelete={deleteAttachment}
              emptyText="No files attached to this test case. Add screenshots, specs, or reference docs."
            />
            <form onSubmit={uploadCaseFiles} className="mt-4 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                onChange={e => setCaseFiles(Array.from(e.target.files || []))}
                className="input flex-1"
              />
              <button
                type="submit"
                disabled={caseFiles.length === 0 || uploadingCaseFiles}
                className="btn-primary whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                {uploadingCaseFiles ? 'Uploading…' : `Upload${caseFiles.length ? ` (${caseFiles.length})` : ''}`}
              </button>
            </form>
          </div>

          {/* Execution form */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
                <PlayCircle className="w-4 h-4 text-white" />
              </div>
              <h2 className="section-title">Execute Test</h2>
            </div>
            <form onSubmit={recordExecution} className="space-y-4">
              <div>
                <label className="label">Result</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Pass', 'Fail', 'Blocked'].map(s => {
                    const I = STATUS_ICON[s];
                    const active = exec.status === s;
                    const styles = {
                      'Pass':    active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
                      'Fail':    active ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200 hover:bg-red-50',
                      'Blocked': active ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
                    };
                    return (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setExec({ ...exec, status: s })}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-sm transition ${styles[s]}`}
                      >
                        <I className="w-4 h-4" /> {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="label">Actual Result</label>
                <textarea
                  rows={3}
                  value={exec.actual_result}
                  onChange={e => setExec({ ...exec, actual_result: e.target.value })}
                  className="input"
                  placeholder="What actually happened?"
                />
              </div>

              <div>
                <label className="label">Comments</label>
                <textarea
                  rows={2}
                  value={exec.comments}
                  onChange={e => setExec({ ...exec, comments: e.target.value })}
                  className="input"
                  placeholder="Environment details, notes, console output…"
                />
              </div>

              <div>
                <label className="label flex items-center gap-2">
                  <Paperclip className="w-3 h-3" /> Evidence (screenshots, logs)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                  onChange={e => setExecFiles(Array.from(e.target.files || []))}
                  className="input"
                />
                {execFiles.length > 0 && (
                  <p className="text-xs text-ink-500 mt-1">
                    {execFiles.length} file{execFiles.length === 1 ? '' : 's'} attached to this execution
                  </p>
                )}
              </div>

              {exec.status === 'Fail' && (
                <div className="rounded-lg bg-red-50/60 border border-red-100 p-3 space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exec.auto_create_bug}
                      onChange={e => setExec({ ...exec, auto_create_bug: e.target.checked })}
                      disabled={!!exec.linked_bug_id}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-red-800 flex items-center gap-1.5">
                        <Bug className="w-3.5 h-3.5" /> Auto-create bug in this project
                      </div>
                      <p className="text-xs text-red-700/80 mt-0.5">
                        A bug will be opened in <span className="font-semibold">{tc.project_name}</span> pre-filled
                        from this test case, and any attachments above will be copied as evidence.
                      </p>
                    </div>
                  </label>

                  <div>
                    <label className="label text-red-900">…or link an existing bug</label>
                    <select
                      value={exec.linked_bug_id}
                      onChange={e => setExec({ ...exec, linked_bug_id: e.target.value })}
                      className="input"
                    >
                      <option value="">— None —</option>
                      {projectBugs.map(b => (
                        <option key={b.id} value={b.id}>
                          #{b.bug_number} · {b.summary}
                        </option>
                      ))}
                    </select>
                    {exec.linked_bug_id && (
                      <p className="text-[11px] text-red-700 mt-1">
                        Auto-create is disabled because you linked an existing bug.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="btn-primary">
                  <PlayCircle className="w-4 h-4" /> {saving ? 'Recording…' : 'Record Execution'}
                </button>
              </div>
            </form>
          </div>

          {/* Execution history */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-brand-600" />
              <h2 className="section-title">Execution History</h2>
              <span className="ml-auto text-xs text-ink-500">{tc.executions?.length || 0} run{tc.executions?.length === 1 ? '' : 's'}</span>
            </div>
            {(!tc.executions || tc.executions.length === 0) ? (
              <p className="text-sm text-ink-500">No executions yet. Run the test above to record the first result.</p>
            ) : (
              <ul className="space-y-3">
                {tc.executions.map(ex => {
                  const EI = STATUS_ICON[ex.status] || Clock;
                  const evidence = (tc.attachments || []).filter(a => a.execution_id === ex.id);
                  return (
                    <li key={ex.id} className="border border-ink-100 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`chip ${STATUS_CHIP[ex.status]}`}><EI className="w-3 h-3" /> {ex.status}</span>
                          <span className="text-xs text-ink-500">
                            by {ex.executed_by_name} · {new Date(ex.executed_at).toLocaleString()}
                          </span>
                        </div>
                        {ex.linked_bug_id && (
                          <Link to={`/bugs/${ex.linked_bug_id}`} className="text-xs font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded">
                            #{ex.exec_bug_number}
                          </Link>
                        )}
                      </div>
                      {ex.actual_result && (
                        <p className="text-sm text-ink-700 mt-1"><span className="text-xs text-ink-500 font-semibold uppercase tracking-wide">Actual:</span> {ex.actual_result}</p>
                      )}
                      {ex.comments && (
                        <p className="text-sm text-ink-600 mt-1 italic">{ex.comments}</p>
                      )}
                      {evidence.length > 0 && (
                        <div className="mt-2">
                          <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold mb-1.5">Evidence</div>
                          <AttachmentGallery attachments={evidence} onDelete={deleteAttachment} compact />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="space-y-5">
          {/* Linked bug */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bug className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-semibold text-ink-900">Linked Bug</h3>
            </div>
            {tc.linked_bug_id ? (
              <div className="space-y-2">
                <Link to={`/bugs/${tc.linked_bug_id}`} className="block border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg p-3 transition">
                  <div className="text-xs font-mono text-red-700 mb-1">#{tc.linked_bug_number}</div>
                  <div className="text-sm font-medium text-ink-900">{tc.linked_bug_summary}</div>
                  <div className="text-xs text-ink-500 mt-1">Status: {tc.linked_bug_status}</div>
                </Link>
                <button onClick={unlinkBug} className="btn-ghost w-full text-xs">
                  <X className="w-3.5 h-3.5" /> Unlink
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-ink-500">No bug linked. Link an existing bug or create one from this test case.</p>
                <button onClick={() => setShowLinkModal(true)} className="btn-secondary w-full">
                  <Link2 className="w-4 h-4" /> Link Existing Bug
                </button>
                <button onClick={openCreateBug} className="btn-primary w-full">
                  <Bug className="w-4 h-4" /> Create Bug from Failure
                </button>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="card p-5 space-y-3 text-sm">
            <MetaRow label="Case Type" value={tc.case_type || 'Positive'} />
            <MetaRow label="Priority" value={tc.priority} />
            <MetaRow label="Severity" value={tc.severity} />
            <MetaRow label="Scenario" value={tc.scenario_name} />
            <MetaRow label="Assignee" value={tc.assignee_name || '—'} />
            <MetaRow label="Created by" value={tc.created_by_name} />
            <MetaRow label="Created" value={new Date(tc.created_at).toLocaleDateString()} />
            <MetaRow label="Updated" value={new Date(tc.updated_at).toLocaleDateString()} />
          </div>
        </div>
      </div>

      {/* Link existing bug modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4" onClick={() => setShowLinkModal(false)}>
          <div onClick={e => e.stopPropagation()} className="card p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">Link Existing Bug</h2>
                <p className="text-sm text-ink-500">Pick a bug from this project to link</p>
              </div>
              <button onClick={() => setShowLinkModal(false)} className="text-ink-400 hover:text-ink-900"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto border border-ink-100 rounded-lg divide-y divide-ink-100">
              {projectBugs.length === 0 ? (
                <p className="p-4 text-sm text-ink-500">No bugs in this project yet.</p>
              ) : (
                projectBugs.map(b => (
                  <button
                    key={b.id}
                    onClick={() => linkExistingBug(b.id)}
                    className="w-full text-left px-4 py-3 hover:bg-ink-50 flex items-start gap-3"
                  >
                    <span className="text-xs font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded flex-shrink-0 mt-0.5">#{b.bug_number}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900 truncate">{b.summary}</div>
                      <div className="text-xs text-ink-500">{b.status} · {b.priority}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create bug modal */}
      {showCreateBugModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4" onClick={() => setShowCreateBugModal(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submitCreateBug} className="card p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">Create Bug from Failure</h2>
                <p className="text-sm text-ink-500">Pre-filled from this test case — edit as needed.</p>
              </div>
              <button type="button" onClick={() => setShowCreateBugModal(false)} className="text-ink-400 hover:text-ink-900"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label className="label">Summary *</label>
              <input required value={bugForm.summary} onChange={e => setBugForm({ ...bugForm, summary: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea rows={2} value={bugForm.description} onChange={e => setBugForm({ ...bugForm, description: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Steps to Reproduce</label>
              <textarea rows={4} value={bugForm.steps_to_reproduce} onChange={e => setBugForm({ ...bugForm, steps_to_reproduce: e.target.value })} className="input font-mono text-xs" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Expected Result</label>
                <textarea rows={2} value={bugForm.expected_result} onChange={e => setBugForm({ ...bugForm, expected_result: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Actual Result</label>
                <textarea rows={2} value={bugForm.actual_result} onChange={e => setBugForm({ ...bugForm, actual_result: e.target.value })} className="input" />
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="label">Priority</label>
                <select value={bugForm.priority} onChange={e => setBugForm({ ...bugForm, priority: e.target.value })} className="input">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Severity</label>
                <select value={bugForm.severity} onChange={e => setBugForm({ ...bugForm, severity: e.target.value })} className="input">
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Assignee</label>
                <select value={bugForm.assignee_id} onChange={e => setBugForm({ ...bugForm, assignee_id: e.target.value })} className="input">
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowCreateBugModal(false)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Create &amp; Link</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value, edit, onChange, editValue, multiline, mono, emptyLabel }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      {edit ? (
        multiline ? (
          <textarea
            rows={mono ? 5 : 3}
            value={editValue}
            onChange={e => onChange(e.target.value)}
            className={`input ${mono ? 'font-mono text-xs' : ''}`}
          />
        ) : (
          <input value={editValue} onChange={e => onChange(e.target.value)} className="input" />
        )
      ) : (
        value ? (
          <p className={`text-sm text-ink-800 whitespace-pre-wrap ${mono ? 'font-mono text-xs bg-ink-50 rounded-lg p-3 border border-ink-100' : ''}`}>
            {value}
          </p>
        ) : (
          <p className="text-sm text-ink-400 italic">{emptyLabel || 'Not set'}</p>
        )
      )}
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-ink-500 font-medium">{label}</span>
      <span className="text-sm text-ink-800 font-medium text-right">{value}</span>
    </div>
  );
}

function AttachmentGallery({ attachments, onDelete, compact, emptyText }) {
  if (!attachments || attachments.length === 0) {
    return emptyText ? <p className="text-sm text-ink-400 italic">{emptyText}</p> : null;
  }
  const sizeClass = compact ? 'h-20' : 'h-32';
  return (
    <div className={`grid ${compact ? 'grid-cols-3 md:grid-cols-4 gap-2' : 'grid-cols-2 md:grid-cols-3 gap-3'}`}>
      {attachments.map(a => {
        const isImage = a.mimetype?.startsWith('image/');
        const url = attachmentUrl(a.filename);
        return (
          <div key={a.id} className="group relative rounded-xl overflow-hidden border border-ink-100 hover:shadow-pop transition">
            <a href={url} target="_blank" rel="noopener noreferrer" className="block">
              {isImage ? (
                <img src={url} alt={a.original_name} className={`w-full ${sizeClass} object-cover`} />
              ) : (
                <div className={`w-full ${sizeClass} bg-brand-50 flex items-center justify-center`}>
                  <FileText className="w-8 h-8 text-brand-400" />
                </div>
              )}
              <p className="text-[11px] text-ink-600 truncate p-1.5 border-t border-ink-100">{a.original_name}</p>
            </a>
            {onDelete && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(a.id); }}
                className="absolute top-1 right-1 p-1 rounded-md bg-white/90 text-ink-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
