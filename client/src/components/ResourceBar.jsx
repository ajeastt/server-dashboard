export default function ResourceBar({ label, percent, color = 'accent' }) {
  const colorClass = {
    accent: 'bg-accent-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    sky: 'bg-sky-500',
  }[color]

  const pct = Math.min(Math.max(percent, 0), 100)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8a8a9a]">{label}</span>
        <span className="text-[#e4e4ed] font-medium font-mono">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-base-700/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
