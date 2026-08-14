import React, { useEffect, useState } from 'react';
import { FONT, LETTER_SPACING, RADIUS, SPACE, tint } from '../tokens/colors';
import { NodeBadge as _NodeBadge } from '../components/NodeTypes';
import { ParticipantSummaryOutput, SummaryBlock, ActionItem } from '../mocks/summaryMock';
import type { DecisionRecord } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

import { ApiError, apiFetch } from '../lib/http';
import { downloadMarkdown, summaryFilename } from '../lib/summaryExport';
import { clearLocalTranscript } from '../lib/localTranscript';
import { ProLock } from '../components/ProLock';

type UserRole = 'facilitator' | 'participant';
type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface SummaryViewProps {
  sessionId?: string;
  /** The summary is a leaf. Without this there is nowhere to go from it. */
  onNav?: (id: string, params?: Record<string, string>) => void;
}

function getBlockConfig(colors: ThemeColors): Record<
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

function parseContentLines(content: string): string[] {
  return content.split('\n').map(l => l.trim()).filter(Boolean);
}

const CountPill: React.FC<{ colors: ThemeColors; color: string; children: React.ReactNode }> = ({ colors, color, children }) => (
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

/**
 * The summary is a document the PM owns, not a message Stratis sends.
 *
 * This used to be a countdown that auto-delivered the summary to "participants"
 * — who were speaker names off a transcript, not accounts, and had no inbox to
 * receive anything. Nothing was ever delivered. Export hands the PM a file and
 * lets them decide who should see it, which is what was actually happening.
 */
const ExportBar: React.FC<{
  editing: boolean;
  onExport: () => void;
  onCopy: () => void;
  onEdit: () => void;
  copied: boolean;
  /** False on Free — the buttons still show, wearing a lock. */
  canExport: boolean;
  onSeePricing: () => void;
}> = ({ editing, onExport, onCopy, onEdit, copied, canExport, onSeePricing }) => {
  const { colors } = useTheme();
  const accent = editing ? colors.cyan : colors.accent;
  return (
    <div
      style={{
        background: editing ? colors.cyanBg : colors.surfaceMuted,
        border: `1px solid ${accent}55`,
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 24,
      }}
    >
      <div
        style={{
          fontSize: FONT.size.label,
          color: editing ? accent : colors.textMuted,
          fontWeight: 500,
        }}
      >
        {editing
          ? 'Editing — correct the AI before you send this out'
          : 'Review it, then export and share it however your team works.'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onEdit}
          style={{
            fontSize: FONT.size.caption,
            fontWeight: 500,
            padding: '5px 12px',
            borderRadius: RADIUS.pill,
            border: `1px solid ${editing ? accent : colors.border}`,
            background: colors.surface,
            color: editing ? accent : colors.textMuted,
            cursor: 'pointer',
          }}
        >
          {editing ? 'Done editing' : 'Edit'}
        </button>
        <ProLock
          locked={!canExport}
          feature="Exporting the record"
          blurb="Take the summary out of Stratis as a file you can paste into LINE, email or Notion."
          onSeePricing={onSeePricing}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onCopy}
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
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={onExport}
              style={{
                fontSize: FONT.size.caption,
                fontWeight: 500,
                padding: '5px 12px',
                borderRadius: RADIUS.pill,
                border: `1px solid ${colors.accent}55`,
                background: colors.surface,
                color: colors.accent,
                cursor: 'pointer',
              }}
            >
              Export
            </button>
          </div>
        </ProLock>
      </div>
    </div>
  );
};

const EditedBadge: React.FC = () => {
  const { colors } = useTheme();
  return (
    <span
      title="Rewritten by the facilitator — not the AI's wording"
      style={{
        fontSize: FONT.size.micro,
        color: colors.teal,
        background: colors.tealBg,
        border: `1px solid ${colors.teal}55`,
        borderRadius: 3,
        padding: '1px 6px',
        marginLeft: SPACE[1.5],
        fontWeight: 500,
      }}
    >
      Edited by facilitator
    </span>
  );
};

