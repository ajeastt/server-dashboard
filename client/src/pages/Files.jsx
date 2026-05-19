import { useState, useEffect, useCallback } from 'react'
import { Folder, FileText, Link as LinkIcon, FileUp, ChevronRight, Home, X, RefreshCw, ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/utils'

const bookmarks = [
  { path: '/', label: '/' },
  { path: '/opt/stacks', label: 'Stacks' },
  { path: '/opt/server-dashboard', label: 'ServerDash' },
  { path: '/opt/dockge', label: 'Dockge' },
]

export default function Files() {
  const [currentPath, setCurrentPath] = useState('/')
  const [entries, setEntries] = useState([])
  const [parent, setParent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [previewFile, setPreviewFile] = useState(null)
  const [previewContent, setPreviewContent] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const navigate = useCallback(async (p) => {
    setLoading(true)
    setError('')
    try {
      const result = await api.files.list(p)
      setEntries(result.items)
      setParent(result.parent)
      setCurrentPath(result.path)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { navigate('/') }, [navigate])

  const handleOpenPreview = async (entry) => {
    if (entry.type !== 'file' && entry.type !== 'symlink') return
    setPreviewLoading(true)
    setPreviewFile(entry)
    setPreviewContent(null)
    try {
      const result = await api.files.read(entry.path)
      setPreviewContent(result)
    } catch (err) {
      setPreviewContent({ error: err.message })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDoubleClick = (entry) => {
    if (entry.type === 'directory') {
      navigate(entry.path)
    } else {
      handleOpenPreview(entry)
    }
  }

  const formatTime = (ms) => {
    const d = new Date(ms)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const permString = (mode) => {
    const m = parseInt(mode, 8)
    const r = (n) => (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-')
    return r((m >> 6) & 7) + r((m >> 3) & 7) + r(m & 7)
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean)
  const crumbs = [{ label: '/', path: '/' }]
  let accumulated = ''
  for (const part of breadcrumbs) {
    accumulated += '/' + part
    crumbs.push({ label: part, path: accumulated })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100 tracking-tight">Files</h1>
        <button onClick={() => navigate(currentPath)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Bookmarks */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-surface-500 font-medium uppercase tracking-wider mr-1">Jump:</span>
        {bookmarks.map((b) => (
          <button
            key={b.path}
            onClick={() => navigate(b.path)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              currentPath === b.path
                ? 'bg-accent-500/10 text-accent-400'
                : 'bg-surface-800 text-surface-400 hover:text-surface-200 hover:bg-surface-700'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-surface-400 flex-wrap">
        {parent && currentPath !== '/' && (
          <button onClick={() => navigate(parent)} className="p-1 rounded hover:bg-surface-800 text-surface-500 hover:text-surface-200 transition-all mr-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-surface-600" />}
            {i === crumbs.length - 1 ? (
              <span className="text-surface-200 font-medium">{c.label}</span>
            ) : (
              <button onClick={() => navigate(c.path)} className="hover:text-surface-200 transition-all hover:underline underline-offset-2">
                {c.label}
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* File listing */}
      <div className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-surface-500 text-sm">Loading...</div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Folder className="w-10 h-10 text-surface-700" />
            <p className="text-sm text-surface-500">Empty directory</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-800 text-xs text-surface-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium w-8"></th>
                  <th className="text-left px-2 py-3 font-medium">Name</th>
                  <th className="text-right px-4 py-3 font-medium w-20">Size</th>
                  <th className="text-right px-4 py-3 font-medium w-32 hidden sm:table-cell">Modified</th>
                  <th className="text-center px-4 py-3 font-medium w-24 hidden md:table-cell">Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {entries.map((entry) => (
                  <tr
                    key={entry.path}
                    onClick={() => handleDoubleClick(entry)}
                    className="text-sm text-surface-300 hover:bg-surface-800/50 cursor-pointer transition-all"
                  >
                    <td className="px-4 py-3">
                      {entry.type === 'directory' ? (
                        <Folder className="w-4 h-4 text-amber-400" />
                      ) : entry.type === 'symlink' ? (
                        <LinkIcon className="w-4 h-4 text-sky-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-surface-500" />
                      )}
                    </td>
                    <td className="px-2 py-3 font-medium text-surface-200 truncate max-w-[200px] sm:max-w-xs">
                      {entry.name}
                      {entry.isSymlink && <span className="text-surface-500 text-xs ml-1">→</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-surface-400 whitespace-nowrap">
                      {entry.type === 'directory' ? '—' : formatBytes(entry.size)}
                    </td>
                    <td className="px-4 py-3 text-right text-surface-500 text-xs whitespace-nowrap hidden sm:table-cell">
                      {formatTime(entry.mtime)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-mono text-surface-500 hidden md:table-cell">
                      {permString(entry.mode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File preview modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setPreviewFile(null); setPreviewContent(null) }}>
          <div className="w-full max-w-4xl mx-4 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl animate-slide-up overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-surface-400 shrink-0" />
                <h2 className="text-sm font-semibold text-surface-200 truncate">{previewFile.path}</h2>
              </div>
              <button onClick={() => { setPreviewFile(null); setPreviewContent(null) }} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {previewLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-surface-500 text-sm">Loading...</div>
                </div>
              ) : previewContent?.error ? (
                <div className="p-5 text-sm text-red-400">{previewContent.error}</div>
              ) : previewContent?.binary ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <FileUp className="w-10 h-10 text-surface-700" />
                  <p className="text-sm text-surface-500">Binary file — preview not available</p>
                  <p className="text-xs text-surface-600">{formatBytes(previewFile.size)}</p>
                </div>
              ) : (
                <pre className="p-5 text-sm font-mono text-surface-200 whitespace-pre-wrap break-all leading-relaxed">{previewContent?.content}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
