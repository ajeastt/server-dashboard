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
    try { const [d, v] = await Promise.all([api.system.disks(), api.docker.volumes()]); setDisks(d); setVolumes(v) }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!volName) return
    setCreating(true)
    try { await api.docker.createVolume(volName, volDriver); setShowCreate(false); setVolName(''); setVolDriver('local'); fetch() }
    catch (err) { setMessage(err.message) }
    finally { setCreating(false) }
  }

  const handleRemove = async (name) => {
    if (!confirm(`Remove volume "${name}"?`)) return
    try { await api.docker.removeVolume(name); fetch() } catch (err) { setMessage(err.message) }
  }

  const handlePrune = async () => {
    if (!confirm('Remove all unused volumes?')) return
    try { const r = await api.docker.pruneVolumes(); setMessage(`Pruned: reclaimed ${formatBytes(r.SpaceReclaimed || 0)}`); fetch() } catch (err) { setMessage(err.message) }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Volumes</h1>
        <div className="flex items-center gap-2">
          {volumes.length > 0 && <button onClick={handlePrune} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"><RefreshCw className="w-3.5 h-3.5" /> Prune</button>}
          <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create</button>
          <button onClick={fetch} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-[#8a8a9a]">Loading...</div>
      ) : (
        <>
          {disks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Disc className="w-4 h-4 text-[#8a8a9a]" /><h2 className="text-sm font-semibold text-[#8a8a9a] uppercase tracking-wider">Disk Mounts</h2></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {disks.map((d, i) => (
                  <div key={i} className="card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#e4e4ed] truncate">{d.fs}</p>
                        <p className="text-xs text-[#8a8a9a] mt-0.5 truncate">{d.mount}</p>
                      </div>
                      <span className={`badge shrink-0 ml-2 ${d.percent >= 90 ? 'bg-red-500/10 text-red-400' : d.percent >= 70 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{d.percent}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-base-700/50 overflow-hidden">
                      <div className={`h-full rounded-full ${d.percent >= 90 ? 'bg-red-500' : d.percent >= 70 ? 'bg-amber-500' : 'bg-accent-500'}`} style={{ width: `${Math.min(d.percent, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-[#5a5a6a] mt-1.5"><span>{formatBytes(d.used)} used</span><span>{formatBytes(d.free)} free</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-[#8a8a9a]" /><h2 className="text-sm font-semibold text-[#8a8a9a] uppercase tracking-wider">Docker Volumes</h2><span className="text-xs text-[#5a5a6a]">{volumes.length}</span></div>
            {volumes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 rounded-xl border border-dashed border-base-700/50 bg-base-800/20">
                <HardDrive className="w-10 h-10 text-[#5a5a6a]" />
                <p className="text-sm text-[#8a8a9a]">No Docker volumes yet</p>
                <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create your first volume</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {volumes.map((v) => (
                  <div key={v.name} className="card p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#e4e4ed] truncate">{v.name}</p>
                        <p className="text-xs text-[#8a8a9a] mt-0.5">{v.driver}</p>
                      </div>
                      <button onClick={() => handleRemove(v.name)} className="p-1 rounded text-[#5a5a6a] hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex justify-between text-xs text-[#5a5a6a] pt-1.5 border-t border-base-700/30"><span className="truncate mr-2 font-mono">{v.mountpoint}</span><span className="shrink-0 font-mono">{v.size > 0 ? formatBytes(v.size) : '—'}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md mx-4 rounded-xl border border-base-700/60 bg-base-900 shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-700/40">
              <h2 className="text-sm font-semibold text-[#e4e4ed]">Create Volume</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded text-[#8a8a9a] hover:text-[#e4e4ed] hover:bg-white/[0.04] transition-all"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div><label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Name</label><input type="text" value={volName} onChange={(e) => setVolName(e.target.value)} placeholder="my-volume" className="input font-mono" required /></div>
              <div><label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Driver</label><select value={volDriver} onChange={(e) => setVolDriver(e.target.value)} className="input"><option value="local">local</option></select></div>
              <div className="flex justify-end gap-2 pt-2">
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
