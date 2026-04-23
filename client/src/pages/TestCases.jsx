import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { ClipboardCheck, FolderKanban, CheckCircle2, XCircle, MinusCircle, Clock, Search } from 'lucide-react';

export default function TestCases() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/testcases/my/summary')
      .then(r => setRows(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));

  const passRate = (r) => {
    const executed = (r.pass_count || 0) + (r.fail_count || 0) + (r.blocked_count || 0);
    if (!executed) return 0;
    return Math.round((r.pass_count / executed) * 100);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Test Case Management</h1>
          <p className="text-ink-500 mt-1">Plan, execute, and track QA across your projects</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="input pl-10 w-72"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-brand-50 mb-4">
            <ClipboardCheck className="w-8 h-8 text-brand-600" />
          </div>
          <p className="text-ink-700 font-semibold mb-1">No projects yet</p>
          <p className="text-ink-500 text-sm">Test cases are organized per project — create a project first.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => {
            const pct = passRate(p);
            return (
              <Link key={p.id} to={`/test-cases/${p.id}`} className="card card-hover p-5 group relative overflow-hidden">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-card">
                    <ClipboardCheck className="w-5 h-5 text-white" />
                  </div>
                  <span className="chip bg-brand-50 text-brand-700 border-brand-200">{p.scenario_count || 0} scenario{p.scenario_count === 1 ? '' : 's'}</span>
                </div>
                <h3 className="font-semibold text-ink-900 text-lg tracking-tight mb-1">{p.name}</h3>
                <p className="text-sm text-ink-500 mb-4">{p.total_cases || 0} test case{p.total_cases === 1 ? '' : 's'}</p>

                {/* Pass rate bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-ink-500 font-medium">Pass rate</span>
                    <span className="font-bold text-ink-900">{pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-ink-100 text-xs">
                  <div className="flex flex-col items-center gap-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-bold text-ink-800">{p.pass_count || 0}</span>
                    <span className="text-[10px] text-ink-400">Pass</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    <span className="font-bold text-ink-800">{p.fail_count || 0}</span>
                    <span className="text-[10px] text-ink-400">Fail</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <MinusCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-bold text-ink-800">{p.blocked_count || 0}</span>
                    <span className="text-[10px] text-ink-400">Blocked</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Clock className="w-3.5 h-3.5 text-ink-400" />
                    <span className="font-bold text-ink-800">{p.notrun_count || 0}</span>
                    <span className="text-[10px] text-ink-400">Not Run</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
