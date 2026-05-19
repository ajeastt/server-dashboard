export default function StatCard({ label, value, sub, icon: Icon, color = 'accent' }) {
  const iconMap = {
    accent: 'text-accent-400 bg-accent-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    sky: 'text-sky-400 bg-sky-500/10',
  }

  return (
    <div className="card p-4 animate-slide-up">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-[#e4e4ed] tracking-tight">{value}</p>
          {sub && <p className="text-xs text-[#8a8a9a]">{sub}</p>}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconMap[color] || ''} shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  )
}
