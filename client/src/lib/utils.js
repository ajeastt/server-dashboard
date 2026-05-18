export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

export function formatTime(ts) {
  const date = new Date(ts)
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function stateColor(state) {
  switch (state) {
    case 'running': return 'text-emerald-400'
    case 'exited':
    case 'stopped': return 'text-red-400'
    case 'paused': return 'text-amber-400'
    default: return 'text-surface-400'
  }
}

export function stateBg(state) {
  switch (state) {
    case 'running': return 'bg-emerald-500/10 border-emerald-500/20'
    case 'exited':
    case 'stopped': return 'bg-red-500/10 border-red-500/20'
    case 'paused': return 'bg-amber-500/10 border-amber-500/20'
    default: return 'bg-surface-800 border-surface-700'
  }
}
