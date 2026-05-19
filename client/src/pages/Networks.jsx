import { useState, useEffect, useCallback } from 'react'
import { Share2, Trash2, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

export default function Networks() {
  const [networks, setNetworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const fetch = useCallback(async () => {
    try { setNetworks(await api.docker.networks()) } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleRemove = async (id) => {
    if (!confirm('Remove this network?')) return
    try { await api.docker.removeNetwork(id); fetch() } catch (err) { setMessage(err.message) }
  }

  const handlePrune = async () => {
    if (!confirm('Remove all unused networks?')) return
    try { await api.docker.pruneNetworks(); setMessage('Pruned unused networks'); fetch() } catch (err) { setMessage(err.message) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Networks</h1>
        <div className="flex items-center gap-2">
          <button onClick={handlePrune} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"><RefreshCw className="w-3.5 h-3.5" /> Prune</button>
          <button onClick={fetch} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      {message && <div className="p-3 rounded-lg bg-accent-500/10 border border-accent-500/20 text-sm text-accent-400">{message}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-[#8a8a9a]">Loading networks...</div>
      ) : networks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3"><Share2 className="w-10 h-10 text-[#5a5a6a]" /><p className="text-sm text-[#8a8a9a]">No networks found.</p></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base-700/30">
                <th className="table-header">Name</th>
                <th className="table-header">Driver</th>
                <th className="table-header text-center">Containers</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((n) => (
                <tr key={n.id} className="border-b border-base-700/20 hover:bg-white/[0.02] transition-colors">
                  <td className="table-cell text-[#e4e4ed] font-medium">{n.name}</td>
                  <td className="table-cell"><span className="badge bg-[#1e1e2c] text-[#8a8a9a] font-mono">{n.driver}</span></td>
                  <td className="table-cell text-center text-[#8a8a9a]">{n.containers}</td>
                  <td className="table-cell text-right">
                    <button onClick={() => handleRemove(n.id)} className="p-1 rounded text-[#5a5a6a] hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
