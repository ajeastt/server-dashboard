import { useState, useEffect, useRef } from 'react'
import { Terminal, X, CheckCircle, AlertCircle, Loader } from 'lucide-react'

export default function PullProgressModal({ name, onClose, onDone }) {
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('pulling')
  const endRef = useRef(null)
  const evtSource = useRef(null)

  useEffect(() => {
    const es = new EventSource(`/api/docker/images/pull-stream?name=${encodeURIComponent(name)}`)
    evtSource.current = es

    es.onmessage = (e) => {
      try {
        const obj = JSON.parse(e.data)
        const line = formatProgress(obj)
        if (line) setLines((prev) => [...prev, line])
      } catch {}
    }

    es.addEventListener('done', () => {
      setLines((prev) => [...prev, { text: 'Pull complete', type: 'done' }])
      setStatus('done')
      es.close()
      if (onDone) onDone()
    })

    es.addEventListener('error', (e) => {
      let msg = 'Pull failed'
      try { const d = JSON.parse(e.data); msg = d.error || msg } catch {}
      setLines((prev) => [...prev, { text: msg, type: 'error' }])
      setStatus('error')
      es.close()
    })

    es.onerror = () => {
      if (status === 'pulling') {
        setLines((prev) => [...prev, { text: 'Connection lost', type: 'error' }])
        setStatus('error')
        es.close()
      }
    }

    return () => { es.close() }
  }, [name])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-surface-800">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${
              status === 'done' ? 'bg-emerald-500/10 text-emerald-400' :
              status === 'error' ? 'bg-red-500/10 text-red-400' :
              'bg-accent-500/10 text-accent-400'
            }`}>
              {status === 'done' ? <CheckCircle className="w-5 h-5" /> :
               status === 'error' ? <AlertCircle className="w-5 h-5" /> :
               <Loader className="w-5 h-5 animate-spin" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-surface-200">Pulling {name}</h2>
              <p className="text-xs text-surface-500">{status === 'done' ? 'Complete' : status === 'error' ? 'Failed' : 'Downloading...'}</p>
            </div>
          </div>
          {status !== 'pulling' && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs leading-relaxed bg-surface-950 rounded-b-xl">
          {lines.length === 0 && (
            <div className="text-surface-600 italic">Waiting for output...</div>
          )}
          {lines.map((line, i) => (
            <div key={i} className={`${
              line.type === 'error' ? 'text-red-400' :
              line.type === 'done' ? 'text-emerald-400 font-semibold' :
              line.type === 'progress' ? 'text-accent-400' :
              line.type === 'status' ? 'text-surface-300' :
              'text-surface-400'
            }`}>
              {line.text}
            </div>
          ))}
          {status === 'pulling' && (
            <span className="inline-block w-2 h-4 bg-surface-400 animate-pulse ml-0.5" />
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  )
}

function formatProgress(obj) {
  if (!obj || !obj.status) return null

  const { status, id, progress, progressDetail } = obj

  if (status.startsWith('Pulling from') || status.startsWith('Digest:') || status.startsWith('Status:')) {
    return { text: status, type: 'status' }
  }

  if (status === 'Image is up to date for ' + obj.id || status === 'Image is up to date') {
    return { text: `✓ ${id || ''} Image is up to date`.trim(), type: 'done' }
  }

  if (status === 'Downloaded newer image') {
    return { text: `✓ ${status}${id ? ' for ' + id : ''}`, type: 'done' }
  }

  if (status === 'Downloading' || status === 'Extracting' || status === 'Pull complete' || status === 'Already exists' || status === 'Waiting' || status === 'Verifying Checksum' || status === 'Download complete') {
    const icon = status === 'Pull complete' || status === 'Already exists' ? '✓' :
                 status === 'Downloading' || status === 'Extracting' ? ' ' : ' '
    const pct = progressDetail?.current && progressDetail?.total
      ? ` ${Math.round(progressDetail.current / progressDetail.total * 100)}%`
      : ''
    const bar = progress ? ` ${progress}` : ''
    return { text: `${icon} ${id ? id + ' ' : ''}${status}${pct}${bar}`, type: status === 'Downloading' ? 'progress' : 'status' }
  }

  return { text: `${status}${id ? ' ' + id : ''}`, type: 'info' }
}
