import { useCallback, useEffect, useState } from 'react'

const API_BASE = 'http://localhost:3001'
const STORAGE_KEY = 'stratis.activeSessionId.v1'

export type SessionRecoveryStatus =
  | 'idle'
  | 'loading'
  | 'recovered'
  | 'none'
  | 'error'

interface RecoverySession {
  id: string
  meeting_id: string
  facilitator_id: string
  status: 'created' | 'active' | 'ended'
  started_at: string | null
  ended_at: string | null
  created_at: string
  org_id?: string
  project_id?: string
  meeting_title?: string
}

interface RecoverResponse {
  ok: boolean
  error?: string
  data?: {
    recovered: boolean
    session: RecoverySession | null
    reason?: string
  }
}

export function useSessionRecovery({ token }: { token: string | null }) {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    return window.localStorage.getItem(STORAGE_KEY)
  })
  const [session, setSession] = useState<RecoverySession | null>(null)
  const [status, setStatus] = useState<SessionRecoveryStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const rememberSession = useCallback((id: string) => {
    setSessionId(id)
    window.localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const clearRecoveredSession = useCallback(() => {
    setSessionId(null)
    setSession(null)
    window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  const recover = useCallback(async () => {
    if (!token) {
      setStatus('none')
      return
    }

    setStatus('loading')
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/session/recover`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = (await res.json()) as RecoverResponse

      if (!data.ok) {
        setError(data.error ?? 'Session recovery failed')
        setStatus('error')
        return
      }

      if (!data.data?.recovered || !data.data.session) {
        clearRecoveredSession()
        setStatus('none')
        return
      }

      setSession(data.data.session)
      rememberSession(data.data.session.id)
      setStatus('recovered')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session recovery failed')
      setStatus('error')
    }
  }, [token, rememberSession, clearRecoveredSession])

  useEffect(() => {
    void recover()
  }, [recover])

  return {
    sessionId,
    session,
    status,
    error,
    recover,
    rememberSession,
    clearRecoveredSession,
  }
}