import { useState, useEffect, useCallback } from 'react'
import { Image, Trash2, RefreshCw, Download, Plus, X, Loader, AlertTriangle, CheckCircle } from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/utils'
import PullProgressModal from '../components/PullProgressModal'

const CHECK_INTERVAL = 300000

export default function Images() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPull, setShowPull] = useState(false)
  const [pullName, setPullName] = useState('')
  const [message, setMessage] = useState('')
  const [pulling, setPulling] = useState(null)
  const [checking, setChecking] = useState({})
  const [updates, setUpdates] = useState({})

  const fetch = useCallback(async () => {
    try { setImages(await api.docker.images()) }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handlePull = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      await api.docker.pullImage(pullName)
      setMessage(`Pulled ${pullName}`)
      setPullName('')
      setShowPull(false)
      fetch()
    } catch (err) { setMessage(err.message) }
  }

  const handlePullLatest = (repo) => {
    const name = `${repo}:latest`
    setPulling(name)
  }

  const handleRemove = async (id) => {
    if (!confirm('Remove this image?')) return
    try { await api.docker.removeImage(id); fetch() }
    catch (err) { setMessage(err.message) }
  }

  const handlePrune = async () => {
    if (!confirm('Remove all unused images?')) return
    try {
      const r = await api.docker.pruneImages()
      const reclaimed = r.SpaceReclaimed || 0
      const inUse = images.filter((i) => i.dangling && i.usedBy?.length > 0).length
      if (reclaimed === 0 && inUse > 0) {
        setMessage(`${inUse} dangling image(s) are in use by running containers — stop them first, then prune.`)
      } else {
        setMessage(`Pruned: reclaimed ${formatBytes(reclaimed)}`)
      }
      fetch()
    } catch (err) { setMessage(err.message) }
  }

  const handleCheckUpdate = async (repo) => {
    const name = `${repo}:latest`
    setChecking((p) => ({ ...p, [name]: true }))
    try {
      const result = await api.docker.checkImageUpdate(name)
      setUpdates((p) => ({ ...p, [name]: result }))
    } catch (err) {
      setUpdates((p) => ({ ...p, [name]: { error: err.message } }))
    } finally {
      setChecking((p) => ({ ...p, [name]: false }))
    }
  }

  const handlePullDone = () => {
    setPulling(null)
    fetch()
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-surface-100 tracking-tight">Images</h1>
        <div className="flex items-center gap-2">
          <button onClick={handlePrune} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">
            <RefreshCw className="w-4 h-4" /> Prune
          </button>
          <button onClick={() => setShowPull(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-accent-500 hover:bg-accent-600 text-white transition-all shadow-lg shadow-accent-500/20">
            <Download className="w-4 h-4" /> Pull
          </button>
          <button onClick={fetch} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
          message.toLowerCase().includes('error') || message.toLowerCase().includes('fail') || message.toLowerCase().includes('conflict') || message.toLowerCase().includes('in use')
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : message.toLowerCase().includes('reclaimed 0 b')
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            : 'bg-accent-500/10 border-accent-500/20 text-accent-400'
        }`}>
          <span>{message}</span>
          <button onClick={() => setMessage('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-surface-500 text-sm">Loading images...</div>
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Image className="w-12 h-12 text-surface-700" />
          <div className="text-surface-500 text-sm">No images found.</div>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 text-surface-500 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-medium">Repository</th>
                  <th className="text-left py-3 px-4 font-medium">Tag</th>
                  <th className="text-right py-3 px-4 font-medium">Size</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {images.map((img) => {
                  const repo = !img.dangling && img.tags[0] ? img.tags[0].split(':')[0] : null
                  const tag = !img.dangling && img.tags[0] ? img.tags[0].split(':')[1] : null
                  const updateKey = repo ? `${repo}:latest` : null
                  const updateInfo = updateKey ? updates[updateKey] : null

                  return (
                    <tr key={img.id} className={`border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors ${img.dangling ? 'opacity-50' : ''}`}>
                      <td className="py-3 px-4 text-surface-200 font-medium">
                        {img.dangling ? (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400">dangling</span>
                            {img.usedBy?.length > 0 && (
                              <span className="text-xs text-surface-500">(in use by {img.usedBy.length})</span>
                            )}
                          </div>
                        ) : (
                          repo || '<none>'
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {img.dangling ? (
                          <span className="px-2 py-0.5 text-xs rounded-md bg-amber-500/10 text-amber-400 font-mono">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs rounded-md bg-surface-800 text-surface-400 font-mono">
                              {tag || '<none>'}
                            </span>
                            {updateInfo && !updateInfo.error && (
                              <span className={`text-xs ${updateInfo.updateAvailable ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {updateInfo.updateAvailable ? 'Update available' : 'Up to date'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-surface-400">{formatBytes(img.size)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {repo && (
                            <>
                              <button
                                onClick={() => handleCheckUpdate(repo)}
                                disabled={checking[updateKey]}
                                className="p-1.5 rounded-lg text-surface-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-50"
                                title="Check for update"
                              >
                                {checking[updateKey] ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : updateInfo && !updateInfo.error && updateInfo.updateAvailable ? (
                                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                                ) : updateInfo && !updateInfo.error ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <RefreshCw className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handlePullLatest(repo)}
                                className="p-1.5 rounded-lg text-surface-500 hover:text-accent-400 hover:bg-accent-500/10 transition-all"
                                title="Pull latest"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleRemove(img.id)}
                            disabled={img.usedBy?.length > 0}
                            className={`p-1.5 rounded-lg transition-all ${
                              img.usedBy?.length > 0
                                ? 'text-surface-600 cursor-not-allowed'
                                : 'text-surface-500 hover:text-red-400 hover:bg-red-500/10'
                            }`}
                            title={img.usedBy?.length > 0 ? `In use by ${img.usedBy.length} container(s)` : 'Remove'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPull && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-800">
              <h2 className="text-sm font-semibold text-surface-200">Pull Image</h2>
              <button onClick={() => setShowPull(false)} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePull} className="p-5 space-y-4">
              <input
                type="text"
                value={pullName}
                onChange={(e) => setPullName(e.target.value)}
                placeholder="nginx:latest"
                className="w-full px-3 py-2 text-sm rounded-lg border border-surface-700 bg-surface-800 text-surface-200 placeholder-surface-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all font-mono"
                required
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowPull(false)} className="px-4 py-2 text-sm font-medium rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-500 hover:bg-accent-600 text-white transition-all">Pull</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pulling && (
        <PullProgressModal
          name={pulling}
          onClose={() => setPulling(null)}
          onDone={handlePullDone}
        />
      )}
    </div>
  )
}
