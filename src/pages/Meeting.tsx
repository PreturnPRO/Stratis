// S1-T03-D: wires AI pipeline to BlockRenderer.
// E2E: user types → POST /api/ai/structure → validated blocks → BlockRenderer
// QuestionSuggestion blocks → SuggestionCardStack.
// S1-T04-C will replace manual input with live STT chunks (stub is here).

import { useEffect, useRef, useState, useCallback } from 'react'
import { COLORS, MEETING_MESSAGES } from '../constants'
import { btnAccent, Avatar } from '../components/ui'
import { LoadingState } from '../components/states'
import { SuggestionCardStack, type SuggestionCard } from '../components/SuggestionCardStack'
import BlockRenderer from '../components/BlockRenderer'
import { useAiBlocks } from '../hooks/useAiBlocks'
import { useMediaRecorder } from '../hooks/useMediaRecorder'
import { useAuth } from '../context/AuthContext'
import type { AIBlock } from '../../shared/types'

function blockToCard(block: AIBlock): SuggestionCard {
  return {
    id: `qs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    question: block.title,
    reason: block.content,
    status: 'active',
    type: 'suggestion',
  }
}

const MOCK_SUMMARY = [
  { time: '00:00–01:48', speaker: 'Sarah K.', color: '#c0392b', note: 'Q2 revenue missed by 12%. Root cause: enterprise pricing misaligned with value delivery. 8 of 12 churned customers cited pricing as top-3 reason.' },
  { time: '02:05–03:38', speaker: 'Mike R. + Alex T.', color: '#2e86c1', note: 'Option A (seat-based) feels safest. Option B (usage-based) flagged by AI with 78% confidence. Intercom 2022 saw 23% uplift on same switch.' },
  { time: '04:00–04:21', speaker: 'Sarah K. + Mike R.', color: '#c0392b', note: 'Key assumption: SMB segment accepts metered billing — unvalidated. Engineering capacity risk flagged.' },
]

export default function Meeting() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { token } = useAuth()

  const [isLoading, setIsLoading]           = useState(true)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [blocksOpen, setBlocksOpen]         = useState(false)
  const [cards, setCards]                   = useState<SuggestionCard[]>([])
  const [inputText, setInputText]           = useState('')

  const ai = useAiBlocks()

  const { status: micStatus, error: micError, start: startMic, stop: stopMic } =
    useMediaRecorder({
      chunkIntervalMs: 3000,
      onChunk: (chunk) => {
        // S1-T04-C: convert blob → STT text → ai.send(transcript, token ?? undefined)
        console.log('[mic] chunk received', chunk.size, 'bytes')
      },
    })

  // Push incoming QuestionSuggestion blocks to card stack (newest on top)
  useEffect(() => {
    if (ai.suggestions.length === 0) return
    const newCards = ai.suggestions.map(blockToCard)
    setCards((prev: SuggestionCard[]) => [...newCards, ...prev])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai.suggestions.length])

  useEffect(() => {
    if (!isLoading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isLoading])

  const markAnswered = (id: string) =>
    setCards((prev: SuggestionCard[]) =>
      prev.map((c: SuggestionCard) => c.id === id ? { ...c, status: 'answered' as const } : c)
    )

  const markActive = (id: string) =>
    setCards((prev: SuggestionCard[]) =>
      prev.map((c: SuggestionCard) => c.id === id ? { ...c, status: 'active' as const } : c)
    )

  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if (!text || ai.status === 'loading') return
    setInputText('')
    await ai.send(text, token ?? undefined)
    if (!blocksOpen) setBlocksOpen(true)
  }, [inputText, ai, token, blocksOpen])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

      {/* Transcript column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* Header */}
        <div style={{ padding: '12px 32px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: COLORS.textMuted }}>
              <span style={{ fontSize: 12 }}>⊞</span> Strategy map
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.red }} />
              <span style={{ color: COLORS.red, fontSize: 13, fontFamily: 'monospace' }}>04:85</span>
              <button
                onClick={micStatus === 'recording' ? stopMic : startMic}
                style={{
                  background: micStatus === 'recording' ? COLORS.redBg : 'transparent',
                  border: `1px solid ${micStatus === 'recording' ? COLORS.red : COLORS.border}`,
                  borderRadius: 4, color: micStatus === 'recording' ? COLORS.red : COLORS.textMuted,
                  fontSize: 11, padding: '3px 10px', cursor: 'pointer',
                }}
              >
                {micStatus === 'requesting' ? 'requesting…' : micStatus === 'recording' ? '⏹ stop mic' : micStatus === 'error' ? '⚠ mic error' : '⏺ start mic'}
              </button>
              {micError && <span style={{ fontSize: 11, color: COLORS.red }}>{micError}</span>}
            </div>
          </div>
          <button
            onClick={() => setBlocksOpen((o: boolean) => !o)}
            style={{ background: blocksOpen ? COLORS.surfaceHover : 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 4, color: COLORS.textMuted, fontSize: 11, padding: '3px 10px', cursor: 'pointer' }}
          >
            {blocksOpen ? 'hide blocks' : 'blocks'}
            {ai.blocks.length > 0 && (
              <span style={{ marginLeft: 5, background: COLORS.accent, color: COLORS.bg, borderRadius: 10, fontSize: 10, padding: '1px 5px', fontWeight: 600 }}>
                {ai.blocks.length}
              </span>
            )}
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
          {isLoading ? (
            <LoadingState count={4} delayMs={2000} onDone={() => setIsLoading(false)} />
          ) : (
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.4s ease forwards' }}>
              {MEETING_MESSAGES.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 14 }}>
                  <Avatar initials={m.initials} color={m.color} />
                  <div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                      <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 500 }}>{m.user}</span>
                      <span style={{ color: COLORS.textDim, fontSize: 12, fontFamily: 'monospace' }}>{m.time}</span>
                    </div>
                    <p style={{ color: COLORS.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }`}</style>
        </div>

        {/* AI input panel — manual for T03-D, replaced by STT in T04-C */}
        {!isLoading && (
          <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: '10px 32px 12px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: COLORS.textDim, letterSpacing: 0.5 }}>
              AI PIPELINE — type transcript text, press Enter or Send
              {ai.provider && <span style={{ marginLeft: 8, color: COLORS.accent }}>via {ai.provider}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                rows={2}
                value={inputText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste or type a transcript chunk to test the AI pipeline…"
                style={{
                  flex: 1, background: COLORS.surface,
                  border: `1px solid ${ai.status === 'error' || ai.status === 'timeout' ? COLORS.red : COLORS.border}`,
                  borderRadius: 6, padding: '8px 10px', fontSize: 13, color: COLORS.text,
                  resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                }}
              />
              <button
                onClick={() => void handleSend()}
                disabled={!inputText.trim() || ai.status === 'loading'}
                style={{ ...btnAccent(), fontSize: 12, padding: '8px 14px', opacity: (!inputText.trim() || ai.status === 'loading') ? 0.4 : 1, cursor: (!inputText.trim() || ai.status === 'loading') ? 'not-allowed' : 'pointer' }}
              >
                {ai.status === 'loading' ? 'Thinking…' : 'Send'}
              </button>
              {ai.blocks.length > 0 && (
                <button onClick={ai.reset} style={{ background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12, color: COLORS.textMuted, padding: '8px 10px', cursor: 'pointer' }}>
                  Clear
                </button>
              )}
            </div>
            {(ai.status === 'error' || ai.status === 'timeout') && ai.error && (
              <div style={{ fontSize: 12, color: COLORS.red }}>{ai.error}</div>
            )}
          </div>
        )}
      </div>

      {/* Blocks panel */}
      {blocksOpen && (
        <div style={{ width: 300, borderLeft: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, alignSelf: 'stretch' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: COLORS.textMuted, letterSpacing: 0.5 }}>BLOCKS</span>
            {ai.status === 'loading' && <span style={{ fontSize: 11, color: COLORS.accent }}>● thinking…</span>}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            <BlockRenderer nodes={ai.blocks} />
          </div>
        </div>
      )}

      {/* Right sidebar */}
      <div style={{ width: 220, borderLeft: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, alignSelf: 'stretch', position: 'relative' }}>
        <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 24, overflow: 'auto' }}>
          {!isLoading && (
            <button
              onClick={() => setTranscriptOpen((o: boolean) => !o)}
              style={{ background: transcriptOpen ? COLORS.tealBg : 'transparent', border: `1px solid ${transcriptOpen ? COLORS.teal : COLORS.border}`, borderRadius: 4, color: transcriptOpen ? COLORS.teal : COLORS.textMuted, fontSize: 11, padding: '3px 10px', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              {transcriptOpen ? 'hide notes' : 'AI notes'}
            </button>
          )}
          <div>
            <div style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1, marginBottom: 12 }}>PARTICIPANTS</div>
            {[
              { name: 'Sarah K.', color: '#c0392b', initials: 'SK' },
              { name: 'Mike R.',  color: '#2e86c1', initials: 'MR' },
              { name: 'Alex T.',  color: '#1a7a4a', initials: 'AT' },
            ].map((p) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Avatar initials={p.initials} color={p.color} size={26} />
                <span style={{ fontSize: 13, color: COLORS.text }}>{p.name}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1, marginBottom: 12 }}>CAPTURED</div>
            {[
              { type: 'DECISION', label: 'Restructure pricing tiers', color: COLORS.red },
              { type: 'RISK',     label: 'Engineering capacity',      color: COLORS.red },
              { type: 'SIGNAL',   label: 'Pure usage-based',          color: COLORS.teal },
            ].map((c) => (
              <div key={c.label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
                  <span style={{ fontSize: 10, color: c.color, fontWeight: 600, letterSpacing: 0.5 }}>{c.type}</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, paddingLeft: 12 }}>{c.label}</div>
              </div>
            ))}
          </div>
          <button style={{ ...btnAccent(), background: COLORS.red, borderColor: COLORS.red, marginTop: 'auto', fontSize: 12 }}>
            ⹎ End &amp; summarise
          </button>
        </div>

        {/* AI notes overlay */}
        {transcriptOpen && (
          <div style={{ position: 'absolute', inset: 0, background: COLORS.bg, display: 'flex', flexDirection: 'column', zIndex: 10, animation: 'fadeIn 0.2s ease forwards' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: COLORS.teal, letterSpacing: 0.5 }}>AI NOTES</span>
              <button onClick={() => setTranscriptOpen(false)} style={{ background: 'transparent', border: 'none', color: COLORS.textMuted, fontSize: 11, cursor: 'pointer', padding: 0 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {MOCK_SUMMARY.map((entry, i) => (
                <div key={i} style={{ borderLeft: `2px solid ${entry.color}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 3, fontFamily: 'monospace' }}>{entry.time}</div>
                  <div style={{ fontSize: 11, color: entry.color, fontWeight: 600, marginBottom: 4 }}>{entry.speaker}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>{entry.note}</div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: COLORS.textDim, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12, fontStyle: 'italic' }}>
                AI summary updates in real-time as the meeting progresses.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestion card stack — receives live QuestionSuggestion blocks */}
      {!isLoading && (
        <SuggestionCardStack cards={cards} onMarkAnswered={markAnswered} onMarkActive={markActive} />
      )}
    </div>
  )
}