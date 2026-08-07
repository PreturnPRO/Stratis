
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import type {
  SuggestionCard as ServerCard,
  WsClientEvent,
  WsServerEvent,
  WsTranscriptRow,
} from '../../shared/types'
import type { SuggestionCard as UICard } from '../components/SuggestionCardStack'

import { WS_BASE } from '../lib/api'
import { announceSessionEnded, apiFetch } from '../lib/http'

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

export interface SuggestionSocketHandlers {
  onSttInterim?: (text: string) => void
  onTranscriptFinal?: (row: WsTranscriptRow) => void
  onSttError?: (message: string) => void
  onNotesUpdate?: (text: string) => void
}

export interface UseSuggestionSocketReturn {
  cards: UICard[]
  role: 'facilitator' | 'participant' | 'admin' | null
  connected: boolean
  markAnswered: (id: string) => void
  markActive: (id: string) => void
  dismissCard: (id: string) => void
  sendControl: (msg: WsClientEvent) => boolean
  sendAudioFrame: (frame: ArrayBuffer) => boolean
}

export function useSuggestionSocket(
  sessionId: string | null | undefined,
  handlers?: SuggestionSocketHandlers,
): UseSuggestionSocketReturn {
  const { token } = useAuth();
  const [cards, setCards] = useState<UICard[]>([]);
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState<UseSuggestionSocketReturn['role']>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlersRef = useRef<SuggestionSocketHandlers | undefined>(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const validSessionId = isRealSessionId(sessionId) ? sessionId.trim() : null;

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

  const fetchCards = useCallback(async () => {
    if (!token || !validSessionId) return;
    try {
      const data = await apiFetch<{ cards?: ServerCard[] }>(`/api/ai/suggest/${validSessionId}`);
      setCards((data.cards ?? []).map(toUICard));
    } catch (err) {
      console.error('[ws:rest] Failed to sync suggestion stack:', err);
    }
  }, [validSessionId, token]);

  const markAnswered = useCallback(async (id: string) => {
    if (!token || !validSessionId) return;

    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'answered' as const } : c))
    );

    try {
      await apiFetch('/api/ai/suggest/answer', {
        method: 'POST',
        body: { sessionId: validSessionId, cardId: id },
      });
    } catch (err) {
      console.warn('[ws:manual] Answer sync rejected, rolling back state:', err);
      void fetchCards();
    }
  }, [validSessionId, token, fetchCards]);

  // Wrong card, not an answered one. Marking it answered would record that the
  // room resolved something it never discussed.
  const dismissCard = useCallback(async (id: string) => {
    if (!token || !validSessionId) return;

    setCards((prev) => prev.filter((c) => c.id !== id));

    try {
      await apiFetch('/api/ai/suggest/dismiss', {
        method: 'POST',
        body: { sessionId: validSessionId, cardId: id },
      });
    } catch (err) {
      console.warn('[ws:manual] Dismiss rejected, rolling back state:', err);
      void fetchCards();
    }
  }, [validSessionId, token, fetchCards]);

  const markActive = useCallback((id: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'active' as const } : c))
    );
  }, []);

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
            case 'stt:interim':
              handlersRef.current?.onSttInterim?.(payload.text);
              break;
            case 'transcript:final':
              handlersRef.current?.onTranscriptFinal?.(payload.transcript);
              break;
            case 'stt:error':
              handlersRef.current?.onSttError?.(payload.message);
              break;
            case 'notes:update':
              handlersRef.current?.onNotesUpdate?.(payload.text);
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

        // The hub closes with these when the token no longer stands up: the
        // account was revoked or a release drew a logout line under this
        // session. Reconnecting would loop forever against an answer that is
        // not going to change, so end the session instead.
        if (event.code === 4401 || event.code === 4403) {
          announceSessionEnded({
            reason: event.code === 4403 ? 'revoked' : 'updated',
            message: event.reason || 'Your session has ended — please sign in again',
          });
          return;
        }

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

  const sendControl = useCallback((msg: WsClientEvent): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  const sendAudioFrame = useCallback((frame: ArrayBuffer): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(frame);
    return true;
  }, []);

  return {
    cards,
    role,
    connected,
    markAnswered,
    markActive,
    dismissCard,
    sendControl,
    sendAudioFrame,
  };
}
