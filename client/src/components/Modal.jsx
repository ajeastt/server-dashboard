import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    if (open) {
      const handler = (e) => { if (e.key === 'Escape') onClose() }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <h3 className="text-sm font-semibold text-surface-200">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
