import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Role, SubscriptionView, User } from '@shared/types'
import { API_BASE } from '../lib/api'
import {
  SESSION_ENDED_EVENT,
  apiFetch,
  type SessionEndedDetail,
} from '../lib/http'

interface AuthState {
  user: User | null
  token: string | null
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void
  logout: () => void
  isAuthed: boolean
  role: Role | null
  isAdmin: boolean
  /** Why the last session ended, if it was ended for us. Cleared on next login. */
  endedReason: SessionEndedDetail | null
  clearEndedReason: () => void
  subscription: SubscriptionView | null
  refreshSubscription: () => Promise<void>
  refreshUser: () => Promise<void>
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
  const [endedReason, setEndedReason] = useState<SessionEndedDetail | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null)

  const login = (token: string, user: User) => {
    const next = { token, user }
    setAuth(next)
    saveAuth(next)
    setEndedReason(null)
  }

  const logout = useCallback(() => {
    setAuth({ user: null, token: null })
    setSubscription(null)
    clearAuth()
  }, [])

  /**
   * The server can end a session out from under us — an admin revokes the
   * account, or a release invalidates every token issued before it. apiFetch
   * turns that answer into one event, and this is the only place that acts on
   * it, so a revoked user is signed out no matter which screen they were on.
   */
  useEffect(() => {
    const onEnded = (event: Event) => {
      const detail = (event as CustomEvent<SessionEndedDetail>).detail
      setEndedReason(detail)
      logout()
    }
    window.addEventListener(SESSION_ENDED_EVENT, onEnded)
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded)
  }, [logout])

  /**
   * Validates the stored session against the server on boot, and adopts the
   * user it sends back.
   *
   * The adopt half matters: this used to check the status code and throw the
   * body away, so a role change never reached the cached user. An admin who had
   * been demoted kept the Admin item in their sidebar until they logged out —
   * the API refused them, but the UI kept offering it.
   */
  useEffect(() => {
    if (!auth.token) return
    const controller = new AbortController()
    const token = auth.token

    void fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 404 || res.status === 403) {
          logout()
          return
        }
        if (!res.ok) return
        const body = (await res.json()) as { data?: User }
        if (!body?.data) return
        setAuth((prev) => {
          // A logout may have landed while this was in flight.
          if (prev.token !== token) return prev
          const next = { token, user: body.data as User }
          saveAuth(next)
          return next
        })
      })
      .catch(() => {})
    return () => controller.abort()
  }, [auth.token, logout])

  const refreshSubscription = useCallback(async () => {
    if (!auth.token) return
    try {
      setSubscription(await apiFetch<SubscriptionView>('/api/billing/subscription'))
    } catch {
      // A plan we cannot read must not block the app — features fall back to
      // whatever the server enforces on the next call anyway.
    }
  }, [auth.token])

  const refreshUser = useCallback(async () => {
    if (!auth.token) return
    try {
      const fresh = await apiFetch<{ profile: User }>('/api/profile')
      setAuth((prev) => {
        const next = { token: prev.token, user: fresh.profile }
        if (next.token) saveAuth(next as AuthState)
        return next as AuthState
      })
    } catch {
      // Leave the cached user in place.
    }
  }, [auth.token])

  useEffect(() => {
    if (auth.token) void refreshSubscription()
  }, [auth.token, refreshSubscription])

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        login,
        logout,
        isAuthed: !!auth.token,
        role: auth.user?.role ?? null,
        isAdmin: auth.user?.role === 'admin',
        endedReason,
        clearEndedReason: () => setEndedReason(null),
        subscription,
        refreshSubscription,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
