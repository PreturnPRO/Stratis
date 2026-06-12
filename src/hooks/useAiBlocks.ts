import { useState, useCallback } from 'react'
import type { AIBlock } from '../../shared/types'

export type AiBlocksStatus = 'idle' | 'loading' | 'ok' | 'error' | 'timeout'

export interface UseAiBlocksReturn {
  status: AiBlocksStatus
  blocks: AIBlock[]
  suggestions: AIBlock[]
  error: string | null
  provider: string | null
  send: (input: string, token?: string) => Promise<void>
  reset: () => void
}

const API_BASE = 'http://localhost:3001'
const TIMEOUT_MS = 10_000

export function useAiBlocks(): UseAiBlocksReturn {
  const [status, setStatus]           = useState<AiBlocksStatus>('idle')
  const [blocks, setBlocks]           = useState<AIBlock[]>([])
  const [suggestions, setSuggestions] = useState<AIBlock[]>([])
  const [error, setError]             = useState<string | null>(null)
  const [provider, setProvider]       = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setBlocks([])
    setSuggestions([])
    setError(null)
    setProvider(null)
  }, [])

  const send = useCallback(async (input: string, token?: string) => {
    if (!input.trim()) return
    setStatus('loading')
    setError(null)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${API_BASE}/api/ai/structure`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ input }),
        signal: controller.signal,
      })

      const data = await res.json() as {
        ok: boolean
        error?: string
        data?: { provider: string; blocks: AIBlock[] }
      }

      if (!data.ok) {
        setError(data.error ?? 'AI call failed')
        setStatus('error')
        return
      }

      const allBlocks: AIBlock[] = data.data?.blocks ?? []
      setProvider(data.data?.provider ?? null)

      const renderBlocks = allBlocks.filter(b => b.type !== 'QuestionSuggestion')
      const suggBlocks   = allBlocks.filter(b => b.type === 'QuestionSuggestion')

      setBlocks((prev: AIBlock[]) => [...prev, ...renderBlocks])
      setSuggestions((prev: AIBlock[]) => [...prev, ...suggBlocks])
      setStatus('ok')

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setError('AI took too long — try again')
        setStatus('timeout')
      } else {
        setError((err as Error).message ?? 'Network error')
        setStatus('error')
      }
    } finally {
      clearTimeout(timer)
    }
  }, [])

  return { status, blocks, suggestions, error, provider, send, reset }
}