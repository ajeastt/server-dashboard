import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Search, ChevronDown, ChevronRight, Layers, Box, Plus, Edit3, Trash2, Terminal, X, Download, Check, Play, Square, Loader } from 'lucide-react'
import { api } from '../lib/api'
import StackUpdateModal from '../components/StackUpdateModal'
import YamlEditor from '../components/YamlEditor'

export default function Containers() {
  const [containers, setContainers] = useState([])
  const [stacks, setStacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
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

  const fetchAll = useCallback(async () => {
    try {
      const [ctrs, stks] = await Promise.all([
        api.docker.containers(),
        api.docker.stacks(),
      ])
      setContainers(ctrs)
      setStacks(stks)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
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

  const containerPassesFilter = (c) => {
    if (filter !== 'all' && c.state !== filter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.image.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }

  const projectContainers = (containers.filter((c) => c.composeProject).reduce((acc, c) => {
    if (!acc[c.composeProject]) acc[c.composeProject] = []
    acc[c.composeProject].push(c)
    return acc
  }, {}))

  const standalone = containers.filter((c) => !c.composeProject).filter(containerPassesFilter)

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a6a]" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" />
        </div>
        <div className="flex gap-1">
          {['all', 'running', 'exited', 'paused'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${filter === f ? 'bg-accent-500/10 text-accent-400' : 'text-[#8a8a9a] hover:text-[#e4e4ed] hover:bg-white/[0.04]'}`}>{f}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-[#8a8a9a]">Loading containers...</div>
      ) : (
        <div className="space-y-2">
          {stacks.map((stack) => {
            const ctrs = projectContainers[stack.name]?.filter(containerPassesFilter) || []
            if (ctrs.length === 0 && !search) return null
            if (search && ctrs.length === 0) return null
            const expanded = expandedStacks[stack.name] !== false

            return (
              <div key={stack.name} className="card overflow-hidden">
                <button onClick={() => toggleStack(stack.name)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-all">
                  {expanded ? <ChevronDown className="w-4 h-4 text-[#5a5a6a]" /> : <ChevronRight className="w-4 h-4 text-[#5a5a6a]" />}
                  <Layers className="w-4 h-4 text-accent-400" />
                  <span className="text-sm font-medium text-[#e4e4ed]">{stack.name}</span>
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
                {expanded && ctrs.length > 0 && ctrs.map((c) => (
                  <div key={c.id} className={`flex items-center gap-3 px-4 py-2 border-t border-base-700/30 hover:bg-white/[0.02] transition-all ${actingContainers[c.id] ? 'container-row-glow' : ''}`}>
                    {statusDot(c.state)}
                    <Link to={`/containers/${c.id}`} className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#e4e4ed] hover:text-accent-400 transition-colors truncate">{c.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[#5a5a6a] truncate">{c.image}</span>
                        {uptime(c.status)}
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 hidden lg:flex">{formatPorts(c.ports)}</div>
                    <span className="text-xs text-[#5a5a6a] whitespace-nowrap">{c.state === 'running' ? c.status : ''}</span>
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
                ))}
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
              {standalone.map((c) => (
                <div key={c.id} className={`flex items-center gap-3 px-4 py-2 border-t border-base-700/20 hover:bg-white/[0.02] transition-all ${actingContainers[c.id] ? 'container-row-glow' : ''}`}>
                  {statusDot(c.state)}
                  <Link to={`/containers/${c.id}`} className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#e4e4ed] hover:text-accent-400 transition-colors truncate">{c.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#5a5a6a] truncate">{c.image}</span>
                      {uptime(c.status)}
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 hidden lg:flex">{formatPorts(c.ports)}</div>
                  <span className="text-xs text-[#5a5a6a] whitespace-nowrap">{c.state === 'running' ? c.status : ''}</span>
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
              ))}
            </div>
          )}

          {!search && stacks.length === 0 && standalone.length === 0 && (
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
                  <YamlEditor value={composeYaml} onChange={setComposeYaml} placeholder={`services:\n  app:\n    image: nginx:latest\n    ports:\n      - "80:80"`} minHeight="200px" />
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
                <div className="border border-base-700/60 rounded-lg overflow-hidden"><YamlEditor value={editYaml} onChange={setEditYaml} minHeight="300px" /></div>
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
