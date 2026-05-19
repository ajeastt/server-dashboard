import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Gauge,
  Container,
  HardDrive,
  Share2,
  Eraser,
  FolderTree,
} from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/utils'
import Modal from './Modal'

const links = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/containers', label: 'Containers', icon: Container },
  { to: '/volumes', label: 'Volumes', icon: HardDrive },
  { to: '/networks', label: 'Networks', icon: Share2 },
  { to: '/files', label: 'Files', icon: FolderTree },
]

export default function Sidebar() {
  const [confirm, setConfirm] = useState(null)
  const [result, setResult] = useState(null)

  const doPruneImages = async () => {
    setConfirm(null)
    try {
      const data = await api.docker.pruneImages()
      setResult({
        title: 'Images Pruned',
        lines: [
          `${data.images_deleted} image${data.images_deleted === 1 ? '' : 's'} removed`,
          `${formatBytes(data.space_reclaimed)} reclaimed`,
        ],
      })
    } catch (err) {
      setResult({ title: 'Error', lines: [err.message] })
    }
  }

  const doSystemPrune = async () => {
    setConfirm(null)
    try {
      const data = await api.docker.prune()
      const totalDeleted = (data.ContainersDeleted?.length || 0)
        + (data.ImagesDeleted?.length || 0)
        + (data.VolumesDeleted?.length || 0)
        + (data.NetworksDeleted?.length || 0)
      const lines = []
      if (data.ContainersDeleted?.length) lines.push(`${data.ContainersDeleted.length} containers`)
      if (data.ImagesDeleted?.length) lines.push(`${data.ImagesDeleted.length} images`)
      if (data.VolumesDeleted?.length) lines.push(`${data.VolumesDeleted.length} volumes`)
      if (data.NetworksDeleted?.length) lines.push(`${data.NetworksDeleted.length} networks`)
      if (totalDeleted === 0) lines.push('Nothing to clean')
      lines.push(`${formatBytes(data.SpaceReclaimed)} reclaimed`)
      setResult({ title: 'System Prune', lines })
    } catch (err) {
      setResult({ title: 'Error', lines: [err.message] })
    }
  }

  return (
    <>
      <aside className="w-16 lg:w-56 border-r border-surface-800/50 bg-surface-900/60 backdrop-blur-xl flex flex-col shrink-0">
        <div className="h-14 flex items-center gap-2.5 px-4 lg:px-5 border-b border-surface-800/40">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shrink-0 shadow-lg shadow-accent-500/20">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <span className="hidden lg:block text-sm font-semibold text-surface-200 tracking-tight">
            ServerDash
          </span>
        </div>

        <nav className="flex-1 py-3 px-2 lg:px-3 space-y-0.5 overflow-y-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 lg:px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-500/10 text-accent-400 shadow-sm glow-accent-sm'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/40'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-surface-800/40 space-y-1.5">
          <button
            onClick={() => setConfirm({ handler: doPruneImages, message: 'Remove unused Docker images?' })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all bg-surface-800/30 text-surface-400 hover:text-surface-200 hover:bg-surface-700/40"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden lg:block">Prune Images</span>
          </button>
          <button
            onClick={() => setConfirm({ handler: doSystemPrune, message: 'Remove unused containers, images, networks, and build cache?' })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all bg-surface-800/30 text-surface-400 hover:text-surface-200 hover:bg-surface-700/40"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden lg:block">System Prune</span>
          </button>
        </div>
      </aside>

      <Modal open={!!confirm} title="Confirm" onClose={() => setConfirm(null)}>
        <p className="text-sm text-surface-400 mb-5">{confirm?.message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setConfirm(null)} className="btn-secondary">Cancel</button>
          <button onClick={confirm?.handler} className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-500/20">Prune</button>
        </div>
      </Modal>

      <Modal open={!!result} title={result?.title || ''} onClose={() => setResult(null)}>
        <div className="space-y-2">
          {result?.lines?.map((line, i) => (
            <p key={i} className="text-sm text-surface-300">{line}</p>
          ))}
        </div>
        <div className="flex justify-end mt-5">
          <button onClick={() => setResult(null)} className="btn-primary">OK</button>
        </div>
      </Modal>
    </>
  )
}
