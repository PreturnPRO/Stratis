import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/http'

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
  duration_minutes?: number | null
}

interface RecoverPayload {
  recovered: boolean
  session: RecoverySession | null
  reason?: string
  /** The server's clock when it answered. See `serverSkewMs`. */
  serverNow?: string
}

export function useSessionRecovery({ token }: { token: string | null }) {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    return window.localStorage.getItem(STORAGE_KEY)
  })
  const [session, setSession] = useState<RecoverySession | null>(null)
  const [status, setStatus] = useState<SessionRecoveryStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  /**
   * The server's clock minus this browser's, in milliseconds.
   *
   * The meeting timer counts from the session's own `started_at`, which is a
   * server timestamp — so a laptop set five minutes fast would otherwise show
   * five minutes of meeting that never happened, and disagree with the minutes
   * being deducted. Zero until recovery answers, which is the right default:
   * no correction rather than a guessed one.
   */
  const [serverSkewMs, setServerSkewMs] = useState(0)

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
      const data = await apiFetch<RecoverPayload>('/api/session/recover')

      if (!data?.recovered || !data.session) {
        clearRecoveredSession()
        setStatus('none')
        return
      }

      setSession(data.session)
      if (data.serverNow) {
        const server = new Date(data.serverNow).getTime()
        if (Number.isFinite(server)) setServerSkewMs(server - Date.now())
      }
      rememberSession(data.session.id)
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
    serverSkewMs,
    recover,
    rememberSession,
    clearRecoveredSession,
  }
}