import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Gauge,
  Container,
  HardDrive,
  Share2,
  Server,
  Eraser,
  Check,
  Loader,
  FolderTree,
} from 'lucide-react'
import { api } from '../lib/api'

const links = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/containers', label: 'Containers', icon: Container },
  { to: '/volumes', label: 'Volumes', icon: HardDrive },
  { to: '/networks', label: 'Networks', icon: Share2 },
  { to: '/files', label: 'Files', icon: FolderTree },
]

export default function Sidebar() {
  const [pruning, setPruning] = useState(false)
  const [done, setDone] = useState(false)
  const [pruningImages, setPruningImages] = useState(false)
  const [imagesDone, setImagesDone] = useState(false)

  const handlePrune = async () => {
    if (!confirm('Run docker system prune? This removes unused containers, images, networks, and build cache.')) return
    setPruning(true)
    try {
      await api.docker.prune()
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setPruning(false)
    }
  }

  const handlePruneImages = async () => {
    if (!confirm('Remove unused Docker images?')) return
    setPruningImages(true)
    try {
      await api.docker.pruneImages()
      setImagesDone(true)
      setTimeout(() => setImagesDone(false), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setPruningImages(false)
    }
  }

  return (
    <aside className="w-16 lg:w-56 border-r border-surface-800 bg-surface-900 flex flex-col shrink-0">
      <div className="h-14 flex items-center gap-2.5 px-4 lg:px-5 border-b border-surface-800">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shrink-0">
          <Server className="w-4 h-4 text-white" />
        </div>
        <span className="hidden lg:block text-sm font-semibold text-surface-200 tracking-tight">
          ServerDash
        </span>
      </div>

      <nav className="flex-1 py-3 px-2 lg:px-3 space-y-1 overflow-y-auto">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2 lg:px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-accent-500/10 text-accent-400 shadow-sm'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-surface-800 space-y-2">
        <button
          onClick={handlePruneImages}
          disabled={pruningImages}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50
            bg-surface-800/50 text-surface-400 hover:text-surface-200 hover:bg-surface-800"
        >
          {pruningImages ? (
            <Loader className="w-3.5 h-3.5 animate-spin" />
          ) : imagesDone ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Eraser className="w-3.5 h-3.5" />
          )}
          <span className="hidden lg:block">{pruningImages ? 'Pruning...' : imagesDone ? 'Done' : 'Prune Images'}</span>
        </button>
        <button
          onClick={handlePrune}
          disabled={pruning}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50
            bg-surface-800/50 text-surface-400 hover:text-surface-200 hover:bg-surface-800"
        >
          {pruning ? (
            <Loader className="w-3.5 h-3.5 animate-spin" />
          ) : done ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Eraser className="w-3.5 h-3.5" />
          )}
          <span className="hidden lg:block">{pruning ? 'Pruning...' : done ? 'Done' : 'System Prune'}</span>
        </button>
      </div>
    </aside>
  )
}
