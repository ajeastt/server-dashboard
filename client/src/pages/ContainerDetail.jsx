import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Play, Square, RefreshCw, Terminal } from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes, stateColor } from '../lib/utils'
import ResourceBar from '../components/ResourceBar'

export default function ContainerDetail() {
  const { id } = useParams()
  const [container, setContainer] = useState(null)
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState('')
  const [activeTab, setActiveTab] = useState('stats')

  useEffect(() => {
    api.docker.container(id).then(setContainer).catch(() => {})
    api.docker.stats(id).then(setStats).catch(() => {})
    api.docker.logs(id, 200).then((d) => setLogs(d.logs)).catch(() => {})

    const interval = setInterval(() => {
      api.docker.stats(id).then(setStats).catch(() => {})
    }, 3000)

    return () => clearInterval(interval)
  }, [id])

  const handleAction = async (action) => {
    try {
      await api.docker.action(id, action)
      const updated = await api.docker.container(id)
      setContainer(updated)
    } catch (err) {
      console.error(`Action ${action} failed:`, err)
    }
  }

  if (!container) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-surface-500 text-sm">Loading container...</div>
      </div>
    )
  }

  const name = container.Name?.replace(/^\//, '') || 'Unknown'
  const state = container.State?.Status || 'unknown'
  const statusColor = stateColor(state)

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link
          to="/containers"
          className="p-2 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-100 tracking-tight truncate">{name}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusColor} bg-surface-800/50`}>
              <span className={`w-1.5 h-1.5 rounded-full ${state === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-surface-500'}`} />
              {state}
            </span>
          </div>
          <p className="text-sm text-surface-500 mt-0.5">{container.Config?.Image || 'Unknown image'}</p>
        </div>

        <div className="flex items-center gap-1.5">
          {state === 'running' ? (
            <button
              onClick={() => handleAction('stop')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
            >
              <Square className="w-4 h-4" /> Stop
            </button>
          ) : (
            <button
              onClick={() => handleAction('start')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              <Play className="w-4 h-4" /> Start
            </button>
          )}
          <button
            onClick={() => handleAction('restart')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Restart
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 border-b border-surface-800">
        {['stats', 'info', 'logs'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-all border-b-2 -mb-[1px] ${
              activeTab === tab
                ? 'text-accent-400 border-accent-500'
                : 'text-surface-500 border-transparent hover:text-surface-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-surface-200">CPU</h3>
            <ResourceBar label="Usage" percent={stats ? stats.cpuPercent : 0} color={stats?.cpuPercent > 80 ? 'red' : stats?.cpuPercent > 50 ? 'amber' : 'accent'} />
            <p className="text-xs text-surface-500">{stats ? `${stats.cpuPercent}%` : 'N/A'}</p>
          </div>
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-surface-200">Memory</h3>
            <ResourceBar label="Usage" percent={stats ? stats.memPercent : 0} color={stats?.memPercent > 80 ? 'red' : stats?.memPercent > 50 ? 'amber' : 'emerald'} />
            <p className="text-xs text-surface-500">
              {stats ? `${formatBytes(stats.memUsage)} / ${formatBytes(stats.memLimit)}` : 'N/A'}
            </p>
          </div>
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 space-y-2">
            <h3 className="text-sm font-semibold text-surface-200 mb-3">Network</h3>
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Received</span>
              <span className="text-surface-200 font-medium">{stats ? formatBytes(stats.networkRx) : 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Sent</span>
              <span className="text-surface-200 font-medium">{stats ? formatBytes(stats.networkTx) : 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['ID', container.Id?.slice(0, 24)],
              ['Image', container.Config?.Image],
              ['Command', container.Config?.Cmd?.join(' ')],
              ['Entrypoint', container.Config?.Entrypoint?.join(' ')],
              ['Created', container.Created ? new Date(container.Created).toLocaleString() : ''],
              ['Platform', container.Platform],
              ['Restart Policy', container.HostConfig?.RestartPolicy?.Name],
              ['Network Mode', container.HostConfig?.NetworkMode],
            ].map(([label, value]) => (
              <div key={label} className="space-y-1">
                <p className="text-xs text-surface-500">{label}</p>
                <p className="text-sm text-surface-200 font-mono break-all">{value || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="rounded-xl border border-surface-800 bg-surface-950 p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3 text-surface-400">
            <Terminal className="w-4 h-4" />
            <span className="text-xs font-medium">Container Logs</span>
          </div>
          <pre className="text-xs font-mono leading-relaxed text-surface-300 whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
            {logs || 'No logs available.'}
          </pre>
        </div>
      )}
    </div>
  )
}
