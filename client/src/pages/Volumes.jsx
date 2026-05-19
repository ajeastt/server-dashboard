import { useState, useEffect, useCallback } from 'react'
import { HardDrive, Trash2, RefreshCw, Plus, X, Disc } from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/utils'

export default function Volumes() {
  const [disks, setDisks] = useState([])
  const [volumes, setVolumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [volName, setVolName] = useState('')
  const [volDriver, setVolDriver] = useState('local')
  const [creating, setCreating] = useState(false)

  const fetch = useCallback(async () => {
    try {
      const [d, v] = await Promise.all([
        api.system.disks(),
        api.docker.volumes(),
      ])
      setDisks(d)
      setVolumes(v)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!volName) return
    setCreating(true)
    try {
      await api.docker.createVolume(volName, volDriver)
      setShowCreate(false)
      setVolName('')
      setVolDriver('local')
      fetch()
    } catch (err) {
      setMessage(err.message)
    } finally {
      setCreating(false)
    }
  }

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
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100 tracking-tight">Volumes</h1>
        <div className="flex items-center gap-2">
          {volumes.length > 0 && (
            <button onClick={handlePrune} className="px-3 py-2 text-sm font-medium rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">
              <RefreshCw className="w-4 h-4" /> Prune
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create
          </button>
          <button onClick={fetch} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="p-1 hover:bg-red-500/10 rounded-lg transition-all"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-surface-500 text-sm">Loading...</div>
        </div>
      ) : (
        <>
          {/* Physical Disk Mounts */}
          {disks.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Disc className="w-4 h-4 text-surface-500" />
                <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Disk Mounts</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {disks.map((d, i) => {
                  const pct = d.percent
                  return (
                    <div key={i} className="card p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-surface-200 truncate">{d.fs}</p>
                          <p className="text-xs text-surface-500 mt-0.5 truncate">{d.mount}</p>
                        </div>
                        <span className={`badge shrink-0 ml-2 ${
                          pct >= 90 ? 'bg-red-500/10 text-red-400' :
                          pct >= 70 ? 'bg-amber-500/10 text-amber-400' :
                          'bg-emerald-500/10 text-emerald-400'
                        }`}>{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-800/60 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          pct >= 90 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                          pct >= 70 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                          'bg-gradient-to-r from-accent-500 to-accent-400'
                        }`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-surface-500 mt-2">
                        <span>{formatBytes(d.used)} used</span>
                        <span>{formatBytes(d.free)} free</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Docker Volumes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-surface-500" />
              <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Docker Volumes</h2>
              <span className="text-xs text-surface-600">{volumes.length}</span>
            </div>
            {volumes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 rounded-2xl border border-dashed border-surface-700/30 bg-surface-900/30">
                <HardDrive className="w-10 h-10 text-surface-700" />
                <p className="text-sm text-surface-500">No Docker volumes yet</p>
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                  <Plus className="w-4 h-4" /> Create your first volume
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {volumes.map((v) => (
                  <div key={v.name} className="card p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-surface-200 truncate">{v.name}</p>
                        <p className="text-xs text-surface-500 mt-0.5">{v.driver}</p>
                      </div>
                      <button onClick={() => handleRemove(v.name)} className="btn-ghost p-1.5 text-surface-500 hover:text-red-400 hover:bg-red-500/10 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between text-xs text-surface-500 pt-1 border-t border-surface-800/30">
                      <span className="truncate mr-2 font-mono">{v.mountpoint}</span>
                      <span className="shrink-0 font-mono">{v.size > 0 ? formatBytes(v.size) : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Volume Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-surface-700/50 bg-surface-900/95 backdrop-blur-xl shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-surface-800/50">
              <h2 className="text-sm font-semibold text-surface-200">Create Volume</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800/50 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Name</label>
                <input type="text" value={volName} onChange={(e) => setVolName(e.target.value)} placeholder="my-volume" className="input font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Driver</label>
                <select value={volDriver} onChange={(e) => setVolDriver(e.target.value)} className="input">
                  <option value="local">local</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">{creating ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
