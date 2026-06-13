import { createContext, useContext, useState, type ReactNode } from 'react'

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