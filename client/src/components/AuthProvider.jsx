import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const TOKEN_KEY = 'serverdash_token'
const USER_KEY = 'serverdash_user'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUserState] = useState(() => localStorage.getItem(USER_KEY))

  const setToken = useCallback((t) => {
    setTokenState(t)
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) }
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }))
      throw new Error(err.error)
    }
    const data = await res.json()
    setToken(data.token)
    setUserState(data.username)
    localStorage.setItem(USER_KEY, data.username)
    return data
  }, [setToken])

  const logout = useCallback(() => {
    setToken(null)
    setUserState(null)
  }, [setToken])

  // Expose token to api module
  useEffect(() => {
    window.__authToken = token
  }, [token])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
