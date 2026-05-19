import { useState, useEffect } from 'react'
import { Cpu, HardDrive, Activity, Container, Network, Server, ArrowDown, ArrowUp } from 'lucide-react'
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
        <div className="flex items-center gap-2 text-sm text-[#8a8a9a]">
          <div className="w-4 h-4 rounded-full border border-accent-500/40 border-t-accent-500 animate-spin" />
          Connecting...
        </div>
      </div>
    )
  }

  const diskMain = metrics.disk?.[0]
  const cpuColor = metrics.cpu.usage > 80 ? 'red' : metrics.cpu.usage > 50 ? 'amber' : 'accent'
  const memColor = metrics.memory.percent > 80 ? 'red' : metrics.memory.percent > 50 ? 'amber' : 'emerald'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-[#8a8a9a] mt-0.5">
            {sysInfo ? `${sysInfo.hostname} · ${sysInfo.distro} · up ${formatUptime(sysInfo.uptime)}` : ''}
          </p>
        </div>
        {sysInfo && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#5a5a6a] border border-base-700/60 rounded-lg px-2.5 py-1.5">
            <Server className="w-3 h-3" />
            {sysInfo.platform} {sysInfo.arch}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="CPU" value={`${metrics.cpu.usage.toFixed(1)}%`} sub={`${metrics.cpu.cores} cores`} icon={Cpu} color={cpuColor} />
        <StatCard label="Memory" value={formatBytes(metrics.memory.used)} sub={`${metrics.memory.percent.toFixed(1)}% of ${formatBytes(metrics.memory.total)}`} icon={HardDrive} color={memColor} />
        <StatCard label="Disk" value={diskMain ? `${diskMain.percent}%` : 'N/A'} sub={diskMain ? `${formatBytes(diskMain.used)} / ${formatBytes(diskMain.size)}` : ''} icon={Activity} color="sky" />
        <StatCard label="Containers" value={metrics.containers.running} sub={`${metrics.containers.total} total · ${metrics.containers.stopped} stopped`} icon={Container} color="violet" />
      </div>

      {/* CPU + Memory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent-400" />
              <h2 className="text-sm font-semibold text-[#e4e4ed]">CPU</h2>
            </div>
            <span className="text-xs font-mono text-[#5a5a6a]">{metrics.cpu.usage.toFixed(1)}%</span>
          </div>
          <ResourceBar label="Usage" percent={Math.round(metrics.cpu.usage)} color={cpuColor} />
          <MiniChart data={history.cpu} color={cpuColor === 'red' ? '#ef4444' : cpuColor === 'amber' ? '#f59e0b' : '#06b6d4'} />
        </div>
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-[#e4e4ed]">Memory</h2>
            </div>
            <span className="text-xs font-mono text-[#5a5a6a]">{metrics.memory.percent.toFixed(1)}%</span>
          </div>
          <ResourceBar label="Usage" percent={Math.round(metrics.memory.percent)} color={memColor} />
          <MiniChart data={history.mem} color={memColor === 'red' ? '#ef4444' : memColor === 'amber' ? '#f59e0b' : '#10b981'} />
        </div>
      </div>

      {/* Network + System */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Network className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-[#e4e4ed]">Network</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-base-800/50 border border-base-700/40">
              <ArrowDown className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <p className="text-xs text-[#5a5a6a]">Download</p>
                <p className="text-sm font-semibold text-[#e4e4ed]">{formatBytes(metrics.network.rx)}/s</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-base-800/50 border border-base-700/40">
              <ArrowUp className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs text-[#5a5a6a]">Upload</p>
                <p className="text-sm font-semibold text-[#e4e4ed]">{formatBytes(metrics.network.tx)}/s</p>
              </div>
            </div>
          </div>
        </div>
        {sysInfo && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-[#8a8a9a]" />
              <h2 className="text-sm font-semibold text-[#e4e4ed]">System</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              {[
                ['Hostname', sysInfo.hostname],
                ['Kernel', sysInfo.kernel],
                ['Uptime', formatUptime(sysInfo.uptime)],
                ['CPU', sysInfo.cpu?.split('@')[0]?.trim() || sysInfo.cpu],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs text-[#5a5a6a]">{l}</p>
                  <p className="text-sm font-medium text-[#e4e4ed] truncate">{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Additional disk mounts */}
      {metrics.disk && metrics.disk.length > 1 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-[#e4e4ed] mb-3">Disk Mounts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.disk.map((d, i) => (
              <div key={i} className="p-3 rounded-lg bg-base-800/30 border border-base-700/40">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#e4e4ed] truncate">{d.fs}</p>
                    <p className="text-xs text-[#8a8a9a] mt-0.5">{d.mount}</p>
                  </div>
                  <span className={`badge ${d.percent >= 90 ? 'bg-red-500/10 text-red-400' : d.percent >= 70 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{d.percent}%</span>
                </div>
                <div className="h-1 rounded-full bg-base-700/50 overflow-hidden">
                  <div className={`h-full rounded-full ${d.percent >= 90 ? 'bg-red-500' : d.percent >= 70 ? 'bg-amber-500' : 'bg-accent-500'}`} style={{ width: `${Math.min(d.percent, 100)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-[#5a5a6a] mt-1.5">
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
