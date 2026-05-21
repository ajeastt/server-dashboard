import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Loader, AlertCircle, CheckCircle, Lock } from 'lucide-react'
import { changePassword } from '../lib/api'
import { useAuth } from '../components/AuthProvider'

export default function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPw.length < 6) { setError('Password must be at least 6 characters'); return }
    if (newPw !== confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      await changePassword(current, newPw)
      logout()
      navigate('/login?changed=1')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent-500/20 flex items-center justify-center">
            <Server className="w-4 h-4 text-accent-400" />
          </div>
          <span className="text-lg font-semibold text-[#e4e4ed]">ServerDash</span>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-accent-400" />
            <h1 className="text-sm font-semibold text-[#e4e4ed]">Change Password</h1>
          </div>
          <p className="text-xs text-[#8a8a9a] mb-5">You're using the default password. Please set a new one.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Current Password</label>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="input" placeholder="••••••••" required autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">New Password</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="input" placeholder="at least 6 characters" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Confirm New Password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" placeholder="••••••••" required />
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
