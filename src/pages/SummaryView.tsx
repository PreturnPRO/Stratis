import React, { useEffect, useState } from 'react';
import { COLORS, FONT, LETTER_SPACING } from '../tokens/colors';
import { NodeBadge as _NodeBadge } from '../components/NodeTypes';
import { ParticipantSummaryOutput, SummaryBlock, ActionItem } from '../mocks/summaryMock';
import { useAuth } from '../context/AuthContext';

import { API_BASE } from '../lib/api';
// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'facilitator' | 'participant';

interface SummaryViewProps {
  sessionId?: string;
  autoSendCountdownSeconds?: number; // default 300 (5 min)
}

// ─── Block config ─────────────────────────────────────────────────────────────

const BLOCK_CONFIG: Record<
  SummaryBlock['block_type'],
  { icon: string; color: string; nodeType?: 'DECISION' | 'OPEN_QUESTION' | 'ASSUMPTION' | 'RISK' }
> = {
  OVERVIEW:     { icon: '≡',  color: COLORS.textMuted },
  WHAT_CHANGED: { icon: '↻',  color: COLORS.cyan },
  DECISIONS:    { icon: '⊕',  color: COLORS.cyan, nodeType: 'DECISION' },
  OPEN_ITEMS:   { icon: '?',  color: COLORS.red,    nodeType: 'OPEN_QUESTION' },
  ASSUMPTIONS:  { icon: '~',  color: COLORS.accent,  nodeType: 'ASSUMPTION' },
  RISKS:        { icon: '⚠',  color: COLORS.orange,  nodeType: 'RISK' },
  ACTION_ITEMS: { icon: '✓',  color: COLORS.teal },
  NEXT_STEPS:   { icon: '→',  color: COLORS.textMuted },
};

const BLOCK_LABEL: Record<SummaryBlock['block_type'], string> = {
  OVERVIEW:     'Overview',
  WHAT_CHANGED: 'What changed',
  DECISIONS:    'Decisions',
  OPEN_ITEMS:   'Open items',
  ASSUMPTIONS:  'Assumptions',
  RISKS:        'Risks',
  ACTION_ITEMS: 'Action items',
  NEXT_STEPS:   'Next steps',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseContentLines(content: string): string[] {
  return content.split('\n').map(l => l.trim()).filter(Boolean);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const FacilitatorBadge: React.FC = () => (
  <span
    style={{
      fontSize: FONT.size.micro,
      color: COLORS.cyan,
      background: COLORS.cyanBg,
      border: `1px solid ${COLORS.cyan}55`,
      borderRadius: 3,
      padding: '1px 6px',
      marginLeft: 6,
      fontWeight: 500,
    }}
  >
    Facilitator only
  </span>
);

const TimerBar: React.FC<{
  seconds: number;
  onSendNow: () => void;
  onEdit: () => void;
}> = ({ seconds, onSendNow, onEdit }) => (
  <div
    style={{
      background: COLORS.amberSubtle,
      border: `1px solid ${COLORS.amber}55`,
      borderRadius: 8,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    }}
  >
    <div
      style={{
        fontSize: FONT.size.label,
        color: COLORS.amber,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: COLORS.amber,
          display: 'inline-block',
          animation: 'stratisTimerPulse 1.2s ease-in-out infinite',
        }}
      />
      Auto-sends in {formatCountdown(seconds)} — review before it goes out
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={onEdit}
        style={{
          fontSize: FONT.size.caption,
          fontWeight: 500,
          padding: '5px 12px',
          borderRadius: 5,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          color: COLORS.textMuted,
          cursor: 'pointer',
        }}
      >
        Edit
      </button>
      <button
        onClick={onSendNow}
        style={{
          fontSize: FONT.size.caption,
          fontWeight: 500,
          padding: '5px 12px',
          borderRadius: 5,
          border: `1px solid ${COLORS.teal}55`,
          background: COLORS.tealBg,
          color: COLORS.teal,
          cursor: 'pointer',
        }}
      >
        Send now
      </button>
    </div>
  </div>
);

const SummaryBlockSection: React.FC<{
  block: SummaryBlock;
  role: UserRole;
}> = ({ block, role }) => {
  const cfg = BLOCK_CONFIG[block.block_type];
  const lines = parseContentLines(block.content);
  const isList = lines.length > 1 || ['DECISIONS', 'OPEN_ITEMS', 'ASSUMPTIONS', 'RISKS'].includes(block.block_type);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span aria-hidden="true" style={{ fontSize: FONT.size.body, color: cfg.color, fontWeight: 500, width: 16, textAlign: 'center' }}>
          {cfg.icon}
        </span>
        <span
          style={{
            fontSize: FONT.size.label,
            fontWeight: 500,
            letterSpacing: LETTER_SPACING.label,
            textTransform: 'uppercase',
            color: cfg.color,
          }}
        >
          {BLOCK_LABEL[block.block_type]}
        </span>
        {!block.visible_to_participants && role === 'facilitator' && <FacilitatorBadge />}
      </div>

      {isList ? (
        <div>
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                padding: '10px 12px',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: cfg.color,
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: FONT.size.body, color: COLORS.textPrimary, lineHeight: 1.5 }}>
                {line}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: FONT.size.body, color: COLORS.textMuted, lineHeight: 1.6, margin: 0 }}>
          {block.content}
        </p>
      )}
    </div>
  );
};

