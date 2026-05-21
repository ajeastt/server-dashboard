import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, ChevronDown, ChevronRight, Layers, Box, Plus, Edit3, Trash2, Terminal, X, Download, Check, Play, Square, Loader, Cpu, MemoryStick } from 'lucide-react'
import { api } from '../lib/api'
import StackUpdateModal from '../components/StackUpdateModal'
import CodeEditor from '../components/CodeEditor'

export default function Containers() {
  const [containers, setContainers] = useState([])
  const [stacks, setStacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedStacks, setExpandedStacks] = useState({})

  const [showDeploy, setShowDeploy] = useState(false)
  const [stackName, setStackName] = useState('')
  const [composeYaml, setComposeYaml] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validMsg, setValidMsg] = useState(null)
  const [error, setError] = useState('')

  const [editStack, setEditStack] = useState(null)
  const [editYaml, setEditYaml] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updateStack, setUpdateStack] = useState(null)

  const [restartingStacks, setRestartingStacks] = useState({})
  const [restartedStacks, setRestartedStacks] = useState({})
  const [actingContainers, setActingContainers] = useState({})
  const [stats, setStats] = useState({})

  const summary = useMemo(() => {
    const r = { running: 0, stopped: 0, paused: 0, total: containers.length }
    containers.forEach((c) => {
      if (c.state === 'running') r.running++
      else if (c.state === 'exited' || c.state === 'stopped') r.stopped++
      else if (c.state === 'paused') r.paused++
    })
    return r
  }, [containers])

  const relativeTime = (ts) => {
    const diff = Math.floor((Date.now() - ts * 1000) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
    return `${Math.floor(diff / 2592000)}mo ago`
  }

  const formatBytes = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(0)}MB`
    return `${(bytes / 1073741824).toFixed(1)}GB`
  }

  const exitCode = (status) => {
    const m = status?.match(/Exited\s*\((\d+)\)/)
    return m ? parseInt(m[1]) : null
  }

  const fetchAll = useCallback(async () => {
    try {
      const [ctrs, stks] = await Promise.all([
        api.docker.containers(),
        api.docker.stacks(),
      ])
      setContainers(ctrs)
      setStacks(stks)
      setLoading(false)
      api.docker.allStats().then(s => setStats(s || {})).catch(() => {})
    } catch (err) {
      console.error('Failed to fetch:', err)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 5000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const handleAction = async (id, action) => {
    if (actingContainers[id]) return
    setActingContainers((prev) => ({ ...prev, [id]: true }))
    try {
      await api.docker.action(id, action)
      fetchAll()
    } catch (err) {
      console.error(`Action ${action} failed:`, err)
    } finally {
      setActingContainers((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleRestartStack = async (name) => {
    if (restartingStacks[name]) return
    setRestartingStacks((prev) => ({ ...prev, [name]: true }))
    setRestartedStacks((prev) => ({ ...prev, [name]: false }))
    try {
      await api.docker.restartStack(name)
      setRestartedStacks((prev) => ({ ...prev, [name]: true }))
      setTimeout(() => setRestartedStacks((prev) => ({ ...prev, [name]: false })), 3000)
      fetchAll()
    } catch (err) {
      console.error('Failed to restart stack:', err)
    } finally {
      setRestartingStacks((prev) => ({ ...prev, [name]: false }))
    }
  }

  const projectContainers = (containers.filter((c) => c.composeProject).reduce((acc, c) => {
    if (!acc[c.composeProject]) acc[c.composeProject] = []
    acc[c.composeProject].push(c)
    return acc
  }, {}))

  const standalone = containers.filter((c) => !c.composeProject)

  const toggleStack = (name) => setExpandedStacks((prev) => ({ ...prev, [name]: !prev[name] }))

  const handleValidate = async () => {
    const yaml = editStack ? editYaml : composeYaml
    if (!yaml) return
    setValidating(true)
    setValidMsg(null)
    setError('')
    try {
      const result = await api.docker.validateCompose(yaml)
      setValidMsg(result.valid ? { type: 'success', text: 'Valid compose file' } : { type: 'error', text: result.error })
    } catch (err) {
      setValidMsg({ type: 'error', text: err.message })
    } finally {
      setValidating(false)
    }
  }

  const handleDeploy = async (e) => {
    e.preventDefault()
    if (!stackName || !composeYaml) return
    setDeploying(true)
    setError('')
    setValidMsg(null)
    try {
      await api.docker.deployStack(stackName, composeYaml)
      setShowDeploy(false); setStackName(''); setComposeYaml('')
      fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeploying(false)
    }
  }

  const handleUpdateDone = () => { setUpdateStack(null); fetchAll() }

  const handleDestroy = async (name) => {
    if (!confirm(`Destroy stack "${name}"? This will remove all associated containers and volumes.`)) return
    try { await api.docker.destroyStack(name); fetchAll() }
    catch (err) { console.error(err) }
  }

  const handleEdit = async (name) => {
    setEditStack(name); setEditYaml(''); setEditLoading(true); setError(''); setValidMsg(null)
    try { const { content } = await api.docker.stackCompose(name); setEditYaml(content) }
    catch (err) { setError(err.message) }
    finally { setEditLoading(false) }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try { await api.docker.updateStackCompose(editStack, editYaml); setEditStack(null); fetchAll() }
    catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const formatPorts = (ports) => {
    if (!ports || ports.length === 0) return null
    return ports.map((p, i) => (
      <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-base-800/60 border border-base-700/40 text-[#8a8a9a] whitespace-nowrap">
        {p.PublicPort > 0 ? p.PublicPort : '-'}:{p.PrivatePort}/{p.Type}
      </span>
    ))
  }

  const uptime = (status) => {
    if (!status || !status.startsWith('Up')) return null
    return <span className="text-[10px] text-emerald-400/60 font-mono">⬤ {status}</span>
  }

  const statusDot = (state) => {
    const colors = { running: 'bg-emerald-400', paused: 'bg-amber-400', exited: 'bg-red-400', stopped: 'bg-red-400' }
    return <span className={`w-1.5 h-1.5 rounded-full inline-block ${colors[state] || 'bg-[#5a5a6a]'}`} />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Containers</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDeploy(true)} className="btn-primary"><Plus className="w-4 h-4" /> Deploy</button>
          <button onClick={fetchAll} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 card">
        <span className="text-xs text-[#8a8a9a]">
          <span className="text-emerald-400 font-medium">{summary.running}</span> running
          {summary.stopped > 0 && <>, <span className="text-red-400 font-medium">{summary.stopped}</span> stopped</>}
          {summary.paused > 0 && <>, <span className="text-amber-400 font-medium">{summary.paused}</span> paused</>}
          <span className="text-[#5a5a6a] ml-1">· {summary.total} total</span>
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-[#8a8a9a]">Loading containers...</div>
      ) : (
        <div className="space-y-2">
          {stacks.map((stack) => {
            const ctrs = projectContainers[stack.name] || []
            if (ctrs.length === 0) return null
            const expanded = expandedStacks[stack.name] !== false

            return (
              <div key={stack.name} className="card overflow-hidden">
                <button onClick={() => toggleStack(stack.name)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-all">
                  {expanded ? <ChevronDown className="w-4 h-4 text-[#5a5a6a]" /> : <ChevronRight className="w-4 h-4 text-[#5a5a6a]" />}
                  <Layers className="w-4 h-4 text-accent-400" />
                  <Link to={`/stacks/${stack.name}`} className="text-sm font-medium text-[#e4e4ed] hover:text-accent-400 transition-colors">{stack.name}</Link>
                  <span className={`badge ${stack.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#1e1e2c] text-[#5a5a6a]'}`}>{stack.status}</span>
                  <span className="text-xs text-[#5a5a6a]">{ctrs.length} service{ctrs.length !== 1 ? 's' : ''}</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setUpdateStack(stack.name)} className="btn-ghost p-1.5" title="Update"><Download className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleRestartStack(stack.name)} className={`p-1.5 rounded-lg transition-all ${restartedStacks[stack.name] ? 'text-emerald-400' : 'btn-ghost p-1.5'}`} title="Restart">
                      {restartingStacks[stack.name] ? <Loader className="w-3.5 h-3.5 animate-spin" /> : restartedStacks[stack.name] ? <Check className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleEdit(stack.name)} className="btn-ghost p-1.5" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDestroy(stack.name)} className="btn-ghost p-1.5 hover:text-red-400" title="Destroy"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </button>
                {expanded && ctrs.length > 0 && ctrs.map((c) => {
                  const s = stats[c.id]
                  const ec = exitCode(c.status)
                  return (
                  <div key={c.id} className={`flex items-center gap-3 px-4 py-2 border-t border-base-700/30 border-l-2 hover:bg-white/[0.02] transition-all ${c.state === 'running' ? 'border-l-emerald-500/30' : c.state === 'exited' || c.state === 'stopped' ? 'border-l-red-500/30' : 'border-l-amber-500/30'} ${actingContainers[c.id] ? 'container-row-glow' : ''}`}>
                    {statusDot(c.state)}
                    <Link to={`/containers/${c.id}`} className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#e4e4ed] hover:text-accent-400 transition-colors truncate">{c.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[#5a5a6a] truncate">{c.image}</span>
                        {uptime(c.status)}
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 hidden lg:flex">{formatPorts(c.ports)}</div>
                    {c.state === 'running' && s ? (
                      <div className="flex items-center gap-2 text-[10px] text-[#5a5a6a] font-mono whitespace-nowrap">
                        <span className="flex items-center gap-0.5"><Cpu className="w-2.5 h-2.5" />{s.cpuPercent.toFixed(1)}%</span>
                        <span className="flex items-center gap-0.5"><MemoryStick className="w-2.5 h-2.5" />{formatBytes(s.memUsage)}</span>
                      </div>
                    ) : ec !== null ? (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${ec === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>exit {ec}</span>
                    ) : null}
                    <span className="text-[10px] text-[#5a5a6a] font-mono whitespace-nowrap">{relativeTime(c.created)}</span>
                    <div className="flex items-center gap-0.5">
                      {c.state === 'running' ? (
                        <button onClick={() => handleAction(c.id, 'stop')} disabled={actingContainers[c.id]} className="p-1 rounded text-[#5a5a6a] hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50" title="Stop">
                          {actingContainers[c.id] ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <button onClick={() => handleAction(c.id, 'start')} disabled={actingContainers[c.id]} className="p-1 rounded text-[#5a5a6a] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-50" title="Start">
                          {actingContainers[c.id] ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button onClick={() => handleAction(c.id, 'restart')} disabled={actingContainers[c.id]} className="p-1 rounded text-[#5a5a6a] hover:text-accent-400 hover:bg-accent-500/10 transition-all disabled:opacity-50" title="Restart"><RefreshCw className="w-3.5 h-3.5" /></button>
                      <Link to={`/containers/${c.id}`} className="p-1 rounded text-[#5a5a6a] hover:text-accent-400 hover:bg-accent-500/10 transition-all" title="Logs"><Terminal className="w-3.5 h-3.5" /></Link>
                    </div>
                  </div>
                  )
                })}
              </div>
            )
          })}

          {standalone.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-base-700/30">
                <Box className="w-4 h-4 text-[#5a5a6a]" />
                <span className="text-sm font-medium text-[#8a8a9a]">Standalone</span>
                <span className="text-xs text-[#5a5a6a]">{standalone.length}</span>
              </div>
              {standalone.map((c) => {
                const s = stats[c.id]
                const ec = exitCode(c.status)
                return (
                <div key={c.id} className={`flex items-center gap-3 px-4 py-2 border-t border-base-700/20 border-l-2 hover:bg-white/[0.02] transition-all ${c.state === 'running' ? 'border-l-emerald-500/30' : c.state === 'exited' || c.state === 'stopped' ? 'border-l-red-500/30' : 'border-l-amber-500/30'} ${actingContainers[c.id] ? 'container-row-glow' : ''}`}>
                  {statusDot(c.state)}
                  <Link to={`/containers/${c.id}`} className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#e4e4ed] hover:text-accent-400 transition-colors truncate">{c.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#5a5a6a] truncate">{c.image}</span>
                      {uptime(c.status)}
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 hidden lg:flex">{formatPorts(c.ports)}</div>
                  {c.state === 'running' && s ? (
                    <div className="flex items-center gap-2 text-[10px] text-[#5a5a6a] font-mono whitespace-nowrap">
                      <span className="flex items-center gap-0.5"><Cpu className="w-2.5 h-2.5" />{s.cpuPercent.toFixed(1)}%</span>
                      <span className="flex items-center gap-0.5"><MemoryStick className="w-2.5 h-2.5" />{formatBytes(s.memUsage)}</span>
                    </div>
                  ) : ec !== null ? (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${ec === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>exit {ec}</span>
                  ) : null}
                  <span className="text-[10px] text-[#5a5a6a] font-mono whitespace-nowrap">{relativeTime(c.created)}</span>
                  <div className="flex items-center gap-0.5">
                    {c.state === 'running' ? (
                      <button onClick={() => handleAction(c.id, 'stop')} disabled={actingContainers[c.id]} className="p-1 rounded text-[#5a5a6a] hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50" title="Stop">
                        {actingContainers[c.id] ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <button onClick={() => handleAction(c.id, 'start')} disabled={actingContainers[c.id]} className="p-1 rounded text-[#5a5a6a] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-50" title="Start">
                        {actingContainers[c.id] ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button onClick={() => handleAction(c.id, 'restart')} disabled={actingContainers[c.id]} className="p-1 rounded text-[#5a5a6a] hover:text-accent-400 hover:bg-accent-500/10 transition-all disabled:opacity-50" title="Restart"><RefreshCw className="w-3.5 h-3.5" /></button>
                    <Link to={`/containers/${c.id}`} className="p-1 rounded text-[#5a5a6a] hover:text-accent-400 hover:bg-accent-500/10 transition-all" title="Logs"><Terminal className="w-3.5 h-3.5" /></Link>
                  </div>
                </div>
                )
              })}
            </div>
          )}

          {stacks.length === 0 && standalone.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Box className="w-10 h-10 text-[#5a5a6a]" />
              <p className="text-sm text-[#8a8a9a]">No containers found.</p>
              <button onClick={() => setShowDeploy(true)} className="btn-primary"><Plus className="w-4 h-4" /> Deploy your first stack</button>
            </div>
          )}
        </div>
      )}

      {/* Deploy modal */}
      {showDeploy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { setShowDeploy(false); setError(''); setValidMsg(null) }}>
          <div className="w-full max-w-2xl mx-4 rounded-xl border border-base-700/60 bg-base-900 shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-700/40">
              <div>
                <h2 className="text-sm font-semibold text-[#e4e4ed]">Deploy Stack</h2>
                <p className="text-xs text-[#8a8a9a] mt-0.5">Paste your docker-compose.yml below</p>
              </div>
              <button onClick={() => { setShowDeploy(false); setError(''); setValidMsg(null) }} className="p-1 rounded text-[#8a8a9a] hover:text-[#e4e4ed] hover:bg-white/[0.04] transition-all"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleDeploy} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Stack Name</label>
                <input type="text" value={stackName} onChange={(e) => setStackName(e.target.value)} placeholder="my-stack" className="input font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">docker-compose.yml</label>
                <div className="border border-base-700/60 rounded-lg overflow-hidden">
                  <CodeEditor lang="yaml" value={composeYaml} onChange={setComposeYaml} placeholder={`services:\n  app:\n    image: nginx:latest\n    ports:\n      - "80:80"`} minHeight="200px" />
                </div>
              </div>
              {validMsg && <div className={`p-3 rounded-lg border text-sm ${validMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{validMsg.text}</div>}
              {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowDeploy(false); setError(''); setValidMsg(null) }} className="btn-secondary">Cancel</button>
                <button type="button" onClick={handleValidate} disabled={validating || !composeYaml} className="btn-secondary disabled:opacity-50">{validating ? 'Validating...' : 'Validate'}</button>
                <button type="submit" disabled={deploying} className="btn-primary disabled:opacity-50">{deploying ? 'Deploying...' : 'Deploy'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {updateStack && <StackUpdateModal name={updateStack} onClose={() => setUpdateStack(null)} onDone={handleUpdateDone} />}

      {/* Edit modal */}
      {editStack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { setEditStack(null); setError(''); setValidMsg(null) }}>
          <div className="w-full max-w-2xl mx-4 rounded-xl border border-base-700/60 bg-base-900 shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-700/40">
              <div>
                <h2 className="text-sm font-semibold text-[#e4e4ed]">Edit Stack: {editStack}</h2>
                <p className="text-xs text-[#8a8a9a] mt-0.5">Edit docker-compose.yml and redeploy</p>
              </div>
              <button onClick={() => { setEditStack(null); setError(''); setValidMsg(null) }} className="p-1 rounded text-[#8a8a9a] hover:text-[#e4e4ed] hover:bg-white/[0.04] transition-all"><X className="w-4 h-4" /></button>
            </div>
            {editLoading ? (
              <div className="p-10 flex justify-center"><Loader className="w-5 h-5 animate-spin text-[#8a8a9a]" /></div>
            ) : (
              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="border border-base-700/60 rounded-lg overflow-hidden"><CodeEditor lang="yaml" value={editYaml} onChange={setEditYaml} minHeight="300px" /></div>
                {validMsg && <div className={`p-3 rounded-lg border text-sm ${validMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{validMsg.text}</div>}
                {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setEditStack(null); setError(''); setValidMsg(null) }} className="btn-secondary">Cancel</button>
                  <button type="button" onClick={handleValidate} disabled={validating || !editYaml} className="btn-secondary disabled:opacity-50">{validating ? 'Validating...' : 'Validate'}</button>
                  <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving & Redeploying...' : 'Save & Redeploy'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
