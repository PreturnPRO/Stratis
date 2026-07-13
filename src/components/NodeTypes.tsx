import React from 'react';
import { COLORS, FONT, LETTER_SPACING, RADIUS } from '../tokens/colors';

// ─── Node type + status enums ────────────────────────────────────────────────

export type NodeType =
  | 'DECISION'
  | 'ASSUMPTION'
  | 'OPEN_QUESTION'
  | 'RISK'
  | 'SUMMARY';

export type NodeStatus =
  | 'VALIDATED'
  | 'UNVALIDATED'
  | 'STALLED'
  | 'BLOCKED'
  | 'ARCHIVED';

// ─── Per-type token map ───────────────────────────────────────────────────────

interface NodeTypeTokens {
  dot: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  label: string;
}

export const NODE_TYPE_TOKENS: Record<NodeType, NodeTypeTokens> = {
  DECISION: {
    dot: COLORS.cyan,
    accent: COLORS.cyan,
    badgeBg: COLORS.cyanBg,
    badgeText: COLORS.cyan,
    badgeBorder: COLORS.cyan,
    label: 'Decision',
  },
  ASSUMPTION: {
    dot: COLORS.teal,
    accent: COLORS.teal,
    badgeBg: COLORS.tealBg,
    badgeText: COLORS.teal,
    badgeBorder: COLORS.teal,
    label: 'Assumption',
  },
  OPEN_QUESTION: {
    dot: COLORS.red,
    accent: COLORS.red,
    badgeBg: COLORS.redBg,
    badgeText: COLORS.red,
    badgeBorder: COLORS.red,
    label: 'Open question',
  },
  RISK: {
    dot: COLORS.orange,
    accent: COLORS.orange,
    badgeBg: COLORS.orangeBg,
    badgeText: COLORS.orange,
    badgeBorder: COLORS.orange,
    label: 'Risk',
  },
  SUMMARY: {
    dot: COLORS.textMuted,
    accent: COLORS.textDim,
    badgeBg: COLORS.surfaceMuted,
    badgeText: COLORS.textMuted,
    badgeBorder: COLORS.border,
    label: 'Summary',
  },
};

// ─── NodeBadge ────────────────────────────────────────────────────────────────

interface NodeBadgeProps {
  type: NodeType;
  size?: 'sm' | 'md';
}

export const NodeBadge: React.FC<NodeBadgeProps> = ({ type, size = 'md' }) => {
  const t = NODE_TYPE_TOKENS[type];
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? 4 : 5,
        padding: isSm ? '2px 7px' : '3px 9px',
        borderRadius: RADIUS.sm,
        fontSize: isSm ? FONT.size.micro : FONT.size.caption,
        fontWeight: 500,
        letterSpacing: LETTER_SPACING.wide,
        background: t.badgeBg,
        color: t.badgeText,
        border: `1px solid ${t.badgeBorder}`,
      }}
    >
      <span
        style={{
          width: isSm ? 6 : 7,
          height: isSm ? 6 : 7,
          borderRadius: '50%',
          background: t.dot,
          flexShrink: 0,
        }}
      />
      {t.label}
    </span>
  );
};

// ─── NodeStatusPill ───────────────────────────────────────────────────────────

const STATUS_TOKENS: Record<NodeStatus, { bg: string; text: string }> = {
  VALIDATED:   { bg: COLORS.cyanBg,   text: COLORS.cyan },
  UNVALIDATED: { bg: COLORS.orangeBg, text: COLORS.orange },
  STALLED:     { bg: COLORS.redBg,    text: COLORS.red },
  BLOCKED:     { bg: COLORS.orangeBg, text: COLORS.orange },
  ARCHIVED:    { bg: COLORS.surfaceMuted, text: COLORS.textMuted },
};

const STATUS_LABELS: Record<NodeStatus, string> = {
  VALIDATED:   'Validated',
  UNVALIDATED: 'Unvalidated',
  STALLED:     'Stalled',
  BLOCKED:     'Blocked',
  ARCHIVED:    'Archived',
};

interface NodeStatusPillProps {
  status: NodeStatus;
}

export const NodeStatusPill: React.FC<NodeStatusPillProps> = ({ status }) => {
  const s = STATUS_TOKENS[status];

  return (
    <span
      style={{
        fontSize: FONT.size.micro,
        fontWeight: 500,
        padding: '2px 6px',
        borderRadius: 3,
        background: s.bg,
        color: s.text,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
};

// ─── NodeCard ─────────────────────────────────────────────────────────────────

export interface NodeCardData {
  id: string;
  type: NodeType;
  title: string;
  content: string;
  status: NodeStatus;
  sourceSession?: string;
  timestamp?: string;
  onClick?: () => void;
}

export const NodeCard: React.FC<NodeCardData> = ({
  type,
  title,
  content,
  status,
  sourceSession,
  timestamp,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.borderColor = COLORS.borderLight;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = COLORS.border;
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <NodeBadge type={type} size="sm" />
      </div>
      <div
        style={{
          fontSize: FONT.size.body,
          fontWeight: 500,
          color: COLORS.textPrimary,
          marginBottom: 4,
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: FONT.size.body,
          color: COLORS.textMuted,
          lineHeight: 1.5,
        }}
      >
        {content}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
        }}
      >
        <span style={{ fontSize: FONT.size.caption, color: COLORS.textMuted }}>
          {[sourceSession, timestamp].filter(Boolean).join(' · ')}
        </span>
        <NodeStatusPill status={status} />
      </div>
    </div>
  );
};