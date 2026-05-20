import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Gauge,
  Container,
  HardDrive,
  Database,
  Share2,
  FolderTree,
  Eraser,
  Server,
} from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/utils'

const links = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/containers', label: 'Containers', icon: Container },
  { to: '/storage', label: 'Storage', icon: Database },
  { to: '/volumes', label: 'Volumes', icon: HardDrive },
  { to: '/networks', label: 'Networks', icon: Share2 },
  { to: '/files', label: 'Files', icon: FolderTree },
]

export default function TopNav() {
  const [pruneOpen, setPruneOpen] = useState(false)
  const [result, setResult] = useState(null)

  const doPruneImages = async () => {
    setPruneOpen(false)
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
    setPruneOpen(false)
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
      <header className="sticky top-0 z-40 border-b border-base-700/50 bg-base-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-12 gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-6 h-6 rounded-md bg-accent-500/20 flex items-center justify-center">
                <Server className="w-3.5 h-3.5 text-accent-400" />
              </div>
              <span className="text-sm font-semibold text-[#e4e4ed] tracking-tight hidden sm:block">ServerDash</span>
            </div>

            {/* Nav links */}
            <nav className="flex items-center gap-1 flex-1">
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => isActive ? 'nav-link-active flex items-center gap-1.5' : 'nav-link flex items-center gap-1.5'}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Prune */}
            <div className="relative">
              <button
                onClick={() => setPruneOpen(!pruneOpen)}
                className="btn-secondary text-xs"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prune</span>
              </button>
              {pruneOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPruneOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-base-700/60 bg-base-900 shadow-xl animate-fade-in">
                    <button onClick={doPruneImages} className="w-full text-left px-3 py-2 text-sm text-[#8a8a9a] hover:text-[#e4e4ed] hover:bg-white/[0.04] transition-all first:rounded-t-lg">
                      Prune Images
                    </button>
                    <button onClick={doSystemPrune} className="w-full text-left px-3 py-2 text-sm text-[#8a8a9a] hover:text-[#e4e4ed] hover:bg-white/[0.04] transition-all last:rounded-b-lg">
                      System Prune
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Result modal */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setResult(null)}>
          <div className="w-full max-w-sm mx-4 rounded-xl border border-base-700/60 bg-base-900 shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-base-700/40">
              <h3 className="text-sm font-semibold text-[#e4e4ed]">{result.title}</h3>
            </div>
            <div className="px-5 py-4 space-y-1.5">
              {result.lines.map((line, i) => (
                <p key={i} className="text-sm text-[#8a8a9a]">{line}</p>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-base-700/40 flex justify-end">
              <button onClick={() => setResult(null)} className="btn-primary">OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
