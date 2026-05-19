import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Play, Square, RefreshCw, Terminal, ListX, Cpu, HardDrive, Network } from 'lucide-react'
import { api, createWS } from '../lib/api'
import { formatBytes } from '../lib/utils'
import ResourceBar from '../components/ResourceBar'
import ContainerTerminal from '../components/Terminal'

export default function ContainerDetail() {
  const { id } = useParams()
  const [container, setContainer] = useState(null)
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('stats')
  const [liveLogs, setLiveLogs] = useState('')
  const logContainerRef = useRef(null)

  useEffect(() => {
    api.docker.container(id).then(setContainer).catch(() => {})
    api.docker.stats(id).then(setStats).catch(() => {})
    const interval = setInterval(() => api.docker.stats(id).then(setStats).catch(() => {}), 3000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    if (activeTab !== 'logs') return
    setLiveLogs('')
    const ws = createWS()
    let reconnectTimer = null
    ws.on('log-data', (msg) => setLiveLogs((prev) => { const n = prev + msg.data; return n.length > 50000 ? n.slice(-50000) : n }))
    ws.on('log-error', (msg) => setLiveLogs(`[Error] ${msg.error}`))
    ws.on('log-end', () => { reconnectTimer = setTimeout(() => ws.send({ type: 'logs', container: id }), 2000) })
    ws.send({ type: 'logs', container: id })
    return () => { clearTimeout(reconnectTimer); ws.send({ type: 'logs-stop' }); ws.close() }
  }, [id, activeTab])

  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
  }, [liveLogs])

  const handleAction = async (action) => {
    try { await api.docker.action(id, action); setContainer(await api.docker.container(id)) }
    catch (err) { console.error(err) }
  }

  if (!container) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2 text-sm text-[#8a8a9a]">
          <div className="w-4 h-4 rounded-full border border-accent-500/40 border-t-accent-500 animate-spin" />
          Loading container...
        </div>
      </div>
    )
  }

  const name = container.Name?.replace(/^\//, '') || 'Unknown'
  const state = container.State?.Status || 'unknown'

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center gap-3">
        <Link to="/containers" className="btn-ghost p-1.5"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="page-title truncate">{name}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border ${state === 'running' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-[#1e1e2c] text-[#5a5a6a] border-base-700/40'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${state === 'running' ? 'bg-emerald-400' : 'bg-[#5a5a6a]'}`} />
              {state}
            </span>
          </div>
          <p className="text-sm text-[#8a8a9a] mt-0.5">{container.Config?.Image}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {state === 'running' ? (
            <button onClick={() => handleAction('stop')} className="px-3 py-1.5 text-sm font-medium rounded-lg text-red-400 hover:bg-red-500/10 transition-all"><Square className="w-3.5 h-3.5" /> Stop</button>
          ) : (
            <button onClick={() => handleAction('start')} className="px-3 py-1.5 text-sm font-medium rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all"><Play className="w-3.5 h-3.5" /> Start</button>
          )}
          <button onClick={() => handleAction('restart')} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Restart</button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-base-700/40">
        {['stats', 'info', 'logs', 'terminal'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? 'tab-active flex items-center gap-1.5' : 'tab flex items-center gap-1.5'}>
            {tab === 'terminal' && <Terminal className="w-3.5 h-3.5" />}
            {tab === 'logs' && <ListX className="w-3.5 h-3.5" />}
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-accent-400" /><h3 className="text-sm font-semibold text-[#e4e4ed]">CPU</h3></div>
            <ResourceBar label="Usage" percent={stats ? stats.cpuPercent : 0} color={stats?.cpuPercent > 80 ? 'red' : stats?.cpuPercent > 50 ? 'amber' : 'accent'} />
            <p className="text-xs text-[#5a5a6a] font-mono">{stats ? `${stats.cpuPercent}%` : 'N/A'}</p>
          </div>
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-semibold text-[#e4e4ed]">Memory</h3></div>
            <ResourceBar label="Usage" percent={stats ? stats.memPercent : 0} color={stats?.memPercent > 80 ? 'red' : stats?.memPercent > 50 ? 'amber' : 'emerald'} />
            <p className="text-xs text-[#5a5a6a] font-mono">{stats ? `${formatBytes(stats.memUsage)} / ${formatBytes(stats.memLimit)}` : 'N/A'}</p>
          </div>
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2"><Network className="w-4 h-4 text-sky-400" /><h3 className="text-sm font-semibold text-[#e4e4ed]">Network</h3></div>
            <div className="flex justify-between text-sm py-1.5 border-b border-base-700/30"><span className="text-[#8a8a9a]">Received</span><span className="text-[#e4e4ed] font-mono">{stats ? formatBytes(stats.networkRx) : 'N/A'}</span></div>
            <div className="flex justify-between text-sm py-1.5"><span className="text-[#8a8a9a]">Sent</span><span className="text-[#e4e4ed] font-mono">{stats ? formatBytes(stats.networkTx) : 'N/A'}</span></div>
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="card p-5 animate-fade-in">
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
                <p className="text-xs font-medium text-[#5a5a6a]">{label}</p>
                <p className="text-sm text-[#e4e4ed] font-mono break-all">{value || <span className="text-[#5a5a6a]">—</span>}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-base-700/30">
            <ListX className="w-3.5 h-3.5 text-accent-400" />
            <span className="text-xs font-medium text-[#e4e4ed]">Live Logs</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <pre ref={logContainerRef} className="p-4 text-xs font-mono leading-relaxed text-[#8a8a9a] whitespace-pre-wrap overflow-x-auto overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {liveLogs || <span className="italic text-[#5a5a6a]">Waiting for logs...</span>}
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