const ActionItemsSection: React.FC<{ items: ActionItem[] }> = ({ items }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span aria-hidden="true" style={{ fontSize: FONT.size.body, color: COLORS.teal, fontWeight: 500, width: 16, textAlign: 'center' }}>✓</span>
      <span
        style={{
          fontSize: FONT.size.label,
          fontWeight: 500,
          letterSpacing: LETTER_SPACING.label,
          textTransform: 'uppercase',
          color: COLORS.teal,
        }}
      >
        Action items
      </span>
    </div>
    {items.map((item, i) => (
      <div
        key={i}
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 6,
          padding: '10px 12px',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span style={{ fontSize: FONT.size.body, color: COLORS.textPrimary }}>{item.task}</span>
        <span
          style={{
            fontSize: FONT.size.caption,
            color: COLORS.textMuted,
            background: COLORS.surfaceMuted,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {item.owner}
        </span>
      </div>
    ))}
  </div>
);

// ─── SummaryView (main) ───────────────────────────────────────────────────────

const SummaryView: React.FC<SummaryViewProps> = ({
  sessionId,
  autoSendCountdownSeconds = 300,
}) => {
  const { token, user } = useAuth();
  const role: UserRole = user?.role === 'facilitator' ? 'facilitator' : 'participant';

  const [summary, setSummary] = useState<ParticipantSummaryOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [countdown, setCountdown] = useState(autoSendCountdownSeconds);
  const [sent, setSent] = useState(false);

  const isFacilitator = role === 'facilitator';

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!sessionId) {
        setError('Missing session ID for summary');
        setLoading(false);
        return;
      }

      if (!token) {
        setError('You must be signed in to view this summary');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/api/summary/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data: {
          ok: boolean;
          error?: string;
          data?: {
            summary: ParticipantSummaryOutput;
            provider?: string;
            transcriptCount?: number;
          };
        } = await res.json();

        if (cancelled) return;

        if (!res.ok || !data.ok || !data.data?.summary) {
          setError(data.error ?? 'Could not load summary');
          return;
        }

        setSummary(data.data.summary);
      } catch {
        if (!cancelled) {
          setError('Could not reach summary endpoint');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [sessionId, token]);

  useEffect(() => {
    if (!isFacilitator || sent) return;
    if (countdown <= 0) {
      setSent(true);
      return;
    }

    const t = setTimeout(() => setCountdown(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, isFacilitator, sent]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          background: COLORS.bg,
          minHeight: '100vh',
          padding: '32px 24px',
          color: COLORS.textMuted,
          fontFamily: 'inherit',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          Generating summary from meeting transcript...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        style={{
          background: COLORS.bg,
          minHeight: '100vh',
          padding: '32px 24px',
          color: COLORS.red,
          fontFamily: 'inherit',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div
        style={{
          background: COLORS.bg,
          minHeight: '100vh',
          padding: '32px 24px',
          color: COLORS.textMuted,
          fontFamily: 'inherit',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          No summary available.
        </div>
      </div>
    );
  }

  const visibleBlocks = summary.summary_blocks.filter(
    b => b.block_type !== 'ACTION_ITEMS' && (isFacilitator || b.visible_to_participants)
  );

  const decisionCount = summary.summary_blocks.find(b => b.block_type === 'DECISIONS')
    ? parseContentLines(summary.summary_blocks.find(b => b.block_type === 'DECISIONS')!.content).length
    : 0;
  const openCount = summary.summary_blocks.find(b => b.block_type === 'OPEN_ITEMS')
    ? parseContentLines(summary.summary_blocks.find(b => b.block_type === 'OPEN_ITEMS')!.content).length
    : 0;

  return (
    <div
      style={{
        background: COLORS.bg,
        minHeight: '100vh',
        padding: '32px 24px',
        fontFamily: 'inherit',
      }}
    >
      <style>{`
        @keyframes stratisTimerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Facilitator timer bar — never shown to participants */}
        {isFacilitator && !sent && (
          <TimerBar
            seconds={countdown}
            onSendNow={() => setSent(true)}
            onEdit={() => { /* wire to edit mode in Sprint 3 */ }}
          />
        )}

        {sent && isFacilitator && (
          <div
            role="status"
            style={{
              background: COLORS.tealBg,
              border: `1px solid ${COLORS.teal}55`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 24,
              fontSize: FONT.size.label,
              color: COLORS.teal,
              fontWeight: 500,
            }}
          >
            <span aria-hidden="true">✓</span> Summary sent to all participants
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: FONT.size.heading, fontWeight: 600, color: COLORS.textPrimary, margin: '0 0 4px' }}>
            {summary.summary_title}
          </h1>
          <p style={{ fontSize: FONT.size.body, color: COLORS.textMuted, margin: '0 0 10px' }}>
            {summary.summary_subtitle}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <span style={{ fontSize: FONT.size.caption, color: COLORS.textMuted }}>
              {summary.participants.join(', ')}
            </span>
            {decisionCount > 0 && (
              <span style={{ fontSize: FONT.size.caption, color: COLORS.textMuted }}>
                {decisionCount} decision{decisionCount !== 1 ? 's' : ''}
              </span>
            )}
            {openCount > 0 && (
              <span style={{ fontSize: FONT.size.caption, color: COLORS.textMuted }}>
                {openCount} open item{openCount !== 1 ? 's' : ''}
              </span>
            )}
            <span style={{ fontSize: FONT.size.caption, color: COLORS.textMuted }}>
              {summary.action_items.length} action item{summary.action_items.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div style={{ height: 1, background: COLORS.border, marginBottom: 20 }} />

        {/* Summary blocks */}
        {visibleBlocks.map((block, i) => (
          <SummaryBlockSection key={i} block={block} role={role} />
        ))}

        {/* Action items always rendered separately */}
        {summary.action_items.length > 0 && (
          <ActionItemsSection items={summary.action_items} />
        )}

      </div>
    </div>
  );
};

export default SummaryView;