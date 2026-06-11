import { useState } from 'react'
import { COLORS } from '../tokens/colors'

export type CardStatus = 'active' | 'answered'

export interface SuggestionCard {
  id: string
  question: string
  reason: string
  status: CardStatus
  type?: 'suggestion' | 'drift'
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
  const isDrift = card.type === 'drift'

  return (
    <div style={{
      ...styles.card,
      borderLeft: `3px solid ${isDrift ? COLORS.amber : COLORS.accent}`,
      background: isDrift ? COLORS.amberSubtle : COLORS.surface,
    }}>
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
  },
  card: {
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
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