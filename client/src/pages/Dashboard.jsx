import { useState, useEffect } from 'react'
import { Cpu, HardDrive, Activity, Container, Network, Server } from 'lucide-react'
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
        <div className="text-surface-500 text-sm">Connecting to server...</div>
      </div>
    )
  }

  const diskMain = metrics.disk?.[0]
  const cpuColor = metrics.cpu.usage > 80 ? 'red' : metrics.cpu.usage > 50 ? 'amber' : 'accent'
  const memColor = metrics.memory.percent > 80 ? 'red' : metrics.memory.percent > 50 ? 'amber' : 'emerald'

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-surface-500 mt-1">
            {sysInfo ? `${sysInfo.hostname} • ${sysInfo.distro} • up ${formatUptime(sysInfo.uptime)}` : 'Loading...'}
          </p>
        </div>
        {sysInfo && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-surface-500 bg-surface-900 border border-surface-800 rounded-lg px-3 py-2">
            <Server className="w-3.5 h-3.5" />
            {sysInfo.platform} {sysInfo.arch}
          </div>
        )}
      </div>

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
          sub={`${metrics.containers.total} total • ${metrics.containers.stopped} stopped`}
          icon={Container}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-200">CPU</h2>
            <span className="text-xs text-surface-500">{metrics.cpu.usage.toFixed(1)}% avg</span>
          </div>
          <ResourceBar label="Usage" percent={Math.round(metrics.cpu.usage)} color={cpuColor} />
          <MiniChart data={history.cpu} color={cpuColor === 'red' ? '#ef4444' : cpuColor === 'amber' ? '#f59e0b' : '#6366f1'} />
        </div>

        <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-200">Memory</h2>
            <span className="text-xs text-surface-500">{metrics.memory.percent.toFixed(1)}% used</span>
          </div>
          <ResourceBar label="Usage" percent={Math.round(metrics.memory.percent)} color={memColor} />
          <MiniChart data={history.mem} color={memColor === 'red' ? '#ef4444' : memColor === 'amber' ? '#f59e0b' : '#10b981'} />
        </div>
      </div>

      <div className="rounded-xl border border-surface-800 bg-surface-900 p-5">
        <h2 className="text-sm font-semibold text-surface-200 mb-4">Network</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/50">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-surface-500">Download</p>
              <p className="text-sm font-semibold text-surface-200">{formatBytes(metrics.network.rx)}/s</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/50">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-surface-500">Upload</p>
              <p className="text-sm font-semibold text-surface-200">{formatBytes(metrics.network.tx)}/s</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
