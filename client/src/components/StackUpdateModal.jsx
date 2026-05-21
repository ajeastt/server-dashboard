import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, AlertCircle, Loader, RefreshCw, ArrowRight } from 'lucide-react'

export default function StackUpdateModal({ name, onClose, onDone }) {
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('updating')
  const [phase, setPhase] = useState('pull')
  const [detectedUpdate, setDetectedUpdate] = useState(false)
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
        if (obj.stream) bufRef.current.push(...obj.stream.split('\n').filter(Boolean).map((t) => ({ text: t, type: 'output' })))
      } catch {}
    }
    es.addEventListener('phase', (e) => {
      const p = JSON.parse(e.data).phase
      setPhase(p)
      if (p === 'up') setDetectedUpdate(true)
      bufRef.current.push({ text: p === 'pull' ? '--- Pulling images ---' : '--- Restarting services ---', type: 'phase' })
    })
    es.addEventListener('no-update', () => {
      clearInterval(timerRef.current)
      setLines((prev) => [...prev, ...bufRef.current, { text: 'All images already up to date', type: 'done' }])
      bufRef.current = []
      setStatus('no-update')
      setPhase('done')
      es.close()
      closeTimerRef.current = setTimeout(() => { if (onDone) onDone() }, 2000)
    })
    es.addEventListener('done', () => {
      clearInterval(timerRef.current)
      setLines((prev) => [...prev, ...bufRef.current, { text: 'Stack updated successfully', type: 'done' }])
      bufRef.current = []
      setStatus('done')
      setPhase('done')
      es.close()
      closeTimerRef.current = setTimeout(() => { if (onDone) onDone() }, 2000)
    })
    es.addEventListener('error', (e) => {
      clearInterval(timerRef.current)
      let msg = 'Update failed'
      try { const d = JSON.parse(e.data); msg = d.error || msg } catch {}
      setLines((prev) => [...prev, ...bufRef.current, { text: msg, type: 'error' }])
      bufRef.current = []
      setStatus('error')
      setPhase('done')
      es.close()
    })
    es.onerror = () => {
      if (status === 'updating' || status === 'no-update') return
      clearInterval(timerRef.current)
      setLines((prev) => [...prev, ...bufRef.current, { text: 'Connection lost', type: 'error' }])
      bufRef.current = []
      setStatus('error')
      setPhase('done')
      es.close()
    }
    return () => { es.close(); clearTimeout(closeTimerRef.current) }
  }, [name])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  const phaseSteps = [
    { key: 'pull', label: 'Pull images' },
    { key: 'up', label: 'Restart services' },
    { key: 'done', label: 'Complete' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-2xl mx-4 rounded-xl border border-base-700/60 bg-base-900 shadow-xl animate-fade-in">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-700/40">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${status === 'done' ? 'bg-emerald-500/10 text-emerald-400' : status === 'no-update' ? 'bg-[#1e1e2c] text-[#8a8a9a]' : status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-accent-500/10 text-accent-400'}`}>
              {status === 'done' ? <CheckCircle className="w-4 h-4" /> :
               status === 'error' ? <AlertCircle className="w-4 h-4" /> :
               <Loader className="w-4 h-4 animate-spin" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#e4e4ed]">
                {status === 'done' ? 'Stack Updated' :
                 status === 'no-update' ? 'Already Up to Date' :
                 status === 'error' ? 'Update Failed' :
                 phase === 'up' ? 'Restarting Services...' :
                 'Updating Images...'}
              </h2>
              <p className="text-xs text-[#8a8a9a]">{name}</p>
            </div>
          </div>
          {(status === 'done' || status === 'no-update' || status === 'error') && (
            <button onClick={onClose} className="p-1 rounded text-[#8a8a9a] hover:text-[#e4e4ed] hover:bg-white/[0.04] transition-all"><X className="w-4 h-4" /></button>
          )}
        </div>

        {/* Phase progress */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-base-700/20 bg-base-800/20">
          {phaseSteps.map((step, i) => {
            const active = phase === step.key
            const done = (status === 'done' || status === 'no-update') && i <= 2
            const noUpd = status === 'no-update' && i === 1
            return (
              <div key={step.key} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className={`w-3 h-3 ${active || done ? 'text-accent-400' : 'text-[#3a3a4a]'}`} />}
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-all ${done ? (step.key === 'up' && status === 'no-update' ? 'bg-[#1e1e2c] text-[#5a5a6a]' : 'bg-emerald-500/10 text-emerald-400') : active ? 'bg-accent-500/10 text-accent-400' : 'bg-[#1e1e2c] text-[#5a5a6a]'}`}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Output */}
        <div className="p-4 max-h-80 overflow-y-auto font-mono text-xs leading-relaxed bg-[#0b0b10] rounded-b-xl">
          {lines.length === 0 && (
            <div className="text-[#5a5a6a] italic flex items-center gap-2">
              <Loader className="w-3 h-3 animate-spin" /> Checking for updates...
            </div>
          )}
          {lines.map((line, i) => (
            <div key={i} className={`${line.type === 'error' ? 'text-red-400' : line.type === 'done' ? 'text-emerald-400 font-semibold' : line.type === 'phase' ? 'text-accent-400 font-semibold mt-1' : 'text-[#8a8a9a]'}`}>{line.text}</div>
          ))}
          {status === 'updating' && <span className="inline-block w-1.5 h-3 bg-[#8a8a9a] animate-pulse ml-0.5" />}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  )
}
