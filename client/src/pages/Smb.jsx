import { useState, useEffect, useCallback } from 'react'
import { Server, FolderOpen, Plus, Trash2, Play, Square, RefreshCw, Loader, AlertCircle, CheckCircle, Download, X } from 'lucide-react'
import { api } from '../lib/api'

export default function Smb() {
  const [status, setStatus] = useState(null)
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [acting, setActing] = useState(null)
  const [msg, setMsg] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', path: '', comment: '', readOnly: 'no', guestOk: 'no', validUsers: '' })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, sh] = await Promise.all([
        api.smb.status().catch(() => ({ installed: false, running: false })),
        api.smb.shares().catch(() => []),
      ])
      setStatus(s)
      setShares(sh)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const doInstall = async () => {
    setInstalling(true)
    setMsg(null)
    try {
      await api.smb.install()
      setMsg({ type: 'info', text: 'Installation started in background. Check back in a minute.' })
      setTimeout(fetchAll, 60000)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally { setInstalling(false) }
  }

  const doService = async (action) => {
    setActing(action)
    setMsg(null)
    try {
      const data = await api.smb.service(action)
      if (data.success) setMsg({ type: 'success', text: `Samba ${action}ed successfully` })
      else setMsg({ type: 'error', text: data.error || 'Failed' })
    } catch (err) { setMsg({ type: 'error', text: err.message }) }
    finally { setActing(null); api.smb.status().then(setStatus).catch(() => {}) }
  }

  const doAddShare = async (e) => {
    e.preventDefault()
    setMsg(null)
    try {
      await api.smb.addShare(form)
      setMsg({ type: 'success', text: `Share "${form.name}" created` })
      setShowAdd(false)
      setForm({ name: '', path: '', comment: '', readOnly: 'no', guestOk: 'no', validUsers: '' })
      api.smb.shares().then(setShares).catch(() => {})
    } catch (err) { setMsg({ type: 'error', text: err.message }) }
  }

  const doRemoveShare = async (name) => {
    if (!confirm(`Remove share "${name}"?`)) return
    setMsg(null)
    try {
      await api.smb.removeShare(name)
      setMsg({ type: 'success', text: `Share "${name}" removed` })
      api.smb.shares().then(setShares).catch(() => {})
    } catch (err) { setMsg({ type: 'error', text: err.message }) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-5 h-5 animate-spin text-[#8a8a9a]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">SMB / Samba</h1>
        <button onClick={fetchAll} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
          msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
          msg.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
          'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> :
           msg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> :
           <Loader className="w-4 h-4 shrink-0 animate-spin" />}
          {msg.text}
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status?.installed ? 'bg-accent-500/20' : 'bg-amber-500/10'}`}>
              <Server className={`w-5 h-5 ${status?.installed ? 'text-accent-400' : 'text-amber-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#e4e4ed]">Samba</h2>
                {!status?.installed && <span className="badge bg-amber-500/10 text-amber-400">Not Installed</span>}
                {status?.installed && !status?.running && <span className="badge bg-red-500/10 text-red-400">Stopped</span>}
                {status?.installed && status?.running && <span className="badge bg-emerald-500/10 text-emerald-400">Running</span>}
                {status?.installed && status?.enabled && <span className="badge bg-accent-500/10 text-accent-400 text-[10px]">Auto-Start</span>}
              </div>
              <p className="text-xs text-[#8a8a9a] mt-0.5">
                {!status?.installed ? 'Samba is not installed on the host' :
                 status?.running ? 'SMB file sharing is active' :
                 'Samba is installed but not running'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!status?.installed ? (
              <button onClick={doInstall} disabled={installing} className="btn-primary">
                {installing ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {installing ? 'Installing...' : 'Install Samba'}
              </button>
            ) : (
              <>
                {status?.running ? (
                  <button onClick={() => doService('stop')} disabled={acting === 'stop'} className="btn-secondary">
                    {acting === 'stop' ? <Loader className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                    Stop
                  </button>
                ) : (
                  <button onClick={() => doService('start')} disabled={acting === 'start'} className="btn-primary">
                    {acting === 'start' ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Start
                  </button>
                )}
                <button onClick={() => doService('restart')} disabled={acting === 'restart'} className="btn-secondary">
                  {acting === 'restart' ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Restart
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {status?.installed && (
        <>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#e4e4ed]">Shares</h2>
              <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Share</button>
            </div>
            {shares.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-2">
                <FolderOpen className="w-8 h-8 text-[#5a5a6a]" />
                <p className="text-sm text-[#8a8a9a]">No shares configured</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shares.map((s) => (
                  <div key={s.name} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-base-700/40 bg-base-950/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#e4e4ed]">{s.name}</span>
                        {s.readOnly === 'yes' && <span className="badge bg-amber-500/10 text-amber-400 text-[10px]">RO</span>}
                        {s.guestOk === 'yes' && <span className="badge bg-accent-500/10 text-accent-400 text-[10px]">Guest</span>}
                      </div>
                      <p className="text-xs text-[#8a8a9a] mt-0.5 font-mono">{s.path}{s.comment ? ` — ${s.comment}` : ''}</p>
                    </div>
                    <button onClick={() => doRemoveShare(s.name)} className="btn-ghost p-1.5 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showAdd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { setShowAdd(false); setMsg(null) }}>
              <div className="w-full max-w-lg mx-4 rounded-xl border border-base-700/60 bg-base-900 shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-700/40">
                  <h2 className="text-sm font-semibold text-[#e4e4ed]">Add SMB Share</h2>
                  <button onClick={() => setShowAdd(false)} className="p-1 rounded text-[#8a8a9a] hover:text-[#e4e4ed] hover:bg-white/[0.04] transition-all"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={doAddShare} className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Share Name</label>
                      <input type="text" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="input" placeholder="media" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Read Only</label>
                      <select value={form.readOnly} onChange={(e) => setForm(p => ({ ...p, readOnly: e.target.value }))} className="input">
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Path</label>
                    <input type="text" value={form.path} onChange={(e) => setForm(p => ({ ...p, path: e.target.value }))} className="input font-mono" placeholder="/path/to/share" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Comment (optional)</label>
                    <input type="text" value={form.comment} onChange={(e) => setForm(p => ({ ...p, comment: e.target.value }))} className="input" placeholder="My shared folder" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Guest Access</label>
                      <select value={form.guestOk} onChange={(e) => setForm(p => ({ ...p, guestOk: e.target.value }))} className="input">
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Valid Users (optional)</label>
                      <input type="text" value={form.validUsers} onChange={(e) => setForm(p => ({ ...p, validUsers: e.target.value }))} className="input" placeholder="user1, user2" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
                    <button type="submit" className="btn-primary"><Plus className="w-4 h-4" /> Add Share</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
