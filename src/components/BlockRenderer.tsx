// S1-T03-D: renders AI output blocks. Handles all 4 AIBlockType values.
// QuestionSuggestion is normally routed to SuggestionCardStack by useAiBlocks
// and only appears here as a graceful fallback. Unknown types render as
// UnknownBlock — never throws.

import { FONT, RADIUS, SPACE } from '../constants'
import { useTheme } from '../hooks/useTheme'
import type { AIBlock, AIBlockType } from '../../shared/types'

type Block = AIBlock & { id?: string; timestamp?: string }

function TextBlock({ node }: { node: Block }) {
  const { colors } = useTheme()
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '12px 16px' }}>
      {node.timestamp && <div style={{ fontSize: FONT.size.caption, color: colors.textMuted, marginBottom: SPACE[1.5] }}>{node.timestamp}</div>}
      <div style={{ fontSize: FONT.size.body, fontWeight: 500, color: colors.text, marginBottom: 4 }}>{node.title}</div>
      <div style={{ fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.5 }}>{node.content}</div>
    </div>
  )
}

function DecisionNodeBlock({ node }: { node: Block }) {
  const { colors } = useTheme()
  const options = node.metadata?.options as string[] | undefined
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.teal}`, borderRadius: 8, padding: '12px 16px' }}>
      {node.timestamp && <div style={{ fontSize: FONT.size.caption, color: colors.textMuted, marginBottom: SPACE[1.5] }}>{node.timestamp}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: FONT.size.body, fontWeight: 500, color: colors.text }}>{node.title}</div>
        <span style={{ fontSize: FONT.size.caption, color: colors.teal, border: `1px solid ${colors.teal}`, borderRadius: RADIUS.sm, padding: '1px 6px' }}>decision</span>
        {node.metadata?.status && (
          <span style={{ fontSize: FONT.size.caption, color: colors.textMuted, border: `1px solid ${colors.borderLight}`, borderRadius: RADIUS.sm, padding: '1px 6px' }}>
            {String(node.metadata.status)}
          </span>
        )}
      </div>
      <div style={{ fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.5 }}>{node.content}</div>
      {options && options.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: SPACE[1.5] }}>
          {options.map((opt, i) => (
            <span key={i} style={{ fontSize: FONT.size.caption, padding: '2px 8px', borderRadius: RADIUS.sm, background: colors.surfaceHover, color: colors.textMuted, border: `1px solid ${colors.borderLight}` }}>
              {opt}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryBlock({ node }: { node: Block }) {
  const { colors } = useTheme()
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.accent}`, borderRadius: 8, padding: '12px 16px' }}>
      {node.timestamp && <div style={{ fontSize: FONT.size.caption, color: colors.textMuted, marginBottom: SPACE[1.5] }}>{node.timestamp}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: FONT.size.body, fontWeight: 500, color: colors.text }}>{node.title}</div>
        <span style={{ fontSize: FONT.size.caption, color: colors.accent, border: `1px solid ${colors.accentDim}`, borderRadius: RADIUS.sm, padding: '1px 6px' }}>summary</span>
      </div>
      <div style={{ fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.5 }}>{node.content}</div>
    </div>
  )
}

function QuestionSuggestionBlock({ node }: { node: Block }) {
  const { colors } = useTheme()
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.teal}`, borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: FONT.size.body, fontWeight: 500, color: colors.text }}>{node.title}</div>
        <span style={{ fontSize: FONT.size.caption, color: colors.teal, border: `1px solid ${colors.teal}`, borderRadius: RADIUS.sm, padding: '1px 6px' }}>question</span>
      </div>
      <div style={{ fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.5 }}>{node.content}</div>
    </div>
  )
}

function EmptyPlaceholder() {
  const { colors } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', color: colors.textMuted, fontSize: FONT.size.body, border: `1px dashed ${colors.border}`, borderRadius: 8 }}>
      No blocks yet
    </div>
  )
}

function UnknownBlock({ node }: { node: Block }) {
  const { colors } = useTheme()
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.borderLight}`, borderRadius: 8, padding: '12px 16px', fontSize: FONT.size.body, color: colors.textMuted }}>
      Unknown block type: {node?.type ?? 'undefined'}
    </div>
  )
}

// EmptyPlaceholder is a frontend-only sentinel, never in AIBlockType.
// Cast to string for the switch so the compiler doesn't reject it.
const EMPTY = 'EmptyPlaceholder' as string as AIBlockType

function BlockSwitch({ node }: { node: Block }) {
  if (!node || !node.type) return <UnknownBlock node={node} />
  switch (node.type) {
    case 'TextBlock':          return <TextBlock node={node} />
    case 'DecisionNode':       return <DecisionNodeBlock node={node} />
    case 'SummaryBlock':       return <SummaryBlock node={node} />
    case 'QuestionSuggestion': return <QuestionSuggestionBlock node={node} />
    case EMPTY:                return <EmptyPlaceholder />
    default:                   return <UnknownBlock node={node} />
  }
}

export default function BlockRenderer({ nodes }: { nodes: Block[] }) {
  if (!Array.isArray(nodes) || nodes.length === 0) return <EmptyPlaceholder />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {nodes.map((node, i) => (
        <div key={node.id ?? i}>
          <BlockSwitch node={node} />
        </div>
      ))}
    </div>
  )
}
