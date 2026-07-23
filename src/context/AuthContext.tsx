import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { API_BASE } from '../lib/api'

interface User {
  id: string
  name: string
  email: string
  role: string
  orgId: string
}

interface AuthState {
  user: User | null
  token: string | null
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void
  logout: () => void
  isAuthed: boolean
}

const STORAGE_KEY = 'stratis.auth.v1'

const AuthContext = createContext<AuthContextValue | null>(null)

function loadAuth(): AuthState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { user: null, token: null }

    const parsed = JSON.parse(raw) as AuthState
    if (!parsed?.token || !parsed?.user) return { user: null, token: null }

    return parsed
  } catch {
    return { user: null, token: null }
  }
}

function saveAuth(auth: AuthState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

function clearAuth() {
  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem('stratis.activeSessionId.v1')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => loadAuth())

  const login = (token: string, user: User) => {
    const next = { token, user }
    setAuth(next)
    saveAuth(next)
  }

  const logout = () => {
    setAuth({ user: null, token: null })
    clearAuth()
  }

  // A stored token is only a claim. After a backend redeploy or DB reset it can
  // reference an account that no longer exists — which used to render the
  // dashboard normally (list queries just return no rows) and then 500 on the
  // first insert (New Meeting). Validate the token against the server on boot
  // and drop the session when the identity is definitively gone.
  useEffect(() => {
    if (!auth.token) return
    const controller = new AbortController()
    void fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      signal: controller.signal,
    })
      .then((res) => {
        // Only a definitive verdict logs the user out: 401 = bad/expired
        // token, 404 = user row gone. Network failures and 5xx keep the
        // session — being offline must not sign you out.
        if (res.status === 401 || res.status === 404) logout()
      })
      .catch(() => {})
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token])

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isAuthed: !!auth.token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}