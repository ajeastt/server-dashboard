import { useState, useEffect, useCallback } from 'react'
import { HardDrive, Trash2, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/utils'

export default function Volumes() {
  const [volumes, setVolumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const fetch = useCallback(async () => {
    try { setVolumes(await api.docker.volumes()) }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleRemove = async (name) => {
    if (!confirm(`Remove volume "${name}"?`)) return
    try { await api.docker.removeVolume(name); fetch() }
    catch (err) { setMessage(err.message) }
  }

  const handlePrune = async () => {
    if (!confirm('Remove all unused volumes?')) return
    try { const r = await api.docker.pruneVolumes(); setMessage(`Pruned: reclaimed ${formatBytes(r.SpaceReclaimed || 0)}`); fetch() }
    catch (err) { setMessage(err.message) }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100 tracking-tight">Volumes</h1>
        <div className="flex items-center gap-2">
          <button onClick={handlePrune} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">
            <RefreshCw className="w-4 h-4" /> Prune
          </button>
          <button onClick={fetch} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-accent-500/10 border border-accent-500/20 text-sm text-accent-400">{message}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-surface-500 text-sm">Loading volumes...</div>
        </div>
      ) : volumes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <HardDrive className="w-12 h-12 text-surface-700" />
          <div className="text-surface-500 text-sm">No volumes found.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {volumes.map((v) => (
            <div key={v.name} className="rounded-xl border border-surface-800 bg-surface-900 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-surface-200 truncate">{v.name}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{v.driver}</p>
                </div>
                <button onClick={() => handleRemove(v.name)} className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-between text-xs text-surface-500">
                <span>{v.mountpoint}</span>
                <span>{v.size > 0 ? formatBytes(v.size) : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
