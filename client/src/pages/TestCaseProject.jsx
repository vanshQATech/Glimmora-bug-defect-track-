import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { PRIORITIES, SEVERITIES } from '../utils/constants';
import {
  ArrowLeft, Plus, ClipboardCheck, Layers, Search, X, Trash2, Edit3,
  CheckCircle2, XCircle, MinusCircle, Clock, FolderKanban, Filter,
  Sparkles, Loader2,
} from 'lucide-react';

const TC_STATUSES = ['Not Run', 'Pass', 'Fail', 'Blocked'];
const CASE_TYPES = ['Positive', 'Negative', 'Edge'];

const CASE_TYPE_CHIP = {
  'Positive': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Negative': 'bg-red-50 text-red-700 border-red-200',
  'Edge':     'bg-purple-50 text-purple-700 border-purple-200',
};

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

const PRIORITY_CHIP = {
  'Critical': 'bg-red-50 text-red-700 border-red-200',
  'High':     'bg-orange-50 text-orange-700 border-orange-200',
  'Medium':   'bg-amber-50 text-amber-700 border-amber-200',
  'Low':      'bg-sky-50 text-sky-700 border-sky-200',
};

export default function TestCaseProject() {
  const { projectId } = useParams();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const [activeScenarioId, setActiveScenarioId] = useState(null); // null = All
  const [filters, setFilters] = useState({ status: '', priority: '', case_type: '', search: '' });

  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [scenarioForm, setScenarioForm] = useState({ name: '', description: '' });

  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiScenarioId, setAiScenarioId] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiError, setAiError] = useState('');

  const openAIModal = () => {
    setAiPrompt('');
    setAiScenarioId(activeScenarioId || (scenarios[0]?.id ? String(scenarios[0].id) : ''));
    setAiResults([]);
    setAiError('');
    setShowAIModal(true);
  };

  const generateTestCases = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const scenarioName = scenarios.find(s => String(s.id) === String(aiScenarioId))?.name || '';
      const { data } = await api.post('/ai/generate-test-cases', { prompt: aiPrompt, scenario_name: scenarioName });
      setAiResults((data.test_cases || []).map(tc => ({ ...tc, selected: true })));
    } catch (err) {
      setAiError(err.response?.data?.error || 'Failed to generate test cases. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const importSelected = async () => {
    const toImport = aiResults.filter(x => x.selected);
    if (toImport.length === 0) return;
    setAiImporting(true);
    setAiError('');
    try {
      for (const tc of toImport) {
        const fd = new FormData();
        fd.append('project_id', projectId);
        fd.append('scenario_id', aiScenarioId);
        Object.entries(tc).forEach(([k, v]) => {
          if (k !== 'selected') fd.append(k, v ?? '');
        });
        await api.post('/testcases/cases', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowAIModal(false);
      setAiResults([]);
      setAiPrompt('');
      fetchAll();
    } catch (err) {
      setAiError(err.response?.data?.error || 'Failed to import some test cases.');
    } finally {
      setAiImporting(false);
    }
  };

  const [showCaseModal, setShowCaseModal] = useState(false);
  const [caseFiles, setCaseFiles] = useState([]);
  const [caseForm, setCaseForm] = useState({
    scenario_id: '',
    title: '',
    description: '',
    preconditions: '',
    steps: '',
    expected_result: '',
    priority: 'Medium',
    severity: 'Major',
    case_type: 'Positive',
    assignee_id: '',
  });

  const fetchAll = async () => {
    try {
      const [proj, scs, cs, st] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/testcases/scenarios/project/${projectId}`),
        api.get(`/testcases/cases/project/${projectId}`),
        api.get(`/testcases/stats/project/${projectId}`),
      ]);
      setProject(proj.data);
      setMembers(proj.data.members || []);
      setScenarios(scs.data);
      setCases(cs.data);
      setStats(st.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [projectId]);

  const filtered = useMemo(() => {
    return cases.filter(c => {
      if (activeScenarioId && c.scenario_id !== activeScenarioId) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (filters.priority && c.priority !== filters.priority) return false;
      if (filters.case_type && c.case_type !== filters.case_type) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${c.title} ${c.description || ''} TC-${c.tc_number}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cases, activeScenarioId, filters]);

  const openCreateScenario = () => {
    setEditingScenario(null);
    setScenarioForm({ name: '', description: '' });
    setShowScenarioModal(true);
  };

  const openEditScenario = (s) => {
    setEditingScenario(s);
    setScenarioForm({ name: s.name, description: s.description || '' });
    setShowScenarioModal(true);
  };

  const submitScenario = async (e) => {
    e.preventDefault();
    try {
      if (editingScenario) {
        await api.put(`/testcases/scenarios/${editingScenario.id}`, scenarioForm);
      } else {
        await api.post('/testcases/scenarios', { ...scenarioForm, project_id: projectId });
      }
      setShowScenarioModal(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save scenario');
    }
  };

  const deleteScenario = async (s) => {
    if (!window.confirm(`Delete scenario "${s.name}" and all its test cases?`)) return;
    try {
      await api.delete(`/testcases/scenarios/${s.id}`);
      if (activeScenarioId === s.id) setActiveScenarioId(null);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete scenario');
    }
  };

  const openCreateCase = () => {
    setCaseForm({
      scenario_id: activeScenarioId || (scenarios[0]?.id || ''),
      title: '',
      description: '',
      preconditions: '',
      steps: '',
      expected_result: '',
      priority: 'Medium',
      severity: 'Major',
      case_type: 'Positive',
      assignee_id: '',
    });
    setCaseFiles([]);
    setShowCaseModal(true);
  };

  const submitCase = async (e) => {
    e.preventDefault();
    if (!caseForm.scenario_id) {
      alert('Please select a scenario');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('project_id', projectId);
      Object.entries(caseForm).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, v);
      });
      caseFiles.forEach(f => fd.append('attachments', f));
      await api.post('/testcases/cases', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowCaseModal(false);
      setCaseFiles([]);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create test case');
    }
  };

  const deleteCase = async (c) => {
    if (!window.confirm(`Delete test case TC-${c.tc_number} "${c.title}"?`)) return;
    try {
      await api.delete(`/testcases/cases/${c.id}`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete test case');
    }
  };

  const updateCaseStatus = async (c, newStatus) => {
    if (!newStatus || newStatus === c.status) return;
    const prev = cases;
    setCases(list => list.map(x => (x.id === c.id ? { ...x, status: newStatus } : x)));
    try {
      await api.put(`/testcases/cases/${c.id}`, { status: newStatus });
      fetchAll();
    } catch (err) {
      setCases(prev);
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const executed = (stats.pass_count || 0) + (stats.fail_count || 0) + (stats.blocked_count || 0);
  const passPct = executed ? Math.round(((stats.pass_count || 0) / executed) * 100) : 0;
  const progressPct = stats.total_cases ? Math.round((executed / stats.total_cases) * 100) : 0;

  const canEdit = ['Admin', 'Project Manager', 'QA Lead', 'QA Tester'].includes(user?.role) || user?.role === 'Standard User';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <Link to="/test-cases" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> All projects
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center shadow-card">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="page-title">{project?.name || 'Loading…'}</h1>
              <p className="text-ink-500 text-sm">Test cases &amp; execution</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/projects/${projectId}`} className="btn-secondary">
              <FolderKanban className="w-4 h-4" /> Bug Tracker
            </Link>
            <button onClick={openCreateScenario} className="btn-secondary">
              <Layers className="w-4 h-4" /> New Scenario
            </button>
            <button
              onClick={openAIModal}
              disabled={scenarios.length === 0}
              className="btn-secondary"
              title={scenarios.length === 0 ? 'Create a scenario first' : 'Generate test cases with AI'}
            >
              <Sparkles className="w-4 h-4 text-brand-600" /> AI Generate
            </button>
            <button
              onClick={openCreateCase}
              disabled={scenarios.length === 0}
              className="btn-primary"
              title={scenarios.length === 0 ? 'Create a scenario first' : ''}
            >
              <Plus className="w-4 h-4" /> New Test Case
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="stat-card">
          <div className="text-xs text-ink-500 font-medium">Scenarios</div>
          <div className="text-2xl font-bold text-ink-900">{stats.scenario_count || 0}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-ink-500 font-medium">Test Cases</div>
          <div className="text-2xl font-bold text-ink-900">{stats.total_cases || 0}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-emerald-600 font-medium">Pass</div>
          <div className="text-2xl font-bold text-emerald-700">{stats.pass_count || 0}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-red-600 font-medium">Fail</div>
          <div className="text-2xl font-bold text-red-700">{stats.fail_count || 0}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-amber-600 font-medium">Blocked</div>
          <div className="text-2xl font-bold text-amber-700">{stats.blocked_count || 0}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-ink-500 font-medium">Not Run</div>
          <div className="text-2xl font-bold text-ink-900">{stats.notrun_count || 0}</div>
        </div>
      </div>

      {/* Pass rate + execution progress */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-ink-900">Pass rate</div>
            <span className="text-lg font-bold text-ink-900">{passPct}%</span>
          </div>
          <div className="w-full h-3 bg-ink-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${passPct}%` }} />
          </div>
          <p className="text-xs text-ink-500 mt-2">{stats.pass_count || 0} passed of {executed} executed</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-ink-900">Execution progress</div>
            <span className="text-lg font-bold text-ink-900">{progressPct}%</span>
          </div>
          <div className="w-full h-3 bg-ink-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-gradient rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-ink-500 mt-2">{executed} of {stats.total_cases || 0} cases executed</p>
        </div>
      </div>

      {/* Scenarios pills */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-ink-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-600" /> Scenarios
          </div>
          <button onClick={openCreateScenario} className="text-xs text-brand-700 hover:underline font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add scenario
          </button>
        </div>
        {scenarios.length === 0 ? (
          <p className="text-sm text-ink-500">No scenarios yet. Create one to start adding test cases.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveScenarioId(null)}
              className={`chip cursor-pointer transition ${activeScenarioId === null ? 'bg-brand-gradient text-white border-transparent' : 'bg-white border-ink-200 text-ink-700 hover:bg-ink-50'}`}
            >
              All ({cases.length})
            </button>
            {scenarios.map(s => (
              <div key={s.id} className="group inline-flex items-center">
                <button
                  onClick={() => setActiveScenarioId(s.id)}
                  className={`chip cursor-pointer transition ${activeScenarioId === s.id ? 'bg-brand-gradient text-white border-transparent' : 'bg-white border-ink-200 text-ink-700 hover:bg-ink-50'}`}
                  title={s.description || ''}
                >
                  {s.name} ({s.case_count || 0})
                  {(s.fail_count || 0) > 0 && (
                    <span className={`ml-1 text-[10px] font-bold ${activeScenarioId === s.id ? 'text-red-200' : 'text-red-600'}`}>{s.fail_count} fail</span>
                  )}
                </button>
                <button
                  onClick={() => openEditScenario(s)}
                  className="opacity-0 group-hover:opacity-100 transition ml-1 p-1 text-ink-400 hover:text-brand-600"
                  title="Edit"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteScenario(s)}
                  className="opacity-0 group-hover:opacity-100 transition p-1 text-ink-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search test cases…"
            className="input pl-10"
          />
        </div>
        <select
          value={filters.status}
          onChange={e => setFilters({ ...filters, status: e.target.value })}
          className="input w-40"
        >
          <option value="">All statuses</option>
          {TC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filters.priority}
          onChange={e => setFilters({ ...filters, priority: e.target.value })}
          className="input w-40"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filters.case_type}
          onChange={e => setFilters({ ...filters, case_type: e.target.value })}
          className="input w-40"
        >
          <option value="">All types</option>
          {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(filters.search || filters.status || filters.priority || filters.case_type) && (
          <button
            onClick={() => setFilters({ status: '', priority: '', case_type: '', search: '' })}
            className="btn-ghost"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Test case table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-ink-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-ink-300 mx-auto mb-3" />
            <p className="text-ink-700 font-semibold mb-1">No test cases</p>
            <p className="text-ink-500 text-sm">
              {scenarios.length === 0
                ? 'Create a scenario, then add your first test case.'
                : 'Add your first test case to start tracking.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 border-b border-ink-100">
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Scenario</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Assignee</th>
                  <th className="px-4 py-3 font-semibold">Linked Bug</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map(c => {
                  const Icon = STATUS_ICON[c.status] || Clock;
                  return (
                    <tr key={c.id} className="hover:bg-ink-50/60 transition">
                      <td className="px-4 py-3">
                        <Link to={`/test-cases/case/${c.id}`} className="text-xs font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                          TC-{c.tc_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/test-cases/case/${c.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                          {c.title}
                        </Link>
                        {c.description && (
                          <p className="text-xs text-ink-500 line-clamp-1 mt-0.5">{c.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-600">{c.scenario_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`chip ${CASE_TYPE_CHIP[c.case_type] || 'bg-ink-100 text-ink-600 border-ink-200'}`}>
                          {c.case_type || 'Positive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <label className={`chip relative cursor-pointer ${STATUS_CHIP[c.status] || STATUS_CHIP['Not Run']}`}>
                          <Icon className="w-3 h-3" />
                          {c.status}
                          <select
                            value={c.status}
                            onChange={e => updateCaseStatus(c, e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            aria-label={`Change status for TC-${c.tc_number}`}
                          >
                            {TC_STATUSES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`chip ${PRIORITY_CHIP[c.priority] || ''}`}>{c.priority}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{c.assignee_name || <span className="text-ink-400">Unassigned</span>}</td>
                      <td className="px-4 py-3">
                        {c.linked_bug_id ? (
                          <Link to={`/bugs/${c.linked_bug_id}`} className="text-xs font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded hover:underline">
                            #{c.linked_bug_number}
                          </Link>
                        ) : (
                          <span className="text-ink-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteCase(c)}
                          className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Generate Modal */}
      {showAIModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => !aiLoading && !aiImporting && setShowAIModal(false)}
        >
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-brand-gradient flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">AI Test Case Generator</h2>
                  <p className="text-xs text-ink-500">Describe what to test — AI will generate detailed test cases</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !aiLoading && !aiImporting && setShowAIModal(false)}
                className="text-ink-400 hover:text-ink-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiResults.length === 0 ? (
              /* —— Prompt form —— */
              <>
                <div>
                  <label className="label">What do you want to test? *</label>
                  <textarea
                    rows={4}
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    className="input"
                    placeholder={`e.g. "User login with email and password — include valid credentials, wrong password, locked account, and empty fields"`}
                    disabled={aiLoading}
                  />
                  <p className="text-[11px] text-ink-400 mt-1">Be specific — mention the feature, inputs, and edge cases you care about.</p>
                </div>
                <div>
                  <label className="label">Target Scenario *</label>
                  <select
                    value={aiScenarioId}
                    onChange={e => setAiScenarioId(e.target.value)}
                    className="input"
                    disabled={aiLoading}
                  >
                    <option value="">Select a scenario</option>
                    {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {aiError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{aiError}</div>
                )}
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setShowAIModal(false)} className="btn-ghost" disabled={aiLoading}>Cancel</button>
                  <button
                    type="button"
                    onClick={generateTestCases}
                    disabled={aiLoading || !aiPrompt.trim() || !aiScenarioId}
                    className="btn-primary"
                  >
                    {aiLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                      : <><Sparkles className="w-4 h-4" /> Generate Test Cases</>}
                  </button>
                </div>
              </>
            ) : (
              /* —— Results —— */
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink-700">
                    {aiResults.length} test cases generated — select which to import:
                  </p>
                  <button
                    type="button"
                    onClick={() => { setAiResults([]); setAiError(''); }}
                    className="text-xs text-brand-700 hover:underline font-medium"
                  >
                    ← Edit prompt
                  </button>
                </div>

                <div className="space-y-2.5">
                  {aiResults.map((tc, i) => (
                    <label
                      key={i}
                      className={`flex gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        tc.selected
                          ? 'border-brand-400 bg-brand-50/60 shadow-sm'
                          : 'border-ink-200 bg-white hover:bg-ink-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={tc.selected}
                        onChange={() => setAiResults(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                        className="mt-0.5 accent-brand-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-medium text-ink-900 text-sm">{tc.title}</span>
                          <span className={`chip text-[10px] ${CASE_TYPE_CHIP[tc.case_type] || 'bg-ink-100 text-ink-600 border-ink-200'}`}>{tc.case_type}</span>
                          <span className={`chip text-[10px] ${PRIORITY_CHIP[tc.priority] || ''}`}>{tc.priority}</span>
                        </div>
                        {tc.description && (
                          <p className="text-xs text-ink-500 line-clamp-1">{tc.description}</p>
                        )}
                        {tc.steps && (
                          <p className="text-[11px] text-ink-400 font-mono mt-1 line-clamp-2 whitespace-pre-line">{tc.steps}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                {aiError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{aiError}</div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setAiResults(prev => prev.map(x => ({ ...x, selected: true })))}
                      className="text-brand-700 hover:underline font-medium"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiResults(prev => prev.map(x => ({ ...x, selected: false })))}
                      className="text-ink-500 hover:underline"
                    >
                      Deselect all
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowAIModal(false)} className="btn-ghost" disabled={aiImporting}>Cancel</button>
                    <button
                      type="button"
                      onClick={importSelected}
                      disabled={aiImporting || !aiResults.some(x => x.selected)}
                      className="btn-primary"
                    >
                      {aiImporting
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                        : `Import ${aiResults.filter(x => x.selected).length} Selected`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Scenario modal */}
      {showScenarioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowScenarioModal(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submitScenario} className="card p-6 w-full max-w-md space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">{editingScenario ? 'Edit Scenario' : 'New Scenario'}</h2>
                <p className="text-sm text-ink-500">Group related test cases under a scenario</p>
              </div>
              <button type="button" onClick={() => setShowScenarioModal(false)} className="text-ink-400 hover:text-ink-900"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="label">Name</label>
              <input
                required
                value={scenarioForm.name}
                onChange={e => setScenarioForm({ ...scenarioForm, name: e.target.value })}
                className="input"
                placeholder="e.g. User Authentication"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                rows={3}
                value={scenarioForm.description}
                onChange={e => setScenarioForm({ ...scenarioForm, description: e.target.value })}
                className="input"
                placeholder="What does this scenario cover?"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowScenarioModal(false)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">{editingScenario ? 'Save' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Case modal */}
      {showCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowCaseModal(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submitCase} className="card p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">New Test Case</h2>
                <p className="text-sm text-ink-500">Define steps, expected result, and priority</p>
              </div>
              <button type="button" onClick={() => setShowCaseModal(false)} className="text-ink-400 hover:text-ink-900"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Scenario *</label>
                <select
                  required
                  value={caseForm.scenario_id}
                  onChange={e => setCaseForm({ ...caseForm, scenario_id: e.target.value })}
                  className="input"
                >
                  <option value="">Select a scenario</option>
                  {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Assignee</label>
                <select
                  value={caseForm.assignee_id}
                  onChange={e => setCaseForm({ ...caseForm, assignee_id: e.target.value })}
                  className="input"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Title *</label>
              <input
                required
                value={caseForm.title}
                onChange={e => setCaseForm({ ...caseForm, title: e.target.value })}
                className="input"
                placeholder="Verify login with valid credentials"
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                rows={2}
                value={caseForm.description}
                onChange={e => setCaseForm({ ...caseForm, description: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Pre-conditions</label>
              <textarea
                rows={2}
                value={caseForm.preconditions}
                onChange={e => setCaseForm({ ...caseForm, preconditions: e.target.value })}
                className="input"
                placeholder="What must be true before running this test?"
              />
            </div>

            <div>
              <label className="label">Test Steps</label>
              <textarea
                rows={5}
                value={caseForm.steps}
                onChange={e => setCaseForm({ ...caseForm, steps: e.target.value })}
                className="input font-mono text-xs"
                placeholder={'1. Go to /login\n2. Enter email and password\n3. Click Sign In'}
              />
            </div>

            <div>
              <label className="label">Expected Result</label>
              <textarea
                rows={2}
                value={caseForm.expected_result}
                onChange={e => setCaseForm({ ...caseForm, expected_result: e.target.value })}
                className="input"
                placeholder="User lands on the dashboard"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="label">Case Type</label>
                <select
                  value={caseForm.case_type}
                  onChange={e => setCaseForm({ ...caseForm, case_type: e.target.value })}
                  className="input"
                >
                  {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <p className="text-[10px] text-ink-500 mt-1">
                  Positive = happy path · Negative = invalid input · Edge = boundary
                </p>
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  value={caseForm.priority}
                  onChange={e => setCaseForm({ ...caseForm, priority: e.target.value })}
                  className="input"
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Severity</label>
                <select
                  value={caseForm.severity}
                  onChange={e => setCaseForm({ ...caseForm, severity: e.target.value })}
                  className="input"
                >
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Attachments (screenshots, specs, etc.)</label>
              <input
                type="file"
                multiple
                onChange={e => setCaseFiles(Array.from(e.target.files || []))}
                className="input"
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
              />
              {caseFiles.length > 0 && (
                <p className="text-xs text-ink-500 mt-1">
                  {caseFiles.length} file{caseFiles.length === 1 ? '' : 's'} ready to upload
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowCaseModal(false)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Create Test Case</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
