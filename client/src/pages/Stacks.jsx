import { useState, useEffect, useCallback } from 'react'
import { Layers, Plus, Trash2, Play, Terminal, X, Edit3, Loader } from 'lucide-react'
import { api } from '../lib/api'
import { stateColor, stateBg } from '../lib/utils'

export default function Stacks() {
  const [stacks, setStacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDeploy, setShowDeploy] = useState(false)
  const [stackName, setStackName] = useState('')
  const [composeYaml, setComposeYaml] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [error, setError] = useState('')

  const [editStack, setEditStack] = useState(null)
  const [editYaml, setEditYaml] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchStacks = useCallback(async () => {
    try {
      const data = await api.docker.stacks()
      setStacks(data)
    } catch (err) {
      console.error('Failed to fetch stacks:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStacks()
    const interval = setInterval(fetchStacks, 10000)
    return () => clearInterval(interval)
  }, [fetchStacks])

  const handleDeploy = async (e) => {
    e.preventDefault()
    if (!stackName || !composeYaml) return
    setDeploying(true)
    setError('')
    try {
      await api.docker.deployStack(stackName, composeYaml)
      setShowDeploy(false)
      setStackName('')
      setComposeYaml('')
      fetchStacks()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeploying(false)
    }
  }

  const handleDestroy = async (name) => {
    if (!confirm(`Destroy stack "${name}"? This will remove all associated containers and volumes.`)) return
    try {
      await api.docker.destroyStack(name)
      fetchStacks()
    } catch (err) {
      console.error('Failed to destroy stack:', err)
    }
  }

  const handleEdit = async (name) => {
    setEditStack(name)
    setEditLoading(true)
    setError('')
    try {
      const { content } = await api.docker.stackCompose(name)
      setEditYaml(content)
    } catch (err) {
      setError(err.message)
      setEditStack(null)
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
      fetchStacks()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100 tracking-tight">Stacks</h1>
        <button
          onClick={() => setShowDeploy(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-accent-500 hover:bg-accent-600 text-white transition-all shadow-lg shadow-accent-500/20"
        >
          <Plus className="w-4 h-4" />
          Deploy Stack
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-surface-500 text-sm">Loading stacks...</div>
        </div>
      ) : stacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Layers className="w-12 h-12 text-surface-700" />
          <div className="text-surface-500 text-sm">No Docker Compose stacks found.</div>
          <button
            onClick={() => setShowDeploy(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Deploy your first stack
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stacks.map((stack) => (
            <div
              key={stack.name}
              className={`rounded-xl border p-5 space-y-4 ${stateBg(stack.status)}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-surface-200">{stack.name}</h3>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {stack.services.length} service{stack.services.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${stateColor(stack.status)} bg-surface-800/50`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stack.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-surface-500'}`} />
                  {stack.status}
                </span>
              </div>

              <div className="space-y-1.5">
                {stack.services.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-surface-800/30">
                    <div className="flex items-center gap-2">
                      <Play className={`w-3 h-3 ${stateColor(svc.state)}`} />
                      <span className="text-sm text-surface-300">{svc.name}</span>
                    </div>
                    <span className={`text-xs ${stateColor(svc.state)}`}>{svc.state}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-surface-800/50 flex justify-end gap-2">
                <button
                  onClick={() => handleEdit(stack.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-accent-400 hover:bg-accent-500/10 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => handleDestroy(stack.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Destroy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deploy Modal */}
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
              <button onClick={() => { setShowDeploy(false); setError('') }} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all">
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
              {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowDeploy(false); setError('') }} className="px-4 py-2 text-sm font-medium rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all">Cancel</button>
                <button type="submit" disabled={deploying} className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-500 hover:bg-accent-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">{deploying ? 'Deploying...' : 'Deploy'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
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
              <button onClick={() => { setEditStack(null); setError('') }} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all">
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
                {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setEditStack(null); setError('') }} className="px-4 py-2 text-sm font-medium rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all">Cancel</button>
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
