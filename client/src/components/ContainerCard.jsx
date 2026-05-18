import { Link } from 'react-router-dom'
import { Play, Square, RefreshCw, Pause } from 'lucide-react'
import { stateColor, stateBg } from '../lib/utils'

export default function ContainerCard({ container, onAction }) {
  const statusColor = stateColor(container.state)
  const bgColor = stateBg(container.state)

  return (
    <div className={`rounded-xl border p-4 ${bgColor} animate-fade-in`}>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/containers/${container.id}`}
            className="text-sm font-semibold text-surface-200 hover:text-accent-400 transition-colors truncate block"
          >
            {container.name}
          </Link>
          <p className="text-xs text-surface-500 mt-0.5 truncate">{container.image}</p>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${statusColor} bg-surface-800/50`}>
            <span className={`w-1.5 h-1.5 rounded-full ${container.state === 'running' ? 'bg-emerald-400 animate-pulse' : container.state === 'paused' ? 'bg-amber-400' : 'bg-surface-500'}`} />
            {container.state}
          </span>
        </div>
      </div>

      <p className="text-xs text-surface-500 mb-3">{container.status}</p>

      {onAction && (
        <div className="flex items-center gap-1 pt-2 border-t border-surface-800/50">
          {container.state === 'running' ? (
            <>
              <button
                onClick={() => onAction(container.id, 'stop')}
                className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Stop"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAction(container.id, 'pause')}
                className="p-1.5 rounded-lg text-surface-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                title="Pause"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onAction(container.id, 'start')}
              className="p-1.5 rounded-lg text-surface-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
              title="Start"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onAction(container.id, 'restart')}
            className="p-1.5 rounded-lg text-surface-500 hover:text-accent-400 hover:bg-accent-500/10 transition-all"
            title="Restart"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
