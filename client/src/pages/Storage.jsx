import { useState, useEffect } from 'react'
import { HardDrive, Database, Plus, Check, RefreshCw, Trash2, Loader2, AlertTriangle, Info, Layers, Usb, Zap, Server, ExternalLink, Unlink } from 'lucide-react'
import { api } from '../lib/api'

function formatDiskSize(s) {
  if (!s) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let n = parseFloat(s)
  let u = 0
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++ }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[u]}`
}

function DiskTypeIcon({ disk }) {
  if (disk.rm === '1') return <Usb className="w-5 h-5 text-amber-400" />
  if (disk.rota === '1') return <Server className="w-5 h-5 text-sky-400" />
  return <Zap className="w-5 h-5 text-emerald-400" />
}

function DiskTypeLabel({ disk }) {
  if (disk.isSystem) return <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-medium">System</span>
  if (disk.rm === '1') return <span className="bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-medium">External</span>
  return <span className="bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded text-[10px] font-medium">Internal</span>
}

export default function Storage() {
  const [disks, setDisks] = useState([])
  const [mounts, setMounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState({})
  const [formatting, setFormatting] = useState(null)
  const [creatingPool, setCreatingPool] = useState(false)
  const [poolName, setPoolName] = useState('')
  const [error, setError] = useState('')

  const loadData = () => {
    setLoading(true)
    setError('')
    Promise.all([
      api.system.blockDevices().then(setDisks),
      api.storage.mounts().then((d) => setMounts(Array.isArray(d) ? d : [])).catch(() => {}),
    ]).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(loadData, [])

  const toggleDisk = (name) => {
    setSelected((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const anySelected = Object.values(selected).some(Boolean)
  const selectedCount = Object.values(selected).filter(Boolean).length

  const handleFormat = async (disk) => {
    setFormatting(disk.name)
    setError('')
    try {
      await api.storage.format(disk.name, disk.name)
      loadData()
    } catch (e) {
      setError(e.message)
    } finally {
      setFormatting(null)
    }
  }

  const handleUnmount = async (mount) => {
    setError('')
    try {
      await api.storage.unmount(mount.mountPoint)
      loadData()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleCreatePool = async () => {
    if (!poolName.trim() || selectedCount < 2) return
    setCreatingPool(true)
    setError('')
    try {
      const selectedMounts = Object.keys(selected).filter((k) => selected[k])
      const mountPoints = selectedMounts
        .map((n) => disks.find((d) => d.name === n))
        .filter(Boolean)
        .map((d) => {
          const m = mounts.find((m) => m.device === d.name)
          return m ? m.mountPoint : null
        })
        .filter(Boolean)
      if (mountPoints.length < 2) {
        setError('Select at least 2 formatted disks to create a pool.')
        return
      }
      await api.storage.createPool(poolName.trim(), mountPoints)
      setPoolName('')
      setSelected({})
      loadData()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreatingPool(false)
    }
  }

  // Group disks: formatted ones (have a mount) vs raw ones
  const formattedDiskNames = new Set(mounts.map((m) => m.device))
  const rawDisks = disks.filter((d) => !formattedDiskNames.has(d.name))
  const formattedDisks = disks.filter((d) => formattedDiskNames.has(d.name))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Storage</h1>
          <p className="text-sm text-[#8a8a9a] mt-0.5">{disks.length} disks · {mounts.length} mounted</p>
        </div>
        <div className="flex items-center gap-2">
          {anySelected && selectedCount >= 2 && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder="Pool name..."
                className="input w-40 text-xs"
              />
              <button onClick={handleCreatePool} disabled={creatingPool || !poolName.trim()} className="btn-primary">
                {creatingPool ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                Create Pool
              </button>
            </div>
          )}
          <button onClick={loadData} disabled={loading} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-sm text-[#8a8a9a]">Scanning disks...</div>
      ) : (
        <>
          {/* Managed volumes / pools */}
          {mounts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider mb-3">Mounted Volumes</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {mounts.map((m) => {
                  const disk = disks.find((d) => d.device === m.device || d.name === m.device)
                  return (
                    <div key={m.mountPoint} className="card p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10">
                          <HardDrive className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-[#e4e4ed]">{m.device || m.partition}</span>
                            <span className="text-[10px] text-[#5a5a6a] font-mono">/dev/{m.partition}</span>
                          </div>
                          <div className="text-[11px] text-[#8a8a9a] truncate mt-0.5">{m.mountPoint}</div>
                        </div>
                      </div>
                      <button onClick={() => handleUnmount(m)} className="btn-ghost p-1.5 text-[#5a5a6a] hover:text-red-400 shrink-0">
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Raw disks */}
          <div>
            <h2 className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider mb-3">
              Available Disks
              {selectedCount > 0 && <span className="text-accent-400 ml-1.5">· {selectedCount} selected</span>}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {rawDisks.map((disk) => {
                const isSel = !!selected[disk.name]
                const hasParts = disk.children && disk.children.length > 0
                const isMounted = disk.children?.some((c) => c.mountpoint)

                return (
                  <div
                    key={disk.name}
                    className={`card p-4 transition-all duration-200 ${
                      isSel
                        ? 'ring-2 ring-accent-500 shadow-lg shadow-accent-500/10'
                        : disk.isSystem
                          ? 'opacity-60'
                          : 'hover:border-accent-500/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${isSel ? 'bg-accent-500/20' : 'bg-base-800/60'} transition-all`}>
                        <DiskTypeIcon disk={disk} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-[#e4e4ed] truncate">
                            {disk.model || `/dev/${disk.name}`}
                          </h3>
                          <DiskTypeLabel disk={disk} />
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[#8a8a9a]">
                          <span className="font-mono">{formatDiskSize(disk.size)}</span>
                          <span className="text-[#5a5a6a]">·</span>
                          <span className="text-[#5a5a6a]">{disk.serial || '—'}</span>
                        </div>
                        {disk.tran && (
                          <div className="text-[10px] text-[#5a5a6a] mt-0.5">
                            {disk.tran.toUpperCase()} {disk.rota === '1' ? 'HDD' : 'SSD'}
                          </div>
                        )}
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!disk.isSystem && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleDisk(disk.name) }}
                              className={`btn-ghost p-1.5 ${isSel ? 'text-accent-400' : 'text-[#5a5a6a]'}`}
                              title="Select for pool"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleFormat(disk) }}
                              disabled={formatting === disk.name}
                              className="btn-ghost p-1.5 text-[#5a5a6a] hover:text-accent-400"
                              title="Format"
                            >
                              {formatting === disk.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Partitions */}
                    {hasParts && (
                      <div className="mt-3 space-y-1 border-t border-base-700/30 pt-3">
                        {disk.children.map((part) => (
                          <div key={part.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#5a5a6a] font-mono">{part.name}</span>
                              {part.fstype && <span className="text-[#5a5a6a]">· {part.fstype}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {part.mountpoint && <span className="text-[#8a8a9a] truncate max-w-[120px]">{part.mountpoint}</span>}
                              <span className="text-[#5a5a6a] font-mono">{formatDiskSize(part.size)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {rawDisks.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center h-40 gap-2">
                  <Database className="w-8 h-8 text-[#5a5a6a]" />
                  <p className="text-sm text-[#8a8a9a]">All disks are formatted and mounted.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
