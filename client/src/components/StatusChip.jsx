const MAP = {
  // Bug workflow
  'New':                          { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200' },
  'Open':                         { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  'In Progress':                  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  'Fixed':                        { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  'Under Deployment':             { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  'Failed':                       { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  'Ready for Testing':            { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  'Checked by QA':                { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Checked by Project Manager':   { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' },
  'Approved by PM':               { bg: 'bg-brand-50',   text: 'text-brand-700',   border: 'border-brand-200' },
  // Tasks
  'To Do':                        { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200' },
  'In Review':                    { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  'Blocked':                      { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  'Completed':                    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Done':                         { bg: 'bg-brand-50',   text: 'text-brand-700',   border: 'border-brand-200' },
};

export default function StatusChip({ status, className = '' }) {
  const s = MAP[status] || { bg: 'bg-ink-100', text: 'text-ink-700', border: 'border-ink-200' };
  return (
    <span className={`chip ${s.bg} ${s.text} ${s.border} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

export const PRIORITY_COLORS = {
  Low:      'bg-slate-50 text-slate-700 border-slate-200',
  Medium:   'bg-blue-50 text-blue-700 border-blue-200',
  High:     'bg-orange-50 text-orange-700 border-orange-200',
  Urgent:   'bg-red-50 text-red-700 border-red-200',
  Critical: 'bg-red-50 text-red-700 border-red-200',
};

export function PriorityChip({ priority }) {
  const cls = PRIORITY_COLORS[priority] || 'bg-ink-100 text-ink-700 border-ink-200';
  return <span className={`chip ${cls}`}>{priority}</span>;
}
