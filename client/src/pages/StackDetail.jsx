import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader, RefreshCw, Download, Trash2, Save, Layers, Box, Cpu, MemoryStick, Terminal, Play, Square, Check } from 'lucide-react'
import { api } from '../lib/api'
import CodeEditor from '../components/CodeEditor'
import StackUpdateModal from '../components/StackUpdateModal'

export default function StackDetail() {
  const { name } = useParams()
  const navigate = useNavigate()
  const [stack, setStack] = useState(null)
  const [containers, setContainers] = useState([])
  const [stats, setStats] = useState({})
  const [compose, setCompose] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [updateStack, setUpdateStack] = useState(null)
  const [actingContainers, setActingContainers] = useState({})

  const fetchAll = async () => {
    try {
      const [stks, ctrs, allStats, comp] = await Promise.all([
        api.docker.stacks(),
        api.docker.containers(),
        api.docker.allStats().catch(() => ({})),
        api.docker.stackCompose(name),
      ])
      const s = stks.find((st) => st.name === name)
      setStack(s || null)
      setContainers(ctrs.filter((c) => c.composeProject === name))
      setStats(allStats || {})
      setCompose(comp.content)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [name])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await api.docker.updateStackCompose(name, compose)
      await api.docker.restartStack(name)
      fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDestroy = async () => {
    if (!confirm(`Destroy stack "${name}"? All containers and volumes will be removed.`)) return
    try {
      await api.docker.destroyStack(name)
      navigate('/containers')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAction = async (id, action) => {
    if (actingContainers[id]) return
    setActingContainers({ ...actingContainers, [id]: true })
    try {
      await api.docker.action(id, action)
      fetchAll()
    } catch (err) {
      console.error(err)
    } finally {
      setActingContainers({ ...actingContainers, [id]: false })
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(0)}MB`
    return `${(bytes / 1073741824).toFixed(1)}GB`
  }

  const statusDot = (state) => {
    const colors = { running: 'bg-emerald-400', paused: 'bg-amber-400', exited: 'bg-red-400', stopped: 'bg-red-400' }
    return <span className={`w-1.5 h-1.5 rounded-full inline-block ${colors[state] || 'bg-[#5a5a6a]'}`} />
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-[#8a8a9a]"><Loader className="w-4 h-4 animate-spin mr-2" />Loading...</div>
  }

  if (error && !stack) {
    return (
      <div className="space-y-4">
        <Link to="/containers" className="inline-flex items-center gap-1 text-sm text-[#8a8a9a] hover:text-[#e4e4ed] transition-all"><ArrowLeft className="w-4 h-4" /> Back</Link>
        <div className="text-sm text-red-400">{error}</div>
      </div>
    )
  }

  const running = containers.filter((c) => c.state === 'running').length
  const total = containers.length

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 sticky top-0 z-20 bg-base-950 py-3 border-b border-base-700/30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <Link to="/containers" className="p-1 rounded text-[#8a8a9a] hover:text-[#e4e4ed] hover:bg-white/[0.04] transition-all"><ArrowLeft className="w-4 h-4" /></Link>
        <Layers className="w-5 h-5 text-accent-400" />
        <div className="flex-1">
          <h1 className="page-title">{name}</h1>
          <p className="text-xs text-[#8a8a9a]">{running}/{total} services running{stack?.status === 'running' ? '' : ' — stack stopped'}</p>
        </div>
        <span className={`badge ${stack?.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#1e1e2c] text-[#5a5a6a]'}`}>{stack?.status || 'unknown'}</span>
        <button onClick={() => setUpdateStack(name)} className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> Update</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-xs"><Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save & Redeploy'}</button>
        <button onClick={handleDestroy} className="btn-secondary text-xs hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /> Destroy</button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}

      {/* Two-column: compose editor + service list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compose editor */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-base-700/30 flex items-center justify-between">
            <span className="text-xs font-medium text-[#8a8a9a]">docker-compose.yml</span>
            <button onClick={handleSave} disabled={saving} className="btn-ghost text-xs p-1"><Save className="w-3 h-3" /> Save</button>
          </div>
          <CodeEditor lang="yaml" value={compose} onChange={setCompose} minHeight="400px" maxHeight="calc(100vh - 260px)" />
        </div>

        {/* Service list */}
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-base-700/30">
            <span className="text-xs font-medium text-[#8a8a9a]">Services</span>
          </div>
          <div className="divide-y divide-base-700/20">
            {containers.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-[#5a5a6a]">No services</div>
            )}
            {containers.map((c) => {
              const s = stats[c.id]
              return (
                <div key={c.id} className="px-4 py-3 hover:bg-white/[0.02] transition-all">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${c.state === 'running' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#e4e4ed] truncate">{c.name}</span>
                        <span className="text-[10px] text-[#5a5a6a] truncate hidden sm:inline">{c.image}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {s ? (
                          <div className="flex items-center gap-2 text-[10px] text-[#5a5a6a] font-mono">
                            <span className="flex items-center gap-0.5"><Cpu className="w-2.5 h-2.5" />{s.cpuPercent.toFixed(1)}%</span>
                            <span className="flex items-center gap-0.5"><MemoryStick className="w-2.5 h-2.5" />{formatBytes(s.memUsage)}</span>
                          </div>
                        ) : null}
                        {c.state !== 'running' && c.status?.includes('Exited') && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">{c.status}</span>
                        )}
                        <Link to={`/containers/${c.id}`} className="text-[10px] text-accent-400 hover:underline">logs</Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {c.state === 'running' ? (
                        <button onClick={() => handleAction(c.id, 'stop')} className="p-1 rounded text-[#5a5a6a] hover:text-red-400 hover:bg-red-500/10 transition-all" title="Stop">
                          {actingContainers[c.id] ? <Loader className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                        </button>
                      ) : (
                        <button onClick={() => handleAction(c.id, 'start')} className="p-1 rounded text-[#5a5a6a] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all" title="Start">
                          {actingContainers[c.id] ? <Loader className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {updateStack && <StackUpdateModal name={updateStack} onClose={() => setUpdateStack(null)} onDone={() => { setUpdateStack(null); fetchAll() }} />}
    </div>
  )
}
