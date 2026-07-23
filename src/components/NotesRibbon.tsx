import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { COLORS, FONT, LETTER_SPACING } from '../tokens/colors'

interface Props {
  /** Rolling AI notes text — the collapsed preview and default expanded body. */
  text: string
  /** Rendered when there is no rolling text but structured AI blocks exist. */
  fallback?: React.ReactNode
}

// Full-width ambient strip under the time bar. The notes are context, not the
// work surface — two clamped lines when collapsed, nothing at all when empty,
// so the suggestion stack keeps every pixel of the gutter.
export function NotesRibbon({ text, fallback }: Props) {
  const [open, setOpen] = useState(false)

  const hasText = text.trim().length > 0
  if (!hasText && !fallback) return null

  return (
    <div style={styles.ribbon}>
      <button
        type="button"
        style={styles.bar}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={open ? 'Collapse meeting notes' : 'Expand meeting notes'}
      >
        <span style={styles.label}>AI notes</span>
        {!open && (
          <span style={styles.preview} aria-live="polite">
            {hasText ? text : 'Meeting notes available'}
          </span>
        )}
        <ChevronDown
          size={15}
          strokeWidth={2.5}
          style={{
            ...styles.chevron,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div style={styles.body} aria-live="polite">
          {hasText ? <p style={styles.bodyText}>{text}</p> : fallback}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  ribbon: {
    background: COLORS.surfaceMuted,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  bar: {
    width: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 24px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  label: {
    flexShrink: 0,
    paddingTop: 2,
    fontSize: FONT.size.micro,
    fontWeight: 700,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: 'uppercase',
    color: COLORS.accent,
  },
  preview: {
    flex: 1,
    minWidth: 0,
    fontSize: FONT.size.label,
    color: COLORS.textMuted,
    lineHeight: 1.55,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  chevron: {
    flexShrink: 0,
    marginTop: 2,
    marginLeft: 'auto',
    color: COLORS.textDim,
    transition: 'transform 0.15s ease',
  },
  body: {
    maxHeight: 200,
    overflowY: 'auto',
    padding: '0 24px 12px',
  },
  bodyText: {
    margin: 0,
    fontSize: FONT.size.body,
    color: COLORS.textPrimary,
    lineHeight: 1.6,
  },
}
