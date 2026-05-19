import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, AlertCircle, Loader } from 'lucide-react'

export default function StackUpdateModal({ name, onClose, onDone }) {
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('updating')
  const [phase, setPhase] = useState('pull')
  const endRef = useRef(null)
  const bufRef = useRef([])
  const timerRef = useRef(null)
  const closeTimerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (bufRef.current.length > 0) {
        setLines((prev) => [...prev, ...bufRef.current])
        bufRef.current = []
      }
    }, 40)
    return () => clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    const es = new EventSource(`/api/docker/stacks/${encodeURIComponent(name)}/update-stream`)

    es.onmessage = (e) => {
      try {
        const obj = JSON.parse(e.data)
        if (obj.stream) {
          const textLines = obj.stream.split('\n').filter(Boolean)
          bufRef.current.push(...textLines.map((t) => ({ text: t, type: 'output' })))
        }
      } catch {}
    }

    es.addEventListener('phase', (e) => {
      const d = JSON.parse(e.data)
      setPhase(d.phase)
      bufRef.current.push({ text: '--- Restarting services ---', type: 'phase' })
    })

    es.addEventListener('no-update', () => {
      clearInterval(timerRef.current)
      setLines((prev) => [...prev, ...bufRef.current, { text: 'All images already up to date', type: 'done' }])
      bufRef.current = []
      setStatus('done')
      es.close()
      closeTimerRef.current = setTimeout(() => { if (onDone) onDone() }, 1500)
    })

    es.addEventListener('done', () => {
      clearInterval(timerRef.current)
      setLines((prev) => [...prev, ...bufRef.current, { text: 'Stack updated successfully', type: 'done' }])
      bufRef.current = []
      setStatus('done')
      es.close()
      if (onDone) onDone()
    })

    es.addEventListener('error', (e) => {
      clearInterval(timerRef.current)
      let msg = 'Update failed'
      try { const d = JSON.parse(e.data); msg = d.error || msg } catch {}
      setLines((prev) => [...prev, ...bufRef.current, { text: msg, type: 'error' }])
      bufRef.current = []
      setStatus('error')
      es.close()
    })

    es.onerror = () => {
      if (status === 'updating') {
        clearInterval(timerRef.current)
        setLines((prev) => [...prev, ...bufRef.current, { text: 'Connection lost', type: 'error' }])
        bufRef.current = []
        setStatus('error')
        es.close()
      }
    }

    return () => {
      es.close()
      clearTimeout(closeTimerRef.current)
    }
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
              <h2 className="text-sm font-semibold text-surface-200">
                {status === 'done' && phase === 'pull' ? 'Already up to date' :
                 phase === 'up' ? 'Restarting services...' : 'Updating images...'}
              </h2>
              <p className="text-xs text-surface-500">
                {status === 'done' ? 'Complete' : status === 'error' ? 'Failed' : 'Stack: ' + name}
              </p>
            </div>
          </div>
          {status !== 'updating' && (
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
              line.type === 'phase' ? 'text-accent-400 font-semibold' :
              'text-surface-400'
            }`}>
              {line.text}
            </div>
          ))}
          {status === 'updating' && (
            <span className="inline-block w-2 h-4 bg-surface-400 animate-pulse ml-0.5" />
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  )
}