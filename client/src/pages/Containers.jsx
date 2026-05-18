import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { api } from '../lib/api'
import ContainerCard from '../components/ContainerCard'

export default function Containers() {
  const [containers, setContainers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const fetchContainers = useCallback(async () => {
    try {
      const data = await api.docker.containers()
      setContainers(data)
    } catch (err) {
      console.error('Failed to fetch containers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContainers()
    const interval = setInterval(fetchContainers, 5000)
    return () => clearInterval(interval)
  }, [fetchContainers])

  const handleAction = async (id, action) => {
    try {
      await api.docker.action(id, action)
      fetchContainers()
    } catch (err) {
      console.error(`Action ${action} failed:`, err)
    }
  }

  const filtered = containers.filter((c) => {
    if (filter !== 'all' && c.state !== filter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.image.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100 tracking-tight">Containers</h1>
        <button
          onClick={fetchContainers}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
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
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-surface-500 text-sm">No containers found.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <ContainerCard key={c.id} container={c} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  )
}
