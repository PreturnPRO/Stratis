import { useEffect, useRef, useState } from 'react'
import { COLORS, FONT, LETTER_SPACING, SHADOW, GLASS } from '../tokens/colors'
import type { LiveCardType, LiveCardUrgency } from '../../shared/types'

export type CardStatus = 'active' | 'answered'

export interface SuggestionCard {
  id: string
  question: string
  reason: string
  status: CardStatus
  cardType?: LiveCardType
  urgency?: LiveCardUrgency
  createdAt: string
}

// Cards older than this read as "aging" — urgency pill dims slightly as an
// informational cue. Nothing is ever auto-removed (augment, never interrupt).
const STALE_MS = 90_000

// Card-type accent + label (schema spec §6.2). Colors pulled from the theme.
const TYPE_META: Record<LiveCardType, { color: string; label: string }> = {
  QUESTION_SUGGESTION: { color: COLORS.accent, label: 'Question' },
  DRIFT_ALERT: { color: COLORS.orange, label: 'Drift' },
  MISSING_DECISION: { color: COLORS.cyan, label: 'Missing decision' },
  UNRESOLVED_ASSUMPTION: { color: COLORS.teal, label: 'Assumption' },
}

const URGENCY_COLOR: Record<LiveCardUrgency, string> = {
  LOW: COLORS.textMuted,
  MEDIUM: COLORS.amber,
  HIGH: COLORS.red,
}

interface Props {
  cards: SuggestionCard[]
  thinking?: boolean
  onMarkAnswered: (id: string) => void
  onMarkActive: (id: string) => void
}

// Only this many active cards show expanded at once — the rest queue up
// behind a "+N more open" row so the stack can't grow into an obtrusive wall.
const VISIBLE_ACTIVE_CAP = 2

const URGENCY_RANK: Record<LiveCardUrgency, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

function isStale(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > STALE_MS
}

