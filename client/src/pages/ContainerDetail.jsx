import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Play, Square, RefreshCw, Terminal, ListX, Search, Eye, EyeOff } from 'lucide-react'
import { api, createWS } from '../lib/api'
import { formatBytes, stateColor } from '../lib/utils'
import ResourceBar from '../components/ResourceBar'
import MiniChart from '../components/MiniChart'
import ContainerTerminal from '../components/Terminal'

export default function ContainerDetail() {
  const { id } = useParams()
  const [container, setContainer] = useState(null)
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState('')
  const [activeTab, setActiveTab] = useState('stats')
  const [liveLogs, setLiveLogs] = useState('')
  const [logFilter, setLogFilter] = useState('')
  const [showEnv, setShowEnv] = useState(false)
  const logContainerRef = useRef(null)
  const statsHistoryRef = useRef({ cpu: [], mem: [], rx: [], tx: [] })
  const [statsHistory, setStatsHistory] = useState({ cpu: [], mem: [], rx: [], tx: [] })

  useEffect(() => {
    api.docker.container(id).then(setContainer).catch(() => {})
    api.docker.stats(id).then(setStats).catch(() => {})
    api.docker.logs(id, 200).then((d) => setLogs(d.logs)).catch(() => {})

    const interval = setInterval(() => {
      api.docker.stats(id).then((s) => {
        setStats(s)
        const h = statsHistoryRef.current
        const max = 60
        h.cpu = [...h.cpu.slice(-max + 1), s.cpuPercent]
        h.mem = [...h.mem.slice(-max + 1), s.memPercent]
        h.rx = [...h.rx.slice(-max + 1), s.networkRx]
        h.tx = [...h.tx.slice(-max + 1), s.networkTx]
        statsHistoryRef.current = h
        setStatsHistory({ cpu: [...h.cpu], mem: [...h.mem], rx: [...h.rx], tx: [...h.tx] })
      }).catch(() => {})
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
        <div className="text-surface-500 text-sm">Loading container...</div>
      </div>
    )
  }

  const name = container.Name?.replace(/^\//, '') || 'Unknown'
  const state = container.State?.Status || 'unknown'
  const statusColor = stateColor(state)

  const tabs = ['stats', 'info', 'logs', 'terminal']

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/containers" className="p-2 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all">
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
            <button onClick={() => handleAction('stop')} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
              <Square className="w-4 h-4" /> Stop
            </button>
          ) : (
            <button onClick={() => handleAction('start')} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all">
              <Play className="w-4 h-4" /> Start
            </button>
          )}
          <button onClick={() => handleAction('restart')} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all">
            <RefreshCw className="w-4 h-4" /> Restart
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 border-b border-surface-800">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-surface-200">CPU</h3>
            <ResourceBar label="Usage" percent={stats ? stats.cpuPercent : 0} color={stats?.cpuPercent > 80 ? 'red' : stats?.cpuPercent > 50 ? 'amber' : 'accent'} />
            <p className="text-xs text-surface-500">{stats ? `${stats.cpuPercent}%` : 'N/A'}</p>
            {statsHistory.cpu.length > 1 && <MiniChart data={statsHistory.cpu} color="#6366f1" />}
          </div>
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-surface-200">Memory</h3>
            <ResourceBar label="Usage" percent={stats ? stats.memPercent : 0} color={stats?.memPercent > 80 ? 'red' : stats?.memPercent > 50 ? 'amber' : 'emerald'} />
            <p className="text-xs text-surface-500">{stats ? `${formatBytes(stats.memUsage)} / ${formatBytes(stats.memLimit)}` : 'N/A'}</p>
            {statsHistory.mem.length > 1 && <MiniChart data={statsHistory.mem} color="#10b981" />}
          </div>
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-surface-200 mb-3">Network</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="p-3 rounded-lg bg-surface-800/50">
                <p className="text-xs text-surface-500 mb-1">Received</p>
                <p className="text-sm font-semibold text-surface-200">{stats ? formatBytes(stats.networkRx) : 'N/A'}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-800/50">
                <p className="text-xs text-surface-500 mb-1">Sent</p>
                <p className="text-sm font-semibold text-surface-200">{stats ? formatBytes(stats.networkTx) : 'N/A'}</p>
              </div>
            </div>
            {statsHistory.rx.length > 1 && <MiniChart data={statsHistory.rx.map(v => Math.round(v / 1024))} color="#0ea5e9" />}
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="space-y-4 animate-fade-in">
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['ID', container.Id?.slice(0, 24)],
                ['Image', container.Config?.Image],
                ['Image ID', container.ImageID],
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
          {container.Config?.Env?.length > 0 && (
            <div className="rounded-xl border border-surface-800 bg-surface-900 p-5">
              <button onClick={() => setShowEnv(!showEnv)} className="flex items-center gap-2 text-sm font-semibold text-surface-300 hover:text-surface-100 transition-all mb-3">
                {showEnv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                Environment Variables ({container.Config.Env.length})
              </button>
              {showEnv && (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {container.Config.Env.map((env, i) => (
                    <div key={i} className="text-xs font-mono text-surface-400 break-all">
                      {env.includes('=') ? (
                        <><span className="text-surface-300">{env.split('=')[0]}</span>=<span className="text-surface-500">{env.split('=').slice(1).join('=')}</span></>
                      ) : (
                        <span className="text-surface-400">{env}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="rounded-xl border border-surface-800 bg-surface-950 p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3 text-surface-400">
            <ListX className="w-4 h-4" />
            <span className="text-xs font-medium">Live Logs</span>
            <span className="ml-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="ml-auto relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-600" />
              <input
                type="text"
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                placeholder="Filter logs..."
                className="w-48 pl-7 pr-2 py-1.5 text-xs bg-surface-800 border border-surface-700 rounded-lg text-surface-300 placeholder-surface-600 focus:outline-none focus:border-accent-500 transition-colors"
              />
            </div>
          </div>
          <pre
            ref={logContainerRef}
            className="text-xs font-mono leading-relaxed text-surface-300 whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto"
          >
            {liveLogs
              ? logFilter
                ? liveLogs.split('\n').filter(l => l.toLowerCase().includes(logFilter.toLowerCase())).join('\n')
                : liveLogs
              : 'Waiting for logs...'}
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
