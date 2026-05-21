import { useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Server, Loader, AlertCircle, CheckCircle } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const changed = searchParams.get('changed') === '1'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username, password)
      if (data.mustChangePassword) navigate('/change-password')
      else navigate('/')
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
          <h1 className="text-sm font-semibold text-[#e4e4ed] mb-1">Sign in</h1>
          <p className="text-xs text-[#8a8a9a] mb-5">Enter your credentials to access the dashboard</p>
          {changed && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 mb-4">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Password changed. Please sign in with your new password.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="admin"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8a8a9a] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
