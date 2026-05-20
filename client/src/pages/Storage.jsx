import { useState, useEffect } from 'react'
import { HardDrive, RefreshCw, FolderOpen } from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/utils'

const COLORS = [
  { bar: 'bg-accent-500', text: 'text-accent-400', bg: 'bg-accent-500/10' },
  { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { bar: 'bg-violet-500', text: 'text-violet-400', bg: 'bg-violet-500/10' },
  { bar: 'bg-sky-500', text: 'text-sky-400', bg: 'bg-sky-500/10' },
  { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  { bar: 'bg-rose-500', text: 'text-rose-400', bg: 'bg-rose-500/10' },
]

export default function Storage() {
  const [disks, setDisks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.system.disks().then(setDisks).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Storage</h1>
          <p className="text-sm text-[#8a8a9a] mt-0.5">{disks.length} disk mount{disks.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => api.system.disks().then(setDisks)} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-[#8a8a9a]">Loading disks...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {disks.map((d, i) => {
            const c = COLORS[i % COLORS.length]
            const pct = Math.round(d.percent)
            const colorClass = pct >= 90 ? 'red' : pct >= 70 ? 'amber' : ''
            const barColor = colorClass === 'red' ? 'bg-red-500' : colorClass === 'amber' ? 'bg-amber-500' : c.bar
            const textColor = colorClass === 'red' ? 'text-red-400' : colorClass === 'amber' ? 'text-amber-400' : c.text

            return (
              <div key={d.mount} className="card p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${c.bg}`}>
                      <HardDrive className={`w-5 h-5 ${textColor}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#e4e4ed] truncate">{d.fs.replace('/dev/', '')}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[#8a8a9a]">{d.fstype}</span>
                        <span className="text-[#5a5a6a]">·</span>
                        <span className="text-xs text-[#8a8a9a] truncate">{d.mount}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`badge text-xs font-mono ${pct >= 90 ? 'bg-red-500/10 text-red-400' : pct >= 70 ? 'bg-amber-500/10 text-amber-400' : c.bg + ' ' + textColor}`}>{pct}%</span>
                </div>

                <div className="h-2 rounded-full bg-base-700/50 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 rounded-lg bg-base-800/40">
                    <p className="text-xs text-[#5a5a6a]">Total</p>
                    <p className="text-sm font-semibold text-[#e4e4ed] font-mono">{formatBytes(d.size)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-base-800/40">
                    <p className="text-xs text-[#5a5a6a]">Used</p>
                    <p className="text-sm font-semibold text-[#e4e4ed] font-mono">{formatBytes(d.used)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-base-800/40">
                    <p className="text-xs text-[#5a5a6a]">Free</p>
                    <p className="text-sm font-semibold text-emerald-400 font-mono">{formatBytes(d.free)}</p>
                  </div>
                </div>
              </div>
            )
          })}
          {!loading && disks.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center h-48 gap-3">
              <HardDrive className="w-10 h-10 text-[#5a5a6a]" />
              <p className="text-sm text-[#8a8a9a]">No disk mounts found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
