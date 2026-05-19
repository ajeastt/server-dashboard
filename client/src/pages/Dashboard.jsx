import { useState, useEffect } from 'react'
import { Cpu, HardDrive, Activity, Container, Network, Server, ArrowUp, ArrowDown } from 'lucide-react'
import { useMetrics } from '../hooks/useMetrics'
import { api } from '../lib/api'
import { formatBytes, formatUptime } from '../lib/utils'
import StatCard from '../components/StatCard'
import ResourceBar from '../components/ResourceBar'
import MiniChart from '../components/MiniChart'

export default function Dashboard() {
  const { metrics, history } = useMetrics()
  const [sysInfo, setSysInfo] = useState(null)

  useEffect(() => {
    api.system.info().then(setSysInfo).catch(() => {})
  }, [])

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" />
          <div className="text-surface-500 text-sm">Connecting to server...</div>
        </div>
      </div>
    )
  }

  const diskMain = metrics.disk?.[0]
  const cpuColor = metrics.cpu.usage > 80 ? 'red' : metrics.cpu.usage > 50 ? 'amber' : 'accent'
  const memColor = metrics.memory.percent > 80 ? 'red' : metrics.memory.percent > 50 ? 'amber' : 'emerald'

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-surface-500 mt-1">
            {sysInfo ? `${sysInfo.hostname} · ${sysInfo.distro} · up ${formatUptime(sysInfo.uptime)}` : 'Loading...'}
          </p>
        </div>
        {sysInfo && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-surface-500 bg-surface-800/40 border border-surface-700/30 rounded-xl px-3 py-2">
            <Server className="w-3.5 h-3.5" />
            {sysInfo.platform} {sysInfo.arch}
          </div>
        )}
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="CPU Usage"
          value={`${metrics.cpu.usage.toFixed(1)}%`}
          sub={`${metrics.cpu.cores} cores`}
          icon={Cpu}
          color={cpuColor}
        />
        <StatCard
          label="Memory"
          value={formatBytes(metrics.memory.used)}
          sub={`${metrics.memory.percent.toFixed(1)}% of ${formatBytes(metrics.memory.total)}`}
          icon={HardDrive}
          color={memColor}
        />
        <StatCard
          label="Disk"
          value={diskMain ? `${diskMain.percent}%` : 'N/A'}
          sub={diskMain ? `${formatBytes(diskMain.used)} / ${formatBytes(diskMain.size)}` : ''}
          icon={Activity}
          color="sky"
        />
        <StatCard
          label="Containers"
          value={metrics.containers.running}
          sub={`${metrics.containers.total} total · ${metrics.containers.stopped} stopped`}
          icon={Container}
          color="violet"
        />
      </div>

      {/* CPU + Memory with charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-accent-500/10">
                <Cpu className="w-4 h-4 text-accent-400" />
              </div>
              <h2 className="text-sm font-semibold text-surface-200">CPU</h2>
            </div>
            <span className="text-xs font-mono text-surface-500">{metrics.cpu.usage.toFixed(1)}% avg</span>
          </div>
          <ResourceBar label="Usage" percent={Math.round(metrics.cpu.usage)} color={cpuColor} />
          <MiniChart data={history.cpu} color={cpuColor === 'red' ? '#ef4444' : cpuColor === 'amber' ? '#f59e0b' : '#6366f1'} />
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <HardDrive className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="text-sm font-semibold text-surface-200">Memory</h2>
            </div>
            <span className="text-xs font-mono text-surface-500">{metrics.memory.percent.toFixed(1)}% used</span>
          </div>
          <ResourceBar label="Usage" percent={Math.round(metrics.memory.percent)} color={memColor} />
          <MiniChart data={history.mem} color={memColor === 'red' ? '#ef4444' : memColor === 'amber' ? '#f59e0b' : '#10b981'} />
        </div>
      </div>

      {/* Network + Disk detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-sky-500/10">
              <Network className="w-4 h-4 text-sky-400" />
            </div>
            <h2 className="text-sm font-semibold text-surface-200">Network</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/30 border border-surface-700/20">
              <div className="p-2 rounded-lg bg-sky-500/10">
                <ArrowDown className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wider">Download</p>
                <p className="text-sm font-bold text-surface-200 mt-0.5">{formatBytes(metrics.network.rx)}/s</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/30 border border-surface-700/20">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <ArrowUp className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wider">Upload</p>
                <p className="text-sm font-bold text-surface-200 mt-0.5">{formatBytes(metrics.network.tx)}/s</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-surface-800/50">
              <Activity className="w-4 h-4 text-surface-400" />
            </div>
            <h2 className="text-sm font-semibold text-surface-200">System</h2>
          </div>
          {sysInfo ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Hostname', sysInfo.hostname],
                ['Kernel', sysInfo.kernel],
                ['Uptime', formatUptime(sysInfo.uptime)],
                ['CPU', sysInfo.cpu?.split('@')[0]?.trim() || sysInfo.cpu],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wider">{l}</p>
                  <p className="text-surface-200 font-medium mt-0.5 truncate">{v}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-surface-500 text-sm">Loading...</div>
          )}
        </div>
      </div>

      {/* Disk mounts */}
      {metrics.disk && metrics.disk.length > 1 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-200 mb-4">Disk Mounts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.disk.map((d, i) => (
              <div key={i} className="p-3 rounded-xl bg-surface-800/30 border border-surface-700/20">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-200 truncate">{d.fs}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{d.mount}</p>
                  </div>
                  <span className={`badge ${
                    d.percent >= 90 ? 'bg-red-500/10 text-red-400' :
                    d.percent >= 70 ? 'bg-amber-500/10 text-amber-400' :
                    'bg-emerald-500/10 text-emerald-400'
                  }`}>{d.percent}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-800/60 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    d.percent >= 90 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                    d.percent >= 70 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                    'bg-gradient-to-r from-accent-500 to-accent-400'
                  }`} style={{ width: `${Math.min(d.percent, 100)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-surface-500 mt-2">
                  <span>{formatBytes(d.used)} used</span>
                  <span>{formatBytes(d.free)} free</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
