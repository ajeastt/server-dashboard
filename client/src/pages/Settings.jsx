import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Wifi, Trash2, Check, AlertCircle, Loader } from 'lucide-react'
import { api } from '../lib/api'

export default function Settings() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    api.config.get().then((cfg) => {
      setConfig(cfg)
      if (cfg.widgets?.unifi?.configured) {
        setUrl(cfg.widgets.unifi.url)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const cleanUrl = url.replace(/\/+$/, '')
    try {
      await api.config.save({
        unifi: { url: cleanUrl, username, password },
      })
      setSuccess('UniFi config saved')
      setPassword('')
      setConfig((prev) => ({
        ...prev,
        widgets: { ...prev?.widgets, unifi: { configured: true, url: cleanUrl } },
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Remove UniFi config?')) return
    try {
      await api.config.deleteUniFi()
      setUrl('')
      setUsername('')
      setPassword('')
      setConfig((prev) => ({
        ...prev,
        widgets: { ...prev?.widgets, unifi: { configured: false } },
      }))
      setSuccess('UniFi config removed')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-surface-500 text-sm">Loading...</div>
      </div>
    )
  }

  const unifiConfigured = config?.widgets?.unifi?.configured

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-500/10 text-accent-400">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-100 tracking-tight">Settings</h1>
          <p className="text-sm text-surface-500">Configure widget integrations</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${unifiConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-800 text-surface-400'}`}>
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-surface-200">UniFi Network</h2>
              <p className="text-xs text-surface-500">
                {unifiConfigured ? `Connected to ${config.widgets.unifi.url}` : 'Not configured'}
              </p>
            </div>
          </div>
          {unifiConfigured && (
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          )}
        </div>

        {unifiConfigured ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-surface-800/50 text-sm text-surface-400">
            <Check className="w-4 h-4 text-emerald-400" />
            UniFi controller is configured. Dashboard will show network widgets.
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Controller URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://10.1.1.1:8443"
                className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-200 text-sm placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-200 text-sm placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-200 text-sm placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !url || !username || !password}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
