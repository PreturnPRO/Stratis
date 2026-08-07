import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Role, SubscriptionView, User } from '@shared/types'
import { clearCache, readCache, writeCache } from '../lib/cache'
import {
  SESSION_ENDED_EVENT,
  ApiError,
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

/** How often an idle tab asks the server whether it is still signed in. */
const HEARTBEAT_MS = 5 * 60_000

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
  // Cached payloads are this account's data. The next person to sign in on
  // this browser must not inherit a screen of it.
  clearCache()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => loadAuth())
  const [endedReason, setEndedReason] = useState<SessionEndedDetail | null>(null)
  // Seeded from the last plan we were told about, so the Plan tab has something
  // to render on arrival instead of a spinner.
  const [subscription, setSubscription] = useState<SubscriptionView | null>(() =>
    readCache<SubscriptionView>('subscription', loadAuth().user?.id),
  )

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

    void apiFetch<User>('/api/auth/me', {
      signal: controller.signal,
      // This one reports the outcome itself, so the reason below is set before
      // the sign-out rather than left blank on the login screen.
      silentSessionEnd: true,
    })
      .then((user) => {
        if (!user) return
        setAuth((prev) => {
          // A logout may have landed while this was in flight.
          if (prev.token !== token) return prev
          const next = { token, user }
          saveAuth(next)
          return next
        })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        if (!(err instanceof ApiError)) return // Offline. Keep the cached session.

        if (err.status === 401 || err.status === 403 || err.status === 404) {
          setEndedReason({
            reason:
              err.code === 'TOKEN_REVOKED'
                ? 'updated'
                : err.code === 'ACCOUNT_REVOKED'
                ? 'revoked'
                : err.code === 'ACCOUNT_SUSPENDED'
                ? 'suspended'
                : 'expired',
            message: err.message,
          })
          logout()
        }
      })
    return () => controller.abort()
  }, [auth.token, logout])

  /**
   * Asks the server, on a timer and whenever the tab comes back to the front,
   * whether this session still stands.
   *
   * Without this, a tab that nobody touches never finds out. Sign-out used to
   * ride on whatever request the user's next click happened to make, so a tab
   * left open across a forced-logout release sat there looking signed in — and
   * the mid-meeting case is worse, because the facilitator is not clicking
   * anything. apiFetch turns the refusal into a sign-out; this makes sure the
   * question gets asked.
   */
  useEffect(() => {
    if (!auth.token) return

    let last = Date.now()
    const ping = () => {
      last = Date.now()
      // Errors are deliberately swallowed: a 401 has already been broadcast by
      // apiFetch, and anything else means the network, not the session.
      void apiFetch('/api/auth/me').catch(() => {})
    }

    const id = setInterval(() => {
      if (document.visibilityState === 'visible') ping()
    }, HEARTBEAT_MS)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - last < HEARTBEAT_MS) return
      ping()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [auth.token])

  const refreshSubscription = useCallback(async () => {
    if (!auth.token) return
    try {
      const fresh = await apiFetch<SubscriptionView>('/api/billing/subscription')
      setSubscription(fresh)
      writeCache('subscription', fresh, auth.user?.id)
    } catch {
      // A plan we cannot read must not block the app — features fall back to
      // whatever the server enforces on the next call anyway.
    }
  }, [auth.token, auth.user?.id])

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
