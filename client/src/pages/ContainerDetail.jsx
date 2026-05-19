import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Play, Square, RefreshCw, Terminal, ListX, Cpu, HardDrive, Network } from 'lucide-react'
import { api, createWS } from '../lib/api'
import { formatBytes, stateColor } from '../lib/utils'
import ResourceBar from '../components/ResourceBar'
import ContainerTerminal from '../components/Terminal'

export default function ContainerDetail() {
  const { id } = useParams()
  const [container, setContainer] = useState(null)
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState('')
  const [activeTab, setActiveTab] = useState('stats')
  const [liveLogs, setLiveLogs] = useState('')
  const logContainerRef = useRef(null)

  useEffect(() => {
    api.docker.container(id).then(setContainer).catch(() => {})
    api.docker.stats(id).then(setStats).catch(() => {})
    api.docker.logs(id, 200).then((d) => setLogs(d.logs)).catch(() => {})

    const interval = setInterval(() => {
      api.docker.stats(id).then(setStats).catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [id])

  // Live log streaming with auto-reconnect on container restart
  useEffect(() => {
    if (activeTab !== 'logs') return
    setLiveLogs('')
    const ws = createWS()
    let reconnectTimer = null

    ws.on('log-data', (msg) => {
      setLiveLogs((prev) => {
        const next = prev + msg.data
        return next.length > 50000 ? next.slice(-50000) : next
      })
    })
    ws.on('log-error', (msg) => {
      setLiveLogs(`[Error] ${msg.error}`)
    })
    ws.on('log-end', () => {
      reconnectTimer = setTimeout(() => {
        ws.send({ type: 'logs', container: id })
      }, 2000)
    })
    ws.send({ type: 'logs', container: id })
    return () => { clearTimeout(reconnectTimer); ws.send({ type: 'logs-stop' }); ws.close() }
  }, [id, activeTab])

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [liveLogs])

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
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" />
          <div className="text-surface-500 text-sm">Loading container...</div>
        </div>
      </div>
    )
  }

  const name = container.Name?.replace(/^\//, '') || 'Unknown'
  const state = container.State?.Status || 'unknown'
  const statusColor = stateColor(state)

  const tabs = ['stats', 'info', 'logs', 'terminal']

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/containers" className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-100 tracking-tight truncate">{name}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-xl ${statusColor} bg-surface-800/40 border border-surface-700/20`}>
              <span className={`w-1.5 h-1.5 rounded-full ${state === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-surface-500'}`} />
              {state}
            </span>
          </div>
          <p className="text-sm text-surface-500 mt-0.5">{container.Config?.Image || 'Unknown image'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {state === 'running' ? (
            <button onClick={() => handleAction('stop')} className="btn-danger px-3 py-2">
              <Square className="w-4 h-4" /> Stop
            </button>
          ) : (
            <button onClick={() => handleAction('start')} className="px-3 py-2 text-sm font-medium rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all">
              <Play className="w-4 h-4" /> Start
            </button>
          )}
          <button onClick={() => handleAction('restart')} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Restart
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-800/50">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium capitalize transition-all border-b-2 -mb-[1px] ${
              activeTab === tab
                ? 'text-accent-400 border-accent-500'
                : 'text-surface-500 border-transparent hover:text-surface-300'
            }`}
          >
            {tab === 'terminal' && <Terminal className="w-4 h-4" />}
            {tab === 'logs' && <ListX className="w-4 h-4" />}
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in">
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-accent-500/10">
                <Cpu className="w-4 h-4 text-accent-400" />
              </div>
              <h3 className="text-sm font-semibold text-surface-200">CPU</h3>
            </div>
            <ResourceBar label="Usage" percent={stats ? stats.cpuPercent : 0} color={stats?.cpuPercent > 80 ? 'red' : stats?.cpuPercent > 50 ? 'amber' : 'accent'} />
            <p className="text-xs text-surface-500 font-mono">{stats ? `${stats.cpuPercent}%` : 'N/A'}</p>
          </div>
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <HardDrive className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-surface-200">Memory</h3>
            </div>
            <ResourceBar label="Usage" percent={stats ? stats.memPercent : 0} color={stats?.memPercent > 80 ? 'red' : stats?.memPercent > 50 ? 'amber' : 'emerald'} />
            <p className="text-xs text-surface-500 font-mono">{stats ? `${formatBytes(stats.memUsage)} / ${formatBytes(stats.memLimit)}` : 'N/A'}</p>
          </div>
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10">
                <Network className="w-4 h-4 text-sky-400" />
              </div>
              <h3 className="text-sm font-semibold text-surface-200">Network</h3>
            </div>
            <div className="flex justify-between text-sm py-2 border-b border-surface-800/30">
              <span className="text-surface-400">Received</span>
              <span className="text-surface-200 font-medium font-mono">{stats ? formatBytes(stats.networkRx) : 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm py-2">
              <span className="text-surface-400">Sent</span>
              <span className="text-surface-200 font-medium font-mono">{stats ? formatBytes(stats.networkTx) : 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="card p-5 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
              <div key={label} className="space-y-1.5">
                <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm text-surface-200 font-mono break-all">{value || <span className="text-surface-500">—</span>}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2 px-5 py-3 bg-surface-900/40 border-b border-surface-800/30">
            <ListX className="w-4 h-4 text-surface-400" />
            <span className="text-xs font-medium text-surface-400">Live Logs</span>
            <span className="ml-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
          </div>
          <pre
            ref={logContainerRef}
            className="p-5 text-xs font-mono leading-relaxed text-surface-300 whitespace-pre-wrap overflow-x-auto overflow-y-auto"
            style={{ maxHeight: '60vh' }}
          >
            {liveLogs || <span className="text-surface-600 italic">Waiting for logs...</span>}
          </pre>
        </div>
      )}

      {activeTab === 'terminal' && (
        <div className="animate-fade-in">
          <ContainerTerminal containerId={id} />
        </div>
      )}
    </div>
  )
}
