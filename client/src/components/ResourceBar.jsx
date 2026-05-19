export default function ResourceBar({ label, percent, color = 'accent' }) {
  const colorClass = {
    accent: 'bg-gradient-to-r from-accent-500 to-accent-400',
    emerald: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    amber: 'bg-gradient-to-r from-amber-500 to-amber-400',
    red: 'bg-gradient-to-r from-red-500 to-red-400',
    sky: 'bg-gradient-to-r from-sky-500 to-sky-400',
  }[color]

  const pct = Math.min(Math.max(percent, 0), 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-surface-400 font-medium">{label}</span>
        <span className="text-surface-200 font-semibold font-mono">{pct}%</span>
      </div>
      <div className="h-2 bg-surface-800/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
