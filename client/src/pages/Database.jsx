import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Database, RefreshCw, Table as TableIcon } from 'lucide-react';

const PAGE_SIZE = 100;

function formatCell(v) {
  if (v === null || v === undefined) return <span className="text-ink-300 italic">null</span>;
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  if (s.length > 120) return s.slice(0, 120) + '…';
  return s;
}

export default function DatabasePage() {
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTables = () => {
    setLoading(true);
    setError(null);
    api.get('/admin/tables')
      .then(r => {
        setTables(r.data);
        if (!selected && r.data.length > 0) setSelected(r.data[0].name);
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load tables'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTables(); }, []);

  useEffect(() => {
    if (!selected) return;
    setTableLoading(true);
    api.get(`/admin/tables/${selected}?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then(r => setTableData(r.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load table'))
      .finally(() => setTableLoading(false));
  }, [selected, page]);

  const selectTable = (name) => {
    setSelected(name);
    setPage(0);
  };

  if (loading) return <div className="max-w-[1400px] mx-auto"><div className="skeleton h-20" /><div className="skeleton h-96 mt-4" /></div>;

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6">
          <h2 className="font-semibold mb-2">Error</h2>
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-2 text-red-500">Note: this page requires Admin role.</p>
        </div>
      </div>
    );
  }

  const totalPages = tableData ? Math.ceil(tableData.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2"><Database className="w-6 h-6 text-brand-600" /> Database Viewer</h1>
          <p className="text-ink-500 mt-1">Browse all tables and their rows (Admin only)</p>
        </div>
        <button onClick={loadTables}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-ink-600 bg-white border border-ink-100 hover:bg-ink-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <aside className="bg-white border border-ink-100 rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-100 text-[11px] uppercase tracking-wider text-ink-500 font-semibold">
            Tables ({tables.length})
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {tables.map(t => (
              <button
                key={t.name}
                onClick={() => selectTable(t.name)}
                className={`w-full text-left px-4 py-2 flex items-center justify-between gap-2 text-sm border-b border-ink-50 last:border-b-0 transition-colors ${
                  selected === t.name ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-ink-50'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <TableIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{t.name}</span>
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selected === t.name ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="bg-white border border-ink-100 rounded-xl shadow-card overflow-hidden">
          {tableLoading && <div className="p-4 text-sm text-ink-400">Loading…</div>}

          {tableData && !tableLoading && (
            <>
              <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-semibold text-ink-900">{tableData.table}</div>
                  <div className="text-xs text-ink-400">
                    {tableData.total} rows · showing {tableData.rows.length}
                    {totalPages > 1 && ` · page ${page + 1} of ${totalPages}`}
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                      className="px-2 py-1 text-xs border border-ink-100 rounded disabled:opacity-40">Prev</button>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                      className="px-2 py-1 text-xs border border-ink-100 rounded disabled:opacity-40">Next</button>
                  </div>
                )}
              </div>

              {tableData.rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-ink-400">Table is empty</div>
              ) : (
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full text-xs">
                    <thead className="bg-ink-50 text-ink-500 uppercase tracking-wider sticky top-0">
                      <tr>
                        {tableData.columns.map(c => (
                          <th key={c.name} className="text-left px-3 py-2 whitespace-nowrap border-b border-ink-100">
                            <div className="font-semibold">
                              {c.name}
                              {c.pk ? <span className="ml-1 text-brand-600">🔑</span> : null}
                            </div>
                            <div className="text-[9px] text-ink-400 normal-case font-normal">{c.type || 'TEXT'}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, idx) => (
                        <tr key={idx} className="border-b border-ink-50 hover:bg-ink-50/50">
                          {tableData.columns.map(c => (
                            <td key={c.name} className="px-3 py-2 align-top text-ink-700 max-w-[300px] truncate font-mono text-[11px]" title={row[c.name] != null ? String(row[c.name]) : ''}>
                              {formatCell(row[c.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
