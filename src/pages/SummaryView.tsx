import React, { useEffect, useState } from 'react';
import { COLORS, FONT, LETTER_SPACING, RADIUS, SPACE, tint } from '../tokens/colors';
import { NodeBadge as _NodeBadge } from '../components/NodeTypes';
import { ParticipantSummaryOutput, SummaryBlock, ActionItem } from '../mocks/summaryMock';
import type { DecisionRecord } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

import { API_BASE } from '../lib/api';

type UserRole = 'facilitator' | 'participant';

interface SummaryViewProps {
  sessionId?: string;
  autoSendCountdownSeconds?: number;
}

function getBlockConfig(colors: Record<keyof typeof COLORS, string>): Record<
  SummaryBlock['block_type'],
  { icon: string; color: string; nodeType?: 'DECISION' | 'OPEN_QUESTION' | 'ASSUMPTION' | 'RISK' }
> {
  return {
    OVERVIEW:     { icon: '≡',  color: colors.textMuted },
    WHAT_CHANGED: { icon: '↻',  color: colors.cyan },
    DECISIONS:    { icon: '⊕',  color: colors.cyan, nodeType: 'DECISION' },
    OPEN_ITEMS:   { icon: '?',  color: colors.red,    nodeType: 'OPEN_QUESTION' },
    ASSUMPTIONS:  { icon: '~',  color: colors.accent,  nodeType: 'ASSUMPTION' },
    RISKS:        { icon: '⚠',  color: colors.orange,  nodeType: 'RISK' },
    ACTION_ITEMS: { icon: '✓',  color: colors.teal },
    NEXT_STEPS:   { icon: '→',  color: colors.textMuted },
  };
}

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

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseContentLines(content: string): string[] {
  return content.split('\n').map(l => l.trim()).filter(Boolean);
}

const CountPill: React.FC<{ colors: Record<keyof typeof COLORS, string>; color: string; children: React.ReactNode }> = ({ colors, color, children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: FONT.size.caption,
      fontWeight: 600,
      color,
      background: tint(color, colors.bg),
      border: `1px solid ${color}55`,
      borderRadius: RADIUS.pill,
      padding: '3px 10px',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

const FacilitatorBadge: React.FC = () => {
  const { colors } = useTheme();
  return (
    <span
      style={{
        fontSize: FONT.size.micro,
        color: colors.cyan,
        background: colors.cyanBg,
        border: `1px solid ${colors.cyan}55`,
        borderRadius: 3,
        padding: '1px 6px',
        marginLeft: SPACE[1.5],
        fontWeight: 500,
      }}
    >
      Facilitator only
    </span>
  );
};

const TimerBar: React.FC<{
  seconds: number;
  onSendNow: () => void;
  onEdit: () => void;
}> = ({ seconds, onSendNow, onEdit }) => {
  const { colors } = useTheme();
  return (
    <div
      style={{
        background: colors.amberSubtle,
        border: `1px solid ${colors.amber}55`,
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{
          fontSize: FONT.size.label,
          color: colors.amber,
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
            background: colors.amber,
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
            borderRadius: RADIUS.pill,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.textMuted,
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
            borderRadius: RADIUS.pill,
            border: `1px solid ${colors.teal}55`,
            background: colors.tealBg,
            color: colors.teal,
            cursor: 'pointer',
          }}
        >
          Send now
        </button>
      </div>
    </div>
  );
};

const SummaryBlockSection: React.FC<{
  block: SummaryBlock;
  role: UserRole;
}> = ({ block, role }) => {
  const { colors } = useTheme();
  const cfg = getBlockConfig(colors)[block.block_type];
  const lines = parseContentLines(block.content);
  const isList = lines.length > 1 || ['DECISIONS', 'OPEN_ITEMS', 'ASSUMPTIONS', 'RISKS'].includes(block.block_type);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: SPACE[2.5] }}>
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
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {lines.map((line, i) => (
            <li
              key={i}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                padding: '10px 12px',
                marginBottom: SPACE[1.5],
                display: 'flex',
                alignItems: 'flex-start',
                gap: SPACE[2.5],
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: cfg.color,
                  marginTop: SPACE[1.5],
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: FONT.size.body, color: colors.textPrimary, lineHeight: 1.5 }}>
                {line}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.6, margin: 0 }}>
          {block.content}
        </p>
      )}
    </div>
  );
};

