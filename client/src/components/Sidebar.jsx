import { NavLink } from 'react-router-dom'
import {
  Gauge,
  Container,
  Layers,
  Server,
} from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/containers', label: 'Containers', icon: Container },
  { to: '/stacks', label: 'Stacks', icon: Layers },
]

export default function Sidebar() {
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

      <nav className="flex-1 py-3 px-2 lg:px-3 space-y-1">
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

      <div className="p-3 border-t border-surface-800 hidden lg:block">
        <p className="text-xs text-surface-500">Server Dashboard v1.0</p>
      </div>
    </aside>
  )
}