const SummaryBlockSection: React.FC<{
  block: SummaryBlock;
  role: UserRole;
  canEdit: boolean;
  onSave: (content: string) => Promise<boolean>;
}> = ({ block, role, canEdit, onSave }) => {
  const { colors } = useTheme();
  const cfg = getBlockConfig(colors)[block.block_type];
  const lines = parseContentLines(block.content);
  const isList = lines.length > 1 || ['DECISIONS', 'OPEN_ITEMS', 'ASSUMPTIONS', 'RISKS'].includes(block.block_type);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.content);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(block.content);
    setEditing(true);
  };

  const save = async () => {
    const clean = draft.trim();
    if (!clean || clean === block.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await onSave(clean);
    setSaving(false);
    if (ok) setEditing(false);
  };

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
        {block.edited_at && <EditedBadge />}
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            style={{
              marginLeft: 'auto',
              fontSize: FONT.size.micro,
              padding: '3px 10px',
              borderRadius: RADIUS.pill,
              border: `1px solid ${colors.border}`,
              background: 'transparent',
              color: colors.textMuted,
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(14, Math.max(3, lines.length + 1))}
            aria-label={`${BLOCK_LABEL[block.block_type]} content`}
            style={{
              background: colors.surface,
              border: `1px solid ${colors.borderLight}`,
              borderRadius: RADIUS.sm,
              color: colors.textPrimary,
              padding: '10px 12px',
              fontSize: FONT.size.body,
              lineHeight: 1.6,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => void save()}
              disabled={saving}
              style={{
                fontSize: FONT.size.caption,
                fontWeight: 500,
                padding: '5px 12px',
                borderRadius: RADIUS.pill,
                border: `1px solid ${colors.teal}55`,
                background: colors.tealBg,
                color: colors.teal,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              style={{
                fontSize: FONT.size.caption,
                padding: '5px 12px',
                borderRadius: RADIUS.pill,
                border: `1px solid ${colors.border}`,
                background: 'transparent',
                color: colors.textMuted,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              Cancel
            </button>
            <span style={{ fontSize: FONT.size.micro, color: colors.textDim }}>
              One line per item.
            </span>
          </div>
        </div>
      ) : isList ? (
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

/**
 * The two-minute read.
 *
 * A table, not a list of sentences: who owns it, when it is due, and whether it
 * is finished are the three things a PM scans for, and scanning only works when
 * they sit in fixed columns. The tick is the PM's own state — "the work is
 * done" is a different question from "the decision was recorded completely",
 * which is what the checkpoint's status already means.
 */
const ActionItemsSection: React.FC<{
  items: ActionItem[];
  canTick: boolean;
  onToggle: (id: string, done: boolean) => void;
}> = ({ items, canTick, onToggle }) => {
  const { colors } = useTheme();
  const outstanding = items.filter((i) => !i.done).length;

  const cell: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: `1px solid ${colors.border}`,
    fontSize: FONT.size.body,
    color: colors.textPrimary,
    textAlign: 'left',
    verticalAlign: 'top',
  };
  const head: React.CSSProperties = {
    ...cell,
    fontSize: FONT.size.label,
    fontWeight: 500,
    letterSpacing: LETTER_SPACING.label,
    textTransform: 'uppercase',
    color: colors.textMuted,
  };

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
        <span style={{ fontSize: FONT.size.caption, color: colors.textDim, fontFamily: FONT.mono }}>
          {outstanding} of {items.length} outstanding
        </span>
      </div>

      {/* Wide content scrolls in its own box rather than the page. */}
      <div style={{ overflowX: 'auto', border: `1px solid ${colors.border}`, borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...head, width: 40 }}>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                  Done
                </span>
              </th>
              <th scope="col" style={head}>Task</th>
              <th scope="col" style={{ ...head, width: 140 }}>Owner</th>
              <th scope="col" style={{ ...head, width: 120 }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ background: item.done ? colors.surfaceMuted : colors.surface }}>
                <td style={{ ...cell, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!canTick}
                    aria-label={`Mark "${item.task}" done`}
                    onChange={(e) => onToggle(item.id, e.target.checked)}
                    style={{ cursor: canTick ? 'pointer' : 'default', accentColor: colors.accent }}
                  />
                </td>
                <td
                  style={{
                    ...cell,
                    textDecoration: item.done ? 'line-through' : 'none',
                    color: item.done ? colors.textDim : colors.textPrimary,
                  }}
                >
                  {item.task}
                </td>
                <td style={{ ...cell, color: item.owner ? colors.textMuted : colors.textDim }}>
                  {item.owner || 'unowned'}
                </td>
                <td
                  style={{
                    ...cell,
                    fontFamily: FONT.mono,
                    fontSize: FONT.size.caption,
                    color: item.due_date ? colors.textMuted : colors.textDim,
                  }}
                >
                  {item.due_date || 'no date'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SummaryView: React.FC<SummaryViewProps> = ({
  sessionId,
  onNav,
}) => {
  const { token, user, subscription } = useAuth();
  const { colors } = useTheme();
  const role: UserRole = user?.role === 'facilitator' ? 'facilitator' : 'participant';

  const [summary, setSummary] = useState<ParticipantSummaryOutput | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [completenessRate, setCompletenessRate] = useState<number | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Export replaced send. Nothing here is time-bound any more: the PM decides
  // when the summary is good enough to leave the building, and who gets it.
  const [copied, setCopied] = useState(false);
  // Holds the auto-send while the facilitator is correcting the AI's wording.
  // Without it the summary could go out mid-edit, which is the exact failure
  // the edit affordance exists to prevent.
  const [editingSummary, setEditingSummary] = useState(false);

  const isFacilitator = role === 'facilitator';
  // Read from the plan the server already sends, so the lock matches what the
  // export endpoint will actually allow.
  const canExport = Boolean(subscription?.features?.includes('transcript_export'));

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
        const data = await apiFetch<{
          summary: ParticipantSummaryOutput;
          decisions?: DecisionRecord[];
          metric?: { completenessRate: number | null };
          provider?: string;
          transcriptCount?: number;
          sentAt?: string | null;
        }>(`/api/summary/${sessionId}`);

        if (cancelled) return;

        if (!data?.summary) {
          setError('Could not load summary');
          return;
        }

        setSummary(data.summary);
        setDecisions(data.decisions ?? []);

        // The record exists on the server, so the device no longer has to hold
        // the only other copy. This is the one place that is allowed to delete
        // it — deleting when the meeting ends would throw the transcript away
        // at exactly the moment summary generation might still fail.
        if (sessionId) clearLocalTranscript(sessionId);
        setCompletenessRate(data.metric?.completenessRate ?? null);
        setProvider(data.provider ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not reach summary endpoint');
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

  /**
   * Ticking an action item off. Optimistic, because the checkbox has to feel
   * like a checkbox; rolled back if the write fails, because a tick that
   * silently did not save is worse than one that visibly bounced.
   */
  const toggleActionDone = async (decisionId: string, done: boolean) => {
    if (!sessionId || !token) return;

    const apply = (value: boolean) =>
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              action_items: prev.action_items.map((item) =>
                item.id === decisionId ? { ...item, done: value } : item,
              ),
            }
          : prev,
      );

    apply(done);
    try {
      await apiFetch(`/api/session/${sessionId}/decisions/${decisionId}`, {
        method: 'PATCH',
        body: { done },
      });
    } catch (err) {
      apply(!done);
      setError(err instanceof Error ? err.message : 'Could not save that change');
    }
  };

  /**
   * The file comes from the server, because that is where the plan check is.
   * A 402 here is the paywall, not a failure — say so in those words.
   */
  const fetchMarkdown = async (): Promise<string | null> => {
    if (!sessionId) return null;
    try {
      const data = await apiFetch<{ markdown: string }>(`/api/summary/${sessionId}/export`);
      return data.markdown;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setError(
        status === 402
          ? 'Exporting the record is part of Pro — add it to your wishlist on the Plans page.'
          : err instanceof Error
            ? err.message
            : 'Could not prepare the export',
      );
      return null;
    }
  };

  const exportSummary = async () => {
    if (!summary) return;
    const markdown = await fetchMarkdown();
    if (markdown) downloadMarkdown(summaryFilename(summary), markdown);
  };

  const copySummary = async () => {
    const markdown = await fetchMarkdown();
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission is not guaranteed. Export still works, and the
      // button says nothing rather than claiming a copy that did not happen.
      setError('Could not copy — use Export instead');
    }
  };

  const saveBlock = async (blockId: string | undefined, content: string): Promise<boolean> => {
    if (!blockId || !sessionId || !token) {
      setError('This summary block cannot be edited yet — reload and try again.');
      return false;
    }

    try {
      const data = await apiFetch<{ block: SummaryBlock }>(
        `/api/summary/${sessionId}/block/${blockId}`,
        { method: 'PATCH', body: { content } },
      );

      if (!data?.block) {
        setError('Could not save that edit');
        return false;
      }

      const saved = data.block;
      setSummary(prev =>
        prev
          ? {
              ...prev,
              summary_blocks: prev.summary_blocks.map(b => (b.id === saved.id ? saved : b)),
            }
          : prev,
      );
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that edit');
      return false;
    }
  };

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

  // A failed load replaced the entire page with one red line — no title, no
  // way back, nothing to tell you which meeting you were even trying to open.
  // The parts that need no server are rendered from what we already know.
  if (error && !summary) {
    return (
      <div
        style={{
          background: colors.bg,
          minHeight: '100vh',
          padding: '32px 24px',
          color: colors.text,
          fontFamily: 'inherit',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div
            style={{
              fontSize: FONT.size.caption,
              letterSpacing: LETTER_SPACING.wide,
              textTransform: 'uppercase',
              color: colors.textDim,
              marginBottom: SPACE[1],
            }}
          >
            Meeting summary
          </div>
          <h1 style={{ fontSize: FONT.size.title, margin: `0 0 ${SPACE[2]}px`, fontWeight: 500 }}>
            This summary could not be loaded
          </h1>
          <div
            role="alert"
            style={{
              background: colors.surfaceMuted,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: '12px 14px',
              color: colors.textMuted,
              fontSize: FONT.size.label,
              marginBottom: SPACE[2],
            }}
          >
            {error}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: FONT.size.label,
                color: colors.accent,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {onNav && (
              <button
                onClick={() => onNav('dashboard')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontSize: FONT.size.label,
                  color: colors.textMuted,
                  cursor: 'pointer',
                }}
              >
                Back to dashboard
              </button>
            )}
          </div>
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

        {isFacilitator && (
          <ExportBar
            editing={editingSummary}
            copied={copied}
            canExport={canExport}
            onSeePricing={() => onNav?.('pricing')}
            onExport={() => void exportSummary()}
            onCopy={() => void copySummary()}
            onEdit={() => setEditingSummary(e => !e)}
          />
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
          <SummaryBlockSection
            key={block.id ?? i}
            block={block}
            role={role}
            canEdit={isFacilitator}
            onSave={(content) => saveBlock(block.id, content)}
          />
        ))}

        {summary.action_items.length > 0 && (
          <ActionItemsSection
            items={summary.action_items}
            canTick={isFacilitator}
            onToggle={(id, done) => void toggleActionDone(id, done)}
          />
        )}

        {/* The summary was the end of the road: you arrived, read it, and the
            only way on was the sidebar. These are the two places a PM actually
            goes next. */}
        {onNav && (
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              marginTop: 28,
              paddingTop: 18,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <button
              onClick={() => onNav('document', sessionId ? { sessionId } : {})}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: FONT.size.label,
                color: colors.accent,
                cursor: 'pointer',
              }}
            >
              Open the project document →
            </button>
            <button
              onClick={() => onNav('dashboard')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: FONT.size.label,
                color: colors.textMuted,
                cursor: 'pointer',
              }}
            >
              Back to dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default SummaryView;
