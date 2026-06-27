import { useState } from 'react'
import { COLORS } from '../tokens/colors'
import type { LiveCardType, LiveCardUrgency } from '../../shared/types'

export type CardStatus = 'active' | 'answered'

export interface SuggestionCard {
  id: string
  question: string
  reason: string
  status: CardStatus
  cardType?: LiveCardType
  urgency?: LiveCardUrgency
}

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
  onMarkAnswered: (id: string) => void
  onMarkActive: (id: string) => void
}

export function SuggestionCardStack({ cards, onMarkAnswered, onMarkActive }: Props) {
  const [answeredOpen, setAnsweredOpen] = useState(false)

  const active = cards.filter(c => c.status === 'active')
  const answered = cards.filter(c => c.status === 'answered')

  return (
    <div style={styles.stack}>
       <style>{SLIDE_UP_STYLE}</style>
      {active.map(card => (
        <ActiveCard
          key={card.id}
          card={card}
          onMarkAnswered={() => onMarkAnswered(card.id)}
        />
      ))}

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

  return (
    <div style={{
      ...styles.card,
      borderLeft: `3px solid ${accent}`,
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

const SLIDE_UP_STYLE = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`

const styles: Record<string, React.CSSProperties> = {
  stack: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 100,
    animation: 'slideUp 0.3s ease forwards',
  },
  card: {
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    border: `1px solid ${COLORS.border}`,
    boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
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
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  urgency: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    padding: '2px 7px',
    borderRadius: 999,
  },
  question: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: COLORS.textPrimary,
    lineHeight: 1.4,
  },
  reason: {
    margin: 0,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 1.4,
  },
  answerBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
    padding: '4px 10px',
    fontSize: 11,
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
    fontSize: 12,
    fontWeight: 500,
    color: COLORS.textMuted,
  },
  chevron: {
    fontSize: 12,
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
    fontSize: 12,
    color: COLORS.textMuted,
    textDecoration: 'line-through',
  },
}