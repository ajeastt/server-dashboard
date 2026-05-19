export default function StatCard({ label, value, sub, icon: Icon, color = 'accent' }) {
  const borderColors = {
    accent: 'border-accent-500/20',
    emerald: 'border-emerald-500/20',
    amber: 'border-amber-500/20',
    violet: 'border-violet-500/20',
    sky: 'border-sky-500/20',
    red: 'border-red-500/20',
  }

  const iconColors = {
    accent: 'text-accent-400 bg-accent-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    sky: 'text-sky-400 bg-sky-500/10',
    red: 'text-red-400 bg-red-500/10',
  }

  const glowColors = {
    accent: 'shadow-accent-500/10',
    emerald: 'shadow-emerald-500/10',
    amber: 'shadow-amber-500/10',
    violet: 'shadow-violet-500/10',
    sky: 'shadow-sky-500/10',
    red: 'shadow-red-500/10',
  }

  return (
    <div className={`card card-hover p-4 animate-slide-up ${borderColors[color]} shadow-sm ${glowColors[color]}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-[0.08em]">{label}</p>
          <p className="text-2xl font-bold text-surface-100 tracking-tight">{value}</p>
          {sub && <p className="text-xs text-surface-500">{sub}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${iconColors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  )
}
