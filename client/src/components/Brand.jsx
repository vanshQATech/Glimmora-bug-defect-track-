export default function Brand({ className = 'h-9', showText = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo.png"
        alt="Glimmora International"
        className={className}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      {showText && (
        <div className="leading-tight hidden sm:block">
          <div className="text-[15px] font-bold tracking-tight text-ink-900">Glimmora DefectDesk</div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-brand-600 font-semibold">Bug & Work Management</div>
        </div>
      )}
    </div>
  );
}