function formatAge(createdAt: string): string {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

export function SuggestionCardStack({ cards, thinking, onMarkAnswered, onMarkActive }: Props) {
  const [answeredOpen, setAnsweredOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  // Cards the facilitator explicitly opened from the queue jump the line,
  // regardless of urgency, so "bring this one forward" always works.
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())

  // "Thinking" can flip true/false rapidly (Web Speech fires per utterance) —
  // show immediately, but debounce hiding so rapid flips read as one
  // continuous "reviewing" state instead of the ghost card flickering.
  const [showThinking, setShowThinking] = useState(!!thinking)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (thinking) {
      clearTimeout(hideTimer.current)
      setShowThinking(true)
    } else {
      hideTimer.current = setTimeout(() => setShowThinking(false), 500)
    }
    return () => clearTimeout(hideTimer.current)
  }, [thinking])

  const active = cards.filter(c => c.status === 'active')
  const answered = cards.filter(c => c.status === 'answered')

  const orderedActive = [...active].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id) ? 0 : 1
    const bPinned = pinnedIds.has(b.id) ? 0 : 1
    if (aPinned !== bPinned) return aPinned - bPinned

    const aRank = a.urgency ? URGENCY_RANK[a.urgency] : 3
    const bRank = b.urgency ? URGENCY_RANK[b.urgency] : 3
    if (aRank !== bRank) return aRank - bRank

    // Same urgency — oldest first, so aging cards surface into the visible
    // slots instead of being perpetually buried behind newer arrivals.
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  const visibleActive = orderedActive.slice(0, VISIBLE_ACTIVE_CAP)
  const queuedActive = orderedActive.slice(VISIBLE_ACTIVE_CAP)

  const oldestQueuedAgeLabel = queuedActive.length > 0
    ? formatAge(queuedActive[0].createdAt)
    : null

  const promote = (id: string) => {
    setPinnedIds(prev => new Set(prev).add(id))
    setQueueOpen(false)
  }

  return (
    <div style={{
      ...styles.stack,
      ...(active.length > 0 ? styles.stackSignal : null),
    }}>
       <style>{SLIDE_UP_STYLE}</style>

      {showThinking && <ThinkingCard />}

      {visibleActive.map(card => (
        <ActiveCard
          key={card.id}
          card={card}
          onMarkAnswered={() => onMarkAnswered(card.id)}
        />
      ))}

      {queuedActive.length > 0 && (
        <div style={{
          ...styles.toggleGroup,
          ...(queuedActive.length > 3 ? styles.toggleGroupBacklog : null),
        }}>
          <button
            style={styles.toggleBtn}
            onClick={() => setQueueOpen(o => !o)}
            aria-expanded={queueOpen}
          >
            <span style={styles.toggleLabel}>
              {queuedActive.length > 3 && (
                <span style={{
                  ...styles.dot,
                  background: COLORS.accent,
                  marginRight: 6,
                  ...(queuedActive.length > 5 ? styles.backlogDotPulse : null),
                }} />
              )}
              {queuedActive.length} more open
              {oldestQueuedAgeLabel && ` · oldest ${oldestQueuedAgeLabel} ago`}
            </span>
            <span style={{
              ...styles.chevron,
              transform: queueOpen ? 'rotate(180deg)' : 'rotate(0deg)'
            }}>
              ▾
            </span>
          </button>

          {queueOpen && (
            <div style={styles.answeredList}>
              {queuedActive.map(card => (
                <QueuedRow
                  key={card.id}
                  card={card}
                  onOpen={() => promote(card.id)}
                  onMarkAnswered={() => onMarkAnswered(card.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {answered.length > 0 && (
        <div style={styles.toggleGroup}>
          <button
            style={styles.toggleBtn}
            onClick={() => setAnsweredOpen(o => !o)}
            aria-expanded={answeredOpen}
          >
            <span style={styles.toggleLabel}>
              {answered.length} answered
            </span>
            <span style={{
              ...styles.chevron,
              transform: answeredOpen ? 'rotate(180deg)' : 'rotate(0deg)'
            }}>
              ▾
            </span>
          </button>

          {answeredOpen && (
            <div style={styles.answeredList}>
              {answered.map(card => (
                <CollapsedCard
                  key={card.id}
                  card={card}
                  onReopen={() => onMarkActive(card.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ActiveCard({
  card,
  onMarkAnswered,
}: {
  card: SuggestionCard
  onMarkAnswered: () => void
}) {
  const meta = card.cardType ? TYPE_META[card.cardType] : null
  const accent = meta?.color ?? COLORS.accent
  const stale = isStale(card.createdAt)

  return (
    <div style={{
      ...styles.card,
      background: COLORS.surface,
    }}>
      {meta && (
        <div style={styles.tagRow}>
          <span style={styles.tag}>
            <span style={{ ...styles.dot, background: accent }} />
            <span style={{ ...styles.tagLabel, color: accent }}>{meta.label}</span>
          </span>
          {card.urgency && (
            <span
              style={{
                ...styles.urgency,
                color: URGENCY_COLOR[card.urgency],
                background: `${URGENCY_COLOR[card.urgency]}1f`,
                opacity: stale ? 0.7 : 1,
              }}
            >
              {card.urgency.toLowerCase()}
            </span>
          )}
        </div>
      )}
      <p style={styles.question}>{card.question}</p>
      <p style={styles.reason}>{card.reason}</p>
      <button style={styles.answerBtn} onClick={onMarkAnswered}>
        Mark answered
      </button>
    </div>
  )
}

function CollapsedCard({
  card,
  onReopen,
}: {
  card: SuggestionCard
  onReopen: () => void
}) {
  return (
    <button style={styles.collapsedRow} onClick={onReopen} title="Tap to re-open">
      <span style={styles.strikethrough}>{card.question}</span>
    </button>
  )
}

// A queued (still-active, not-yet-visible) card, collapsed to one line.
// Clicking the question brings it to the front; the check answers it in place.
function QueuedRow({
  card,
  onOpen,
  onMarkAnswered,
}: {
  card: SuggestionCard
  onOpen: () => void
  onMarkAnswered: () => void
}) {
  const meta = card.cardType ? TYPE_META[card.cardType] : null
  const accent = meta?.color ?? COLORS.accent
  const stale = isStale(card.createdAt)

  return (
    <div style={styles.queuedRow}>
      <button style={styles.queuedRowMain} onClick={onOpen} title="Bring to front">
        <span style={{ ...styles.dot, background: accent, flexShrink: 0, opacity: stale ? 0.6 : 1 }} />
        <span style={styles.queuedRowText}>{card.question}</span>
      </button>
      <button
        style={styles.queuedRowAnswer}
        onClick={(e) => {
          e.stopPropagation()
          onMarkAnswered()
        }}
        title="Mark answered"
        aria-label="Mark answered"
      >
        ✓
      </button>
    </div>
  )
}

// Ghost placeholder shown while a transcript chunk is being processed by the
// live AI — the same request that may produce a new suggestion card. Signals
// "thinking" without claiming a suggestion is coming.
function ThinkingCard() {
  return (
    <div style={styles.thinkingCard} role="status" aria-label="Reviewing the conversation">
      <span style={styles.thinkingDots}>
        <span style={{ ...styles.thinkingDot, animationDelay: '0ms' }} />
        <span style={{ ...styles.thinkingDot, animationDelay: '160ms' }} />
        <span style={{ ...styles.thinkingDot, animationDelay: '320ms' }} />
      </span>
      <span style={styles.thinkingLabel}>Reviewing the conversation…</span>
    </div>
  )
}

const SLIDE_UP_STYLE = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes thinkingPulse {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
    40%           { opacity: 1;   transform: scale(1); }
  }
`

const styles: Record<string, React.CSSProperties> = {
  // Sticky inside its reserved column (see Meeting.tsx's suggestion-gutter) —
  // pins near the top as the page scrolls, never overlaps Transcript/AI
  // notes the way a viewport-fixed overlay could.
  stack: {
    position: 'sticky',
    top: 0,
    width: '100%',
    maxHeight: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 10px 4px',
    borderRadius: 12,
    background: GLASS.bg,
    backdropFilter: GLASS.blur,
    WebkitBackdropFilter: GLASS.blur,
    boxShadow: SHADOW.float,
    animation: 'slideUp 0.3s ease forwards',
  },
  // Thin top wash marking this as the live signal zone — silent when there's
  // nothing active to flag, so it stays a signal rather than decoration.
  stackSignal: {
    backgroundImage: `linear-gradient(180deg, ${COLORS.accent}33, transparent 40px)`,
  },
  card: {
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    border: `1px solid ${COLORS.border}`,
    boxShadow: SHADOW.sm,
    animation: 'cardIn 0.22s ease',
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tag: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    display: 'inline-block',
  },
  tagLabel: {
    fontSize: FONT.size.micro,
    fontWeight: 700,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: 'uppercase',
  },
  urgency: {
    fontSize: FONT.size.micro,
    fontWeight: 700,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: 'uppercase',
    padding: '2px 7px',
    borderRadius: 999,
  },
  question: {
    margin: 0,
    fontSize: FONT.size.body,
    fontWeight: 600,
    color: COLORS.textPrimary,
    lineHeight: 1.4,
  },
  reason: {
    margin: 0,
    fontSize: FONT.size.label,
    color: COLORS.textMuted,
    lineHeight: 1.4,
  },
  answerBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
    padding: '4px 10px',
    fontSize: FONT.size.caption,
    fontWeight: 500,
    borderRadius: 6,
    border: `1px solid ${COLORS.accent}`,
    background: 'transparent',
    color: COLORS.accent,
    cursor: 'pointer',
  },
  toggleGroup: {
    borderRadius: 10,
    overflow: 'hidden',
    background: COLORS.surfaceMuted,
    border: `1px solid ${COLORS.border}`,
  },
  // Past a growing-backlog threshold, tint calmly — a cue, not an alarm.
  toggleGroupBacklog: {
    background: `${COLORS.accent}0d`,
    border: `1px solid ${COLORS.accent}33`,
  },
  toggleBtn: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  toggleLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: FONT.size.label,
    fontWeight: 500,
    color: COLORS.textMuted,
  },
  backlogDotPulse: {
    animation: 'pulse 1.6s ease-in-out infinite',
  },
  chevron: {
    fontSize: FONT.size.label,
    color: COLORS.textMuted,
    transition: 'transform 0.15s ease',
  },
  answeredList: {
    display: 'flex',
    flexDirection: 'column',
    borderTop: `1px solid ${COLORS.border}`,
  },
  collapsedRow: {
    width: '100%',
    padding: '7px 14px',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${COLORS.border}`,
    cursor: 'pointer',
    textAlign: 'left',
  },
  strikethrough: {
    fontSize: FONT.size.label,
    color: COLORS.textMuted,
    textDecoration: 'line-through',
  },
  queuedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  queuedRowMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 6px 7px 14px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  queuedRowText: {
    fontSize: FONT.size.label,
    color: COLORS.textMuted,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  queuedRowAnswer: {
    flexShrink: 0,
    width: 22,
    height: 22,
    marginRight: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: FONT.size.caption,
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
    background: 'transparent',
    color: COLORS.teal,
    cursor: 'pointer',
  },
  thinkingCard: {
    borderRadius: 12,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surfaceMuted,
    animation: 'cardIn 0.22s ease',
  },
  thinkingDots: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  thinkingDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: COLORS.accent,
    animation: 'thinkingPulse 1.1s ease-in-out infinite',
  },
  thinkingLabel: {
    fontSize: FONT.size.label,
    color: COLORS.textMuted,
  },
}