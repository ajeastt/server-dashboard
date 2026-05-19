import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Search, ChevronDown, ChevronRight, Layers, Box, Plus, Edit3, Trash2, Terminal, X, Loader, Download, Check } from 'lucide-react'
import { api } from '../lib/api'
import ContainerCard from '../components/ContainerCard'
import StackUpdateModal from '../components/StackUpdateModal'

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
    try {
      await api.docker.action(id, action)
      fetchAll()
    } catch (err) {
      console.error(`Action ${action} failed:`, err)
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

  const toggleStack = (name) => {
    setExpandedStacks((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const handleValidate = async () => {
    const yaml = editStack ? editYaml : composeYaml
    if (!yaml) return
    setValidating(true)
    setValidMsg(null)
    setError('')
    try {
      const result = await api.docker.validateCompose(yaml)
      if (result.valid) {
        setValidMsg({ type: 'success', text: 'Valid compose file' })
      } else {
        setValidMsg({ type: 'error', text: result.error })
      }
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
      setShowDeploy(false)
      setStackName('')
      setComposeYaml('')
      fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeploying(false)
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

  const handleUpdateDone = () => {
    setUpdateStack(null)
    fetchAll()
  }

  const handleDestroy = async (name) => {
    if (!confirm(`Destroy stack "${name}"? This will remove all associated containers and volumes.`)) return
    try {
      await api.docker.destroyStack(name)
      fetchAll()
    } catch (err) {
      console.error('Failed to destroy stack:', err)
    }
  }

  const handleEdit = async (name) => {
    setEditStack(name)
    setEditYaml('')
    setEditLoading(true)
    setError('')
    setValidMsg(null)
    try {
      const { content } = await api.docker.stackCompose(name)
      setEditYaml(content)
    } catch (err) {
      setError(err.message)
    } finally {
      setEditLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.docker.updateStackCompose(editStack, editYaml)
      setEditStack(null)
      fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100 tracking-tight">Containers</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeploy(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-accent-500 hover:bg-accent-600 text-white transition-all shadow-lg shadow-accent-500/20"
          >
            <Plus className="w-4 h-4" />
            Deploy
          </button>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            placeholder="Search containers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-surface-800 bg-surface-900 text-surface-200 placeholder-surface-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'running', 'exited', 'paused'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm font-medium rounded-lg capitalize transition-all ${
                filter === f
                  ? 'bg-accent-500/10 text-accent-400 border border-accent-500/20'
                  : 'text-surface-400 hover:text-surface-200 border border-surface-800 hover:bg-surface-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-surface-500 text-sm">Loading containers...</div>
        </div>
      ) : (
        <div className="space-y-8">
          {stacks.map((stack) => {
            const ctrs = projectContainers[stack.name]?.filter(containerPassesFilter) || []
            if (ctrs.length === 0 && !search) return null
            if (search && ctrs.length === 0) return null
            const expanded = expandedStacks[stack.name] !== false

            return (
              <div key={stack.name} className="rounded-xl border border-surface-800 bg-surface-900/50 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 bg-surface-900 border-b border-surface-800/50">
                  <button onClick={() => toggleStack(stack.name)} className="flex items-center gap-3 flex-1 text-left">
                    {expanded ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronRight className="w-4 h-4 text-surface-500" />}
                    <Layers className="w-5 h-5 text-accent-400" />
                    <span className="text-sm font-semibold text-surface-200">{stack.name}</span>
                    {restartingStacks[stack.name] ? (
                      <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 animate-pulse">
                        restarting
                      </span>
                    ) : (
                      <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                        stack.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-800 text-surface-500'
                      }`}>
                        {stack.status}
                      </span>
                    )}
                    <span className="text-xs text-surface-500">{ctrs.length} service{ctrs.length !== 1 ? 's' : ''}</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setUpdateStack(stack.name)} className="p-1.5 rounded-lg text-surface-500 hover:text-accent-400 hover:bg-accent-500/10 transition-all" title="Update all images">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleRestartStack(stack.name)} className={`p-1.5 rounded-lg transition-all ${
                      restartedStacks[stack.name]
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : restartingStacks[stack.name]
                          ? 'text-amber-400 bg-amber-500/10 cursor-wait'
                          : 'text-surface-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                    }`} title={restartingStacks[stack.name] ? 'Restarting...' : 'Restart stack'}>
                      {restartingStacks[stack.name] ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : restartedStacks[stack.name] ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                    <button onClick={() => handleEdit(stack.name)} className="p-1.5 rounded-lg text-surface-500 hover:text-accent-400 hover:bg-accent-500/10 transition-all" title="Edit compose">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDestroy(stack.name)} className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Destroy stack">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="p-4 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {ctrs.map((c) => (
                        <ContainerCard key={c.id} container={c} onAction={handleAction} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {standalone.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Box className="w-4 h-4 text-surface-500" />
                <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Standalone Containers</h2>
                <span className="text-xs text-surface-600">{standalone.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {standalone.map((c) => (
                  <ContainerCard key={c.id} container={c} onAction={handleAction} />
                ))}
              </div>
            </div>
          )}

          {!search && stacks.length === 0 && standalone.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Box className="w-12 h-12 text-surface-700" />
              <div className="text-surface-500 text-sm">No containers found.</div>
              <button
                onClick={() => setShowDeploy(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                Deploy your first stack
              </button>
            </div>
          )}
        </div>
      )}

      {showDeploy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl mx-4 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent-500/10 text-accent-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-surface-200">Deploy Stack</h2>
                  <p className="text-xs text-surface-500">Paste your docker-compose.yml below</p>
                </div>
              </div>
              <button onClick={() => { setShowDeploy(false); setError(''); setValidMsg(null) }} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleDeploy} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Stack Name</label>
                <input type="text" value={stackName} onChange={(e) => setStackName(e.target.value)} placeholder="my-stack" className="w-full px-3 py-2 text-sm rounded-lg border border-surface-700 bg-surface-800 text-surface-200 placeholder-surface-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">docker-compose.yml</label>
                <textarea value={composeYaml} onChange={(e) => setComposeYaml(e.target.value)} placeholder={`services:\n  app:\n    image: nginx:latest\n    ports:\n      - "80:80"`} rows={12} className="w-full px-3 py-2 text-sm rounded-lg border border-surface-700 bg-surface-850 text-surface-200 placeholder-surface-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all font-mono resize-none" required />
              </div>
              {validMsg && (
                <div className={`p-3 rounded-lg border text-sm ${
                  validMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {validMsg.text}
                </div>
              )}
              {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowDeploy(false); setError(''); setValidMsg(null) }} className="px-4 py-2 text-sm font-medium rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all">Cancel</button>
                <button type="button" onClick={handleValidate} disabled={validating || !composeYaml} className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all disabled:opacity-50">{validating ? 'Validating...' : 'Validate'}</button>
                <button type="submit" disabled={deploying} className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-500 hover:bg-accent-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">{deploying ? 'Deploying...' : 'Deploy'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {updateStack && (
        <StackUpdateModal
          name={updateStack}
          onClose={() => setUpdateStack(null)}
          onDone={handleUpdateDone}
        />
      )}

      {editStack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl mx-4 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent-500/10 text-accent-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-surface-200">Edit Stack: {editStack}</h2>
                  <p className="text-xs text-surface-500">Edit docker-compose.yml and redeploy</p>
                </div>
              </div>
              <button onClick={() => { setEditStack(null); setError(''); setValidMsg(null) }} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            {editLoading ? (
              <div className="p-10 flex items-center justify-center">
                <Loader className="w-5 h-5 animate-spin text-surface-400" />
              </div>
            ) : (
              <form onSubmit={handleSave} className="p-5 space-y-4">
                <textarea value={editYaml} onChange={(e) => setEditYaml(e.target.value)} rows={18} className="w-full px-3 py-2 text-sm rounded-lg border border-surface-700 bg-surface-850 text-surface-200 placeholder-surface-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all font-mono resize-none" required />
                {validMsg && (
                  <div className={`p-3 rounded-lg border text-sm ${
                    validMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {validMsg.text}
                  </div>
                )}
                {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setEditStack(null); setError(''); setValidMsg(null) }} className="px-4 py-2 text-sm font-medium rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all">Cancel</button>
                  <button type="button" onClick={handleValidate} disabled={validating || !editYaml} className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all disabled:opacity-50">{validating ? 'Validating...' : 'Validate'}</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-500 hover:bg-accent-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Saving & Redeploying...' : 'Save & Redeploy'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
