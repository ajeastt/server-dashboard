import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Play, Square, RefreshCw, Terminal, Cpu, HardDrive, Network, Search, X, Copy, ChevronDown } from 'lucide-react'
import { api, createWS } from '../lib/api'
import { formatBytes } from '../lib/utils'
import ResourceBar from '../components/ResourceBar'
import ContainerTerminal from '../components/Terminal'

function LogLine({ num, line, search }) {
  const text = line.t
  const isStderr = line.s === 2
  const isEventStart = line.s === 3
  const isEventStop = line.s === 4
  const isError = isStderr || isEventStop || /[Ee]rror|[Ff]atal|[Tt]raceback|[Ee]xception/i.test(text)
  const isWarn = /[Ww]arn(ing)?/i.test(text)
  const isDivider = line.s === 0
  const color = isDivider ? 'text-[#5a5a6a] italic' : isEventStart ? 'text-emerald-400' : isError ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-[#8a8a9a]'

  if (isDivider || isEventStart || isEventStop) {
    return (
      <div className={`flex items-center gap-2 py-0.5 select-none ${isEventStart ? 'border-t border-emerald-500/20 pt-2 mt-1' : ''} ${isEventStop ? 'border-t border-red-500/20 pt-2 mt-1' : ''}`}>
        <span className={`text-[11px] font-semibold ${color}`}>{text}</span>
      </div>
    )
  }

  if (!search) {
    return (
      <div className="flex hover:bg-white/[0.02] group">
        <span className="text-[#5a5a6a] text-right w-12 shrink-0 select-none mr-3 text-xs leading-relaxed">{num}</span>
        <span className={`${color} flex-1 whitespace-pre-wrap break-all leading-relaxed`}>{text}</span>
      </div>
    )
  }

  const lower = text.toLowerCase()
  const q = search.toLowerCase()
  const matchIdx = lower.indexOf(q)
  const dimmed = matchIdx === -1
  const dimClass = dimmed ? 'opacity-30 hover:opacity-60 transition-opacity' : ''

  if (dimmed) {
    return (
      <div className={`flex ${dimClass}`}>
        <span className="text-[#5a5a6a] text-right w-12 shrink-0 select-none mr-3 text-xs leading-relaxed">{num}</span>
        <span className={`${color} flex-1 whitespace-pre-wrap break-all leading-relaxed`}>{text}</span>
      </div>
    )
  }

  const before = text.slice(0, matchIdx)
  const match = text.slice(matchIdx, matchIdx + search.length)
  const after = text.slice(matchIdx + search.length)

  return (
    <div className="flex hover:bg-white/[0.02] group">
      <span className="text-[#5a5a6a] text-right w-12 shrink-0 select-none mr-3 text-xs leading-relaxed">{num}</span>
      <span className={`${color} flex-1 whitespace-pre-wrap break-all leading-relaxed`}>
        {before}<mark className="bg-accent-500/30 text-[#e4e4ed] rounded">{match}</mark>{after}
      </span>
    </div>
  )
}

function parseLogChunk(chunk, nextStreamRef) {
  const result = []
  const normalized = chunk
    .replace(/\x01/g, '\n\x01')
    .replace(/\x02/g, '\n\x02')
    .replace(/^\n/, '')
  const parts = normalized.split('\n')
  let stream = nextStreamRef.current
  for (const part of parts) {
    if (part === '') continue
    if (part.charCodeAt(0) === 1) {
      stream = 1
      result.push({ t: part.slice(1), s: stream })
    } else if (part.charCodeAt(0) === 2) {
      stream = 2
      result.push({ t: part.slice(1), s: stream })
    } else {
      result.push({ t: part, s: stream })
    }
  }
  nextStreamRef.current = stream
  return result
}

export default function ContainerDetail() {
  const { id } = useParams()
  const [container, setContainer] = useState(null)
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('stats')
  const [lines, setLines] = useState([])
  const [search, setSearch] = useState('')
  const [pinned, setPinned] = useState(true)
  const logContainerRef = useRef(null)
  const lineCountRef = useRef(0)
  const nextStreamRef = useRef(1)

  useEffect(() => {
    api.docker.container(id).then(setContainer).catch(() => {})
    api.docker.stats(id).then(setStats).catch(() => {})
    const interval = setInterval(() => api.docker.stats(id).then(setStats).catch(() => {}), 3000)
    return () => clearInterval(interval)
  }, [id])

  // Live log streaming with auto-reconnect
  useEffect(() => {
    if (activeTab !== 'logs') return
    setLines([])
    lineCountRef.current = 0
    nextStreamRef.current = 1
    const ws = createWS()
    let reconnectTimer = null

    ws.on('log-data', (msg) => {
      const newLines = parseLogChunk(msg.data, nextStreamRef)
      if (newLines.length === 0) return
      setLines((prev) => {
        const merged = prev.length > 0
          ? [...prev.slice(0, -1), { ...newLines[0], t: prev[prev.length - 1].t + newLines[0].t }, ...newLines.slice(1)]
          : newLines
        const trimmed = merged.length > 2000 ? merged.slice(-2000) : merged
        lineCountRef.current = trimmed.length
        return trimmed
      })
    })

    ws.on('log-event', (msg) => {
      const ev = msg.event
      if (!ev || ev.Type !== 'container') return
      const action = ev.Action
      const name = ev.Actor?.Attributes?.name || ''
      let label = ''
      let s = 0
      if (action === 'start' || action === 'unpause') {
        label = `▶ ${name} started`
        s = 3
      } else if (action === 'die' || action === 'kill' || action === 'oom') {
        label = `✕ ${name} ${action === 'oom' ? 'OOM killed' : 'died'}`
        s = 4
      } else if (action === 'stop') {
        label = `■ ${name} stopped`
        s = 4
      } else if (action === 'restart') {
        label = `↻ ${name} restarting`
        s = 3
      } else if (action === 'health_status') {
        const status = ev.Actor?.Attributes?.health || 'unknown'
        label = `♥ ${name} health: ${status}`
        s = status === 'healthy' ? 3 : 4
      }
      if (label) {
        setLines((prev) => [...prev, { t: label, s }])
      }
    })

    ws.on('log-error', (msg) => {
      setLines((prev) => [...prev, { t: `[ERROR] ${msg.error}`, s: 0 }])
    })

    ws.on('log-end', () => {
      reconnectTimer = setTimeout(() => ws.send({ type: 'logs', container: id }), 2000)
    })

    ws.send({ type: 'logs', container: id })
    return () => { clearTimeout(reconnectTimer); ws.send({ type: 'logs-stop' }); ws.close() }
  }, [id, activeTab])

  // Smart auto-scroll
  useEffect(() => {
    if (!logContainerRef.current || !pinned) return
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
  }, [lines, pinned])

  const handleScroll = useCallback(() => {
    const el = logContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setPinned(atBottom)
  }, [])

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
      setPinned(true)
    }
  }

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

  const startLine = Math.max(0, lines.length - 200)
  const displayedLines = search
    ? lines.map((line, i) => ({ ...line, num: i + 1 }))
    : lines.slice(startLine).map((line, i) => ({ ...line, num: startLine + i + 1 }))

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-base-700/40">
        {['stats', 'info', 'logs', 'terminal'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? 'tab-active flex items-center gap-1.5' : 'tab flex items-center gap-1.5'}>
            {tab === 'terminal' && <Terminal className="w-3.5 h-3.5" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Stats tab */}
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

      {/* Info tab */}
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

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <div className="relative card overflow-hidden animate-fade-in">
          {/* Log toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-base-700/30 bg-base-800/30">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5a5a6a]" />
              <input
                type="text"
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-base-700/40 bg-base-800/50 text-[#e4e4ed] placeholder-[#5a5a6a] focus:outline-none focus:border-accent-500/40 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5a5a6a] hover:text-[#e4e4ed]">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <span className="text-xs text-[#5a5a6a] font-mono">{lineCountRef.current} lines</span>
            <div className="flex-1" />
            <button onClick={() => { setLines([]); lineCountRef.current = 0 }} className="btn-ghost p-1.5 text-xs" title="Clear"><X className="w-3.5 h-3.5" /></button>
            <button
              onClick={() => {
                const text = lines.map((l) => l.t).join('\n')
                navigator.clipboard?.writeText(text)
              }}
              className="btn-ghost p-1.5 text-xs"
              title="Copy all"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Log content */}
          <div
            ref={logContainerRef}
            onScroll={handleScroll}
            className="overflow-y-auto font-mono text-xs"
            style={{ maxHeight: '65vh' }}
          >
            <div className="p-4">
              {displayedLines.length === 0 && (
                <div className="text-[#5a5a6a] italic">Waiting for logs...</div>
              )}
              {displayedLines.map((line) => (
                <LogLine key={line.num} num={line.num} line={line} search={search} />
              ))}
            </div>
          </div>

          {/* Scroll to bottom button */}
          {!pinned && lines.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={scrollToBottom}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-500/20 border border-accent-500/30 text-accent-400 text-xs font-medium hover:bg-accent-500/30 transition-all shadow-lg backdrop-blur-sm"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                New logs below
              </button>
            </div>
          )}
        </div>
      )}

      {/* Terminal tab */}
      {activeTab === 'terminal' && (
        <div className="animate-fade-in">
          <ContainerTerminal containerId={id} />
        </div>
      )}
    </div>
  )
}
