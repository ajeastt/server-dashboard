import { useState, useEffect, useCallback } from 'react'
import { Folder, FileText, Link as LinkIcon, ChevronRight, X, RefreshCw, ArrowLeft, Save, Check, Loader } from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/utils'
import CodeEditor from '../components/CodeEditor'

export default function Files() {
  const [currentPath, setCurrentPath] = useState('/')
  const [entries, setEntries] = useState([])
  const [parent, setParent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [previewContent, setPreviewContent] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [fileContent, setFileContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const navigate = useCallback(async (p) => {
    setLoading(true); setError('')
    try { const r = await api.files.list(p); setEntries(r.items); setParent(r.parent); setCurrentPath(r.path) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { navigate('/') }, [navigate])

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && previewFile && !previewLoading) {
        e.preventDefault(); handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const handleOpenPreview = async (entry) => {
    if (entry.type !== 'file' && entry.type !== 'symlink') return
    setSaveMsg('')
    setPreviewLoading(true); setPreviewFile(entry); setFileContent('')
    try { const c = await api.files.read(entry.path); setPreviewContent(c); setFileContent(c.content || '') }
    catch (err) { setPreviewContent({ error: err.message }) }
    finally { setPreviewLoading(false) }
  }

  const handleSave = async () => {
    if (!previewFile || saving) return
    setSaving(true); setSaveMsg('')
    try {
      await api.files.write(previewFile.path, fileContent)
      setSaveMsg('saved')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err) {
      setSaveMsg(`error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDoubleClick = (entry) => entry.type === 'directory' ? navigate(entry.path) : handleOpenPreview(entry)

  const formatTime = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const permString = (mode) => { const m = parseInt(mode, 8); const r = (n) => (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-'); return r((m >> 6) & 7) + r((m >> 3) & 7) + r(m & 7) }

  const crumbs = currentPath.split('/').filter(Boolean).reduce((acc, part) => { acc.push({ label: part, path: acc[acc.length - 1].path + '/' + part }); return acc }, [{ label: '/', path: '/' }])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Files</h1>
        <button onClick={() => navigate(currentPath)} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      <div className="flex items-center gap-1 text-sm text-[#8a8a9a] flex-wrap">
        {parent && currentPath !== '/' && (
          <button onClick={() => navigate(parent)} className="btn-ghost p-1 mr-0.5"><ArrowLeft className="w-4 h-4" /></button>
        )}
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 text-[#5a5a6a]" />}
            {i === crumbs.length - 1 ? <span className="text-[#e4e4ed] font-medium">{c.label}</span> : <button onClick={() => navigate(c.path)} className="hover:text-[#e4e4ed] transition-colors">{c.label}</button>}
          </span>
        ))}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-[#8a8a9a]">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3"><Folder className="w-10 h-10 text-[#5a5a6a]" /><p className="text-sm text-[#8a8a9a]">Empty directory</p></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-base-700/30 text-xs text-[#5a5a6a] uppercase tracking-wider">
                <th className="table-header w-8"></th>
                <th className="table-header">Name</th>
                <th className="table-header text-right w-20">Size</th>
                <th className="table-header text-right w-32 hidden sm:table-cell">Modified</th>
                <th className="table-header text-center w-24 hidden md:table-cell">Permissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-700/20">
              {entries.map((entry) => (
                <tr key={entry.path} onClick={() => handleDoubleClick(entry)} className="text-sm text-[#8a8a9a] hover:bg-white/[0.02] cursor-pointer transition-all">
                  <td className="px-4 py-3">
                    {entry.type === 'directory' ? <Folder className="w-4 h-4 text-amber-400" /> : entry.type === 'symlink' ? <LinkIcon className="w-4 h-4 text-sky-400" /> : <FileText className="w-4 h-4 text-[#5a5a6a]" />}
                  </td>
                  <td className="px-2 py-3 font-medium text-[#e4e4ed] truncate max-w-[200px] sm:max-w-xs">
                    {entry.name}{entry.isSymlink && <span className="text-[#5a5a6a] text-xs ml-1">→</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono whitespace-nowrap">{entry.type === 'directory' ? '—' : formatBytes(entry.size)}</td>
                  <td className="px-4 py-3 text-right text-xs whitespace-nowrap hidden sm:table-cell">{formatTime(entry.mtime)}</td>
                  <td className="px-4 py-3 text-center text-xs font-mono text-[#5a5a6a] hidden md:table-cell">{permString(entry.mode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { setPreviewFile(null); setPreviewContent(null); setSaveMsg('') }}>
          <div className="w-full max-w-4xl mx-4 rounded-xl border border-base-700/60 bg-base-900 shadow-xl animate-fade-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-700/40">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[#8a8a9a] shrink-0" />
                <h2 className="text-sm font-semibold text-[#e4e4ed] truncate">{previewFile.path}</h2>
                {saveMsg === 'saved' && <span className="text-xs text-emerald-400"><Check className="w-3 h-3 inline" /> Saved</span>}
                {saveMsg && saveMsg !== 'saved' && <span className="text-xs text-red-400">{saveMsg}</span>}
              </div>
              <div className="flex items-center gap-1">
                {!previewContent?.binary && previewContent?.content !== undefined && (
                  <button onClick={handleSave} disabled={saving} className="btn-ghost p-1.5 text-xs" title="Save (Ctrl+S)">
                    {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button onClick={() => { setPreviewFile(null); setPreviewContent(null); setSaveMsg('') }} className="p-1 rounded text-[#8a8a9a] hover:text-[#e4e4ed] hover:bg-white/[0.04] transition-all"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {previewLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="flex items-center gap-2 text-sm text-[#8a8a9a]"><div className="w-4 h-4 rounded-full border border-accent-500/40 border-t-accent-500 animate-spin" /> Loading...</div>
                </div>
              ) : previewContent?.error ? (
                <div className="p-5 text-sm text-red-400">{previewContent.error}</div>
              ) : previewContent?.binary ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3"><Folder className="w-10 h-10 text-[#5a5a6a]" /><p className="text-sm text-[#8a8a9a]">Binary file — preview not available</p><p className="text-xs text-[#5a5a6a]">{formatBytes(previewFile.size)}</p></div>
              ) : (
                <div style={{ minHeight: '50vh' }}>
                  <CodeEditor value={fileContent} onChange={setFileContent} minHeight="50vh" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
