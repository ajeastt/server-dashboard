export default function StatCard({ label, value, sub, icon: Icon, color = 'accent' }) {
  const colorMap = {
    accent: 'from-accent-500/20 to-accent-600/5 border-accent-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
    violet: 'from-violet-500/20 to-violet-600/5 border-violet-500/20',
    sky: 'from-sky-500/20 to-sky-600/5 border-sky-500/20',
  }

  const iconColorMap = {
    accent: 'text-accent-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    violet: 'text-violet-400',
    sky: 'text-sky-400',
  }

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${colorMap[color]} p-4 animate-slide-up`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-semibold text-surface-100 tracking-tight">{value}</p>
          {sub && <p className="text-xs text-surface-500">{sub}</p>}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg bg-surface-800/50 ${iconColorMap[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  )
}
