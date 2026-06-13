// S1-T03-E — facilitator suggestion card stack.
//
// - Loads the current stack via GET /suggest/:sessionId (REST, requires auth).
// - Connects to ws://.../ws?token=...&sessionId=... for live updates:
//     "suggestion:new"      → new card, pushed to top
//     "suggestion:answered" → auto-detect (or another client's manual tap)
//                              struck the card through
// - markAnswered() is the manual override — calls POST /suggest/answer,
//   which both updates the store and broadcasts "suggestion:answered" back
//   to every connected facilitator socket (including this one).
// - markActive() is a local-only "re-open for review" — there's no server
//   concept of un-answering a card yet (S2 can revisit if needed).
//
// Per hub.ts: only a session's facilitator is subscribed to suggestion
// events. Other roles can still call this hook (e.g. to read `connected`),
// they simply won't receive "suggestion:new"/"suggestion:answered".

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import type { SuggestionCard as ServerCard, WsServerEvent } from '../../shared/types'
import type { SuggestionCard as UICard } from '../components/SuggestionCardStack'

const API_BASE = 'http://localhost:3001'
const WS_BASE = 'ws://localhost:3001'

function isRealSessionId(sessionId: string | null | undefined): sessionId is string {
  if (!sessionId) return false

  const clean = sessionId.trim()

  if (!clean) return false
  if (clean === 'no-session') return false
  if (clean === 'pending') return false
  if (clean === 'undefined') return false
  if (clean === 'null') return false

  return true
}

function toUICard(card: ServerCard): UICard {
  return {
    id: card.id,
    question: card.question,
    reason: card.reason,
    status: card.answered ? 'answered' : 'active',
  }
}

export interface UseSuggestionSocketReturn {
  cards: UICard[]
  role: 'facilitator' | 'participant' | 'admin' | null
  connected: boolean
  markAnswered: (id: string) => void
  markActive: (id: string) => void
}

export function useSuggestionSocket(sessionId: string | null | undefined): UseSuggestionSocketReturn {
  const { token } = useAuth()
  const [cards, setCards] = useState<UICard[]>([])
  const [connected, setConnected] = useState(false)
  const [role, setRole] = useState<UseSuggestionSocketReturn['role']>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const validSessionId = isRealSessionId(sessionId) ? sessionId.trim() : null

  // If the page has no real session yet, reset socket state and do nothing.
  useEffect(() => {
    if (validSessionId) return

    setCards([])
    setConnected(false)
    setRole(null)

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [validSessionId])

  // Initial load — current stack, newest first, via REST.
  useEffect(() => {
    if (!token || !validSessionId) return

    let cancelled = false

    fetch(`${API_BASE}/api/ai/suggest/${validSessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: { ok: boolean; data?: { cards: ServerCard[] } }) => {
        if (cancelled || !data.ok || !data.data) return
        setCards(data.data.cards.map(toUICard))
      })
      .catch(() => {
        // Non-fatal — live socket will still populate new cards.
      })

    return () => {
      cancelled = true
    }
  }, [validSessionId, token])

  // Live updates over /ws.
  useEffect(() => {
    if (!token || !validSessionId) return

    const url = `${WS_BASE}/ws?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(validSessionId)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onclose = () => {
      setConnected(false)

      if (wsRef.current === ws) {
        wsRef.current = null
      }
    }

    ws.onerror = () => {
      setConnected(false)
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: WsServerEvent

      try {
        msg = JSON.parse(event.data) as WsServerEvent
      } catch {
        return
      }

      switch (msg.type) {
        case 'connected':
          setRole(msg.role)
          break

        case 'suggestion:new':
          setCards((prev: UICard[]) => [toUICard(msg.card), ...prev])
          break

        case 'suggestion:answered':
          setCards((prev: UICard[]) =>
            prev.map((c) =>
              c.id === msg.cardId ? { ...c, status: 'answered' as const } : c
            )
          )
          break
      }
    }

    return () => {
      ws.close()
      if (wsRef.current === ws) {
        wsRef.current = null
      }
    }
  }, [validSessionId, token])

  const markAnswered = useCallback(
    (id: string) => {
      if (!token || !validSessionId) return

      fetch(`${API_BASE}/api/ai/suggest/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: validSessionId,
          cardId: id,
        }),
      }).catch(() => {
        // Non-fatal.
      })

      setCards((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: 'answered' as const } : c
        )
      )
    },
    [token, validSessionId]
  )

  const markActive = useCallback((id: string) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'active' as const } : c
      )
    )
  }, [])

  return {
    cards,
    role,
    connected,
    markAnswered,
    markActive,
  }
}