const ActionItemsSection: React.FC<{ items: ActionItem[] }> = ({ items }) => {
  const { colors } = useTheme();
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: SPACE[2.5] }}>
        <span aria-hidden="true" style={{ fontSize: FONT.size.body, color: colors.teal, fontWeight: 500, width: 16, textAlign: 'center' }}>✓</span>
        <span
          style={{
            fontSize: FONT.size.label,
            fontWeight: 500,
            letterSpacing: LETTER_SPACING.label,
            textTransform: 'uppercase',
            color: colors.teal,
          }}
        >
          Action items
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            padding: '10px 12px',
            marginBottom: SPACE[1.5],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ fontSize: FONT.size.body, color: colors.textPrimary }}>{item.task}</span>
          <span
            style={{
              fontSize: FONT.size.caption,
              color: colors.textMuted,
              background: colors.surfaceMuted,
              border: `1px solid ${colors.border}`,
              borderRadius: RADIUS.sm,
              padding: '2px 8px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {item.owner}
          </span>
        </li>
      ))}
      </ul>
    </div>
  );
};

const SummaryView: React.FC<SummaryViewProps> = ({
  sessionId,
  autoSendCountdownSeconds = 300,
}) => {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const role: UserRole = user?.role === 'facilitator' ? 'facilitator' : 'participant';

  const [summary, setSummary] = useState<ParticipantSummaryOutput | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [completenessRate, setCompletenessRate] = useState<number | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
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
            decisions?: DecisionRecord[];
            metric?: { completenessRate: number | null };
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
        setDecisions(data.data.decisions ?? []);
        setCompletenessRate(data.data.metric?.completenessRate ?? null);
        setProvider(data.data.provider ?? null);
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
          background: colors.bg,
          minHeight: '100vh',
          padding: '32px 24px',
          color: colors.textMuted,
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
          background: colors.bg,
          minHeight: '100vh',
          padding: '32px 24px',
          color: colors.red,
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
          background: colors.bg,
          minHeight: '100vh',
          padding: '32px 24px',
          color: colors.textMuted,
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
    b =>
      b.block_type !== 'ACTION_ITEMS' &&
      (decisions.length === 0 || b.block_type !== 'DECISIONS') &&
      (isFacilitator || b.visible_to_participants)
  );

  const decisionCount = decisions.length > 0
    ? decisions.length
    : summary.summary_blocks.find(b => b.block_type === 'DECISIONS')
    ? parseContentLines(summary.summary_blocks.find(b => b.block_type === 'DECISIONS')!.content).length
    : 0;
  const openCount = summary.summary_blocks.find(b => b.block_type === 'OPEN_ITEMS')
    ? parseContentLines(summary.summary_blocks.find(b => b.block_type === 'OPEN_ITEMS')!.content).length
    : 0;

  return (
    <div
      style={{
        background: colors.bg,
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

        {provider === 'mock' && (
          <div
            role="alert"
            style={{
              background: colors.orangeBg,
              border: `1px solid ${colors.orange}55`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 24,
              fontSize: FONT.size.label,
              color: colors.orange,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            This summary is placeholder output from the offline mock provider — the
            backend has no AI key configured. Set AI_PROVIDER and its API key (e.g.
            GROQ_API_KEY) on the backend service to get a real AI summary.
          </div>
        )}

        {isFacilitator && !sent && (
          <TimerBar
            seconds={countdown}
            onSendNow={() => setSent(true)}
            onEdit={() => {  }}
          />
        )}

        {sent && isFacilitator && (
          <div
            role="status"
            style={{
              background: colors.tealBg,
              border: `1px solid ${colors.teal}55`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 24,
              fontSize: FONT.size.label,
              color: colors.teal,
              fontWeight: 500,
            }}
          >
            <span aria-hidden="true">✓</span> Summary sent to {summary.participants.length} participant{summary.participants.length !== 1 ? 's' : ''}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: FONT.size.micro,
              fontWeight: 700,
              letterSpacing: LETTER_SPACING.eyebrow,
              textTransform: 'uppercase',
              color: colors.textMuted,
              marginBottom: 6,
            }}
          >
            SESSION SUMMARY · {summary.duration_minutes} MIN
          </div>
          <h1 style={{ fontSize: FONT.size.heading, fontWeight: 600, color: colors.textPrimary, margin: '0 0 4px' }}>
            {summary.summary_title}
          </h1>
          <p style={{ fontSize: FONT.size.body, color: colors.textMuted, margin: '0 0 10px' }}>
            {summary.summary_subtitle}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: FONT.size.caption, color: colors.textMuted }}>
              {summary.participants.join(', ')}
            </span>
            {decisionCount > 0 && (
              <CountPill colors={colors} color={colors.cyan}>
                {decisionCount} decision{decisionCount !== 1 ? 's' : ''}
              </CountPill>
            )}
            {openCount > 0 && (
              <CountPill colors={colors} color={colors.red}>
                {openCount} open item{openCount !== 1 ? 's' : ''}
              </CountPill>
            )}
            <CountPill colors={colors} color={colors.teal}>
              {summary.action_items.length} action item{summary.action_items.length !== 1 ? 's' : ''}
            </CountPill>
          </div>
        </div>

        <div style={{ height: 1, background: colors.border, marginBottom: 20 }} />

        {decisions.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: FONT.size.subheading, fontWeight: 600, color: colors.textPrimary }}>
                Decisions
              </h2>
              {completenessRate != null && (
                <span style={{ fontSize: FONT.size.label, color: completenessRate === 100 ? colors.green : colors.orange }}>
                  {completenessRate}% left with a date
                </span>
              )}
            </div>
            {decisions.map(d => (
              <div
                key={d.id}
                style={{
                  background: colors.surfaceMuted,
                  border: `1px solid ${d.status === 'incomplete' ? `${colors.orange}55` : colors.border}`,
                  borderRadius: RADIUS.md,
                  padding: '12px 16px',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {d.status === 'incomplete' && (
                    <span style={{ fontSize: FONT.size.micro, fontWeight: 700, color: colors.orange, letterSpacing: 0.6 }}>
                      UNCONFIRMED
                    </span>
                  )}
                  {d.status === 'open' && (
                    <span style={{ fontSize: FONT.size.micro, fontWeight: 700, color: colors.cyan, letterSpacing: 0.6 }}>
                      OPEN
                    </span>
                  )}
                  {d.owner && (
                    <span style={{ fontSize: FONT.size.micro, color: colors.textDim }}>{d.owner}</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.textPrimary, lineHeight: 1.5 }}>
                  {d.text}
                </p>
                <span style={{ fontSize: FONT.size.label, color: d.status === 'incomplete' ? colors.orange : colors.textMuted }}>
                  {d.dueDate
                    ? `Due: ${d.dueDate}`
                    : d.status === 'open'
                    ? d.revisit
                      ? `Revisit: ${d.revisit}`
                      : ''
                    : d.missing ?? 'No deadline'}
                </span>
              </div>
            ))}
          </div>
        )}

        {visibleBlocks.map((block, i) => (
          <SummaryBlockSection key={i} block={block} role={role} />
        ))}

        {summary.action_items.length > 0 && (
          <ActionItemsSection items={summary.action_items} />
        )}

      </div>
    </div>
  );
};

export default SummaryView;
