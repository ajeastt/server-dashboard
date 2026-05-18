import { useState, useEffect, useCallback } from 'react'
import { Share2, Trash2, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

export default function Networks() {
  const [networks, setNetworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const fetch = useCallback(async () => {
    try { setNetworks(await api.docker.networks()) }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleRemove = async (id) => {
    if (!confirm('Remove this network?')) return
    try { await api.docker.removeNetwork(id); fetch() }
    catch (err) { setMessage(err.message) }
  }

  const handlePrune = async () => {
    if (!confirm('Remove all unused networks?')) return
    try { await api.docker.pruneNetworks(); setMessage('Pruned unused networks'); fetch() }
    catch (err) { setMessage(err.message) }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100 tracking-tight">Networks</h1>
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
          <div className="text-surface-500 text-sm">Loading networks...</div>
        </div>
      ) : networks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Share2 className="w-12 h-12 text-surface-700" />
          <div className="text-surface-500 text-sm">No networks found.</div>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 text-surface-500 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Driver</th>
                  <th className="text-center py-3 px-4 font-medium">Containers</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((n) => (
                  <tr key={n.id} className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors">
                    <td className="py-3 px-4 text-surface-200 font-medium">{n.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-xs rounded-md bg-surface-800 text-surface-400 font-mono">{n.driver}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-surface-400">{n.containers}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleRemove(n.id)} className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Remove">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
