import { COLORS } from "../constants";

type Block = {
  id?: string;
  type?: string;
  title?: string;
  content?: string;
  timestamp?: string;
};

function TextBlock({ node }: { node: Block }) {
  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      padding: "12px 16px",
    }}>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>
        {node.timestamp}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text, marginBottom: 4 }}>
        {node.title}
      </div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>
        {node.content}
      </div>
    </div>
  );
}

function DecisionNode({ node }: { node: Block }) {
  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.teal}`,
      borderRadius: 8,
      padding: "12px 16px",
    }}>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>
        {node.timestamp}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>
          {node.title}
        </div>
        <span style={{
          fontSize: 11,
          color: COLORS.teal,
          border: `1px solid ${COLORS.teal}`,
          borderRadius: 4,
          padding: "1px 6px",
        }}>
          decision
        </span>
      </div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>
        {node.content}
      </div>
    </div>
  );
}

function EmptyPlaceholder() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 16px",
      color: COLORS.textDim,
      fontSize: 13,
      border: `1px dashed ${COLORS.border}`,
      borderRadius: 8,
    }}>
      No blocks yet
    </div>
  );
}

function UnknownBlock({ node }: { node: Block }) {
  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.borderLight}`,
      borderRadius: 8,
      padding: "12px 16px",
      fontSize: 13,
      color: COLORS.textDim,
    }}>
      Unknown block type: {node?.type ?? "undefined"}
    </div>
  );
}

function BlockSwitch({ node }: { node: Block }) {
  if (!node || !node.type) return <UnknownBlock node={node} />;
  switch (node.type) {
    case "TextBlock":        return <TextBlock node={node} />;
    case "DecisionNode":     return <DecisionNode node={node} />;
    case "EmptyPlaceholder": return <EmptyPlaceholder />;
    default:                 return <UnknownBlock node={node} />;
  }
}

export default function BlockRenderer({ nodes }: { nodes: Block[] }) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return <EmptyPlaceholder />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {nodes.map((node, i) => (
        <BlockSwitch key={node?.id ?? i} node={node} />
      ))}
    </div>
  );
}