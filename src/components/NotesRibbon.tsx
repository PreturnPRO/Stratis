import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { FONT, LETTER_SPACING, tint } from '../tokens/colors'
import { useTheme } from '../hooks/useTheme'
import { Markdown } from './Markdown'

interface Props {
  /** Rolling AI notes text — markdown (## Intent / ## Key points / ## Open
   *  threads). Rendered as markdown when expanded; flattened to a plain snippet
   *  for the clamped collapsed preview. */
  text: string
  /** Rendered when there is no rolling text but structured AI blocks exist. */
  fallback?: React.ReactNode
}

// Flatten markdown to a one-line snippet for the 2-line clamped preview so the
// collapsed ribbon shows readable text, not raw "##"/"-" syntax.
function toPreview(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim().replace(/^#{1,3}\s+/, '').replace(/^[-*]\s+/, '').replace(/^>\s?/, ''))
    .filter(Boolean)
    .join(' · ')
}

// Full-width ambient strip under the time bar. The notes are context, not the
// work surface — two clamped lines when collapsed, nothing at all when empty,
// so the suggestion stack keeps every pixel of the gutter.
export function NotesRibbon({ text, fallback }: Props) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)

  const hasText = text.trim().length > 0
  if (!hasText && !fallback) return null

  const styles = makeStyles(colors)

  return (
    <div style={styles.ribbon}>
      <button
        type="button"
        style={styles.bar}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={open ? 'Collapse meeting notes' : 'Expand meeting notes'}
      >
        <span style={styles.label}>Strategic notes · live</span>
        {!open && (
          <span style={styles.preview} aria-live="polite">
            {hasText ? toPreview(text) : 'Meeting notes available'}
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
          {hasText ? <Markdown>{text}</Markdown> : fallback}
        </div>
      )}
    </div>
  )
}

function makeStyles(colors: Record<string, string>): Record<string, React.CSSProperties> {
  return {
    ribbon: {
      background: tint(colors.accent, colors.surfaceMuted, 8),
      borderLeft: `3px solid ${colors.accent}`,
      borderBottom: `1px solid ${colors.border}`,
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
      fontFamily: FONT.mono,
      fontSize: FONT.size.micro,
      fontWeight: 700,
      letterSpacing: LETTER_SPACING.wide,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    preview: {
      flex: 1,
      minWidth: 0,
      fontSize: FONT.size.label,
      color: colors.textMuted,
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
      color: colors.textDim,
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
      color: colors.textPrimary,
      lineHeight: 1.6,
    },
  }
}
