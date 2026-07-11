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

import { API_BASE, WS_BASE } from '../lib/api'

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
    cardType: card.cardType,
    urgency: card.urgency,
    createdAt: card.createdAt ?? new Date().toISOString(),
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
  const { token } = useAuth();
  const [cards, setCards] = useState<UICard[]>([]);
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState<UseSuggestionSocketReturn['role']>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validSessionId = isRealSessionId(sessionId) ? sessionId.trim() : null;

  // 1. Reset state instantly if transitioning away from an active session
  useEffect(() => {
    if (!validSessionId) {
      setCards([]);
      setConnected(false);
      setRole(null);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }
  }, [validSessionId]);

  // 2. Fetch the current card stack over REST (used for initialization and gap recovery) [1]
  const fetchCards = useCallback(async () => {
    if (!token || !validSessionId) return;
    try {
      const res = await fetch(`${API_BASE}/api/ai/suggest/${validSessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const serverCards: ServerCard[] = data.data.cards ?? [];
        setCards(serverCards.map(toUICard));
      }
    } catch (err) {
      console.error('[ws:rest] Failed to sync suggestion stack:', err);
    }
  }, [validSessionId, token]);

  // 3. Manual override to resolve a card (updates optimistically, then sinks with server) [1]
  const markAnswered = useCallback(async (id: string) => {
    if (!token || !validSessionId) return;

    // Optimistic UI state toggle
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'answered' as const } : c))
    );

    try {
      const res = await fetch(`${API_BASE}/api/ai/suggest/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: validSessionId, cardId: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        console.warn('[ws:manual] Answer sync rejected by server, rolling back state:', data.error);
        void fetchCards();
      }
    } catch (err) {
      console.error('[ws:manual] Error marking card answered:', err);
      void fetchCards();
    }
  }, [validSessionId, token, fetchCards]);

  // 4. Local-only active state toggle (re-opening cards for review) [1]
  const markActive = useCallback((id: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'active' as const } : c))
    );
  }, []);

  // 5. Secure, auto-reconnecting WebSocket subscription pipeline
  useEffect(() => {
    if (!token || !validSessionId) return;

    let isCleanup = false;

    const connect = () => {
      if (isCleanup) return;

      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }

      // SECURE HANDSHAKE: Strip token from URL parameter, pass inside subprotocols array [1]
      const url = `${WS_BASE}/ws?sessionId=${encodeURIComponent(validSessionId)}`;
      const socket = new WebSocket(url, token ? [token] : []);
      wsRef.current = socket;

      socket.onopen = () => {
        if (isCleanup) {
          socket.close();
          return;
        }
        console.log('[ws] Real-time suggestion stream connected securely.');
        setConnected(true);
        // Force sync REST stack on connection to fetch any suggestions generated while offline [1]
        void fetchCards();
      };

      socket.onmessage = (event) => {
        if (isCleanup) return;
        try {
          const payload: WsServerEvent = JSON.parse(event.data);
          switch (payload.type) {
            case 'connected':
              setRole(payload.role);
              break;
            case 'suggestion:new':
              setCards((prev) => {
                if (prev.some((c) => c.id === payload.card.id)) return prev;
                return [toUICard(payload.card), ...prev];
              });
              break;
            case 'suggestion:answered':
              setCards((prev) =>
                prev.map((c) =>
                  c.id === payload.cardId ? { ...c, status: 'answered' as const } : c
                )
              );
              break;
            default:
              break;
          }
        } catch (err) {
          console.error('[ws] Failed to decode incoming WebSocket frame:', err);
        }
      };

      socket.onclose = (event) => {
        if (isCleanup) return;
        setConnected(false);
        console.warn(`[ws] Suggestion stream closed: ${event.code} ${event.reason}. Reconnecting in 3s...`);
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      socket.onerror = () => {
        if (isCleanup) return;
        socket.close();
      };
    };

    connect();

    return () => {
      isCleanup = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [validSessionId, token, fetchCards]);

  return {
    cards,
    role,
    connected,
    markAnswered,
    markActive,
  };
}