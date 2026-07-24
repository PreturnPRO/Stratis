import React from "react";
import { FONT, RADIUS, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";

type Colors = ReturnType<typeof useTheme>["colors"];

// ─────────────────────────────────────────────────────────────────────────────
// Minimal, dependency-free Markdown renderer for the PM document article view.
// Supports: # / ## / ### headings, - / * bullet lists, 1. ordered lists,
// > blockquotes, **bold**, *italic*, `code`, and paragraphs. Good enough for the
// long-form "Medium style" layout without pulling in a markdown library.
// ─────────────────────────────────────────────────────────────────────────────

function codeStyleFor(colors: Colors): React.CSSProperties {
  return {
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    fontSize: "0.88em",
    background: colors.surfaceMuted,
    border: `1px solid ${colors.border}`,
    borderRadius: RADIUS.sm,
    padding: "1px 5px",
  };
}

function renderInline(text: string, colors: Colors): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={key++} style={{ color: colors.textPrimary, fontWeight: 600 }}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(<code key={key++} style={codeStyleFor(colors)}>{m[3]}</code>);
    } else if (m[4] !== undefined) {
      nodes.push(<em key={key++}>{m[4]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "p"; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ") });
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      flushPara();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushPara();
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2] });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      i--;
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      i--;
      blocks.push({ kind: "ol", items });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushPara();
      const qlines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        qlines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocks.push({ kind: "quote", lines: qlines });
      continue;
    }

    para.push(trimmed);
  }
  flushPara();
  return blocks;
}

function hStyleFor(colors: Colors): Record<number, React.CSSProperties> {
  return {
    1: { fontSize: FONT.size.heading, fontWeight: 700, color: colors.textPrimary, margin: "22px 0 10px" },
    2: { fontSize: FONT.size.subheading, fontWeight: 600, color: colors.textPrimary, margin: "20px 0 8px" },
    3: { fontSize: FONT.size.body, fontWeight: 600, color: colors.textPrimary, margin: "16px 0 6px" },
  };
}

export function Markdown({ children }: { children: string }) {
  const { colors } = useTheme();
  const blocks = parseBlocks(children ?? "");
  const hStyle = hStyleFor(colors);

  if (blocks.length === 0) {
    return <p style={{ color: colors.textMuted, fontSize: FONT.size.body, margin: 0 }}>(empty)</p>;
  }

  return (
    <div style={{ fontSize: FONT.size.body, lineHeight: 1.75, color: colors.textMuted }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h":
            return <div key={i} style={hStyle[b.level] ?? hStyle[3]}>{renderInline(b.text, colors)}</div>;
          case "ul":
            return (
              <ul key={i} style={{ margin: "8px 0", paddingLeft: SPACE[6], display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
                {b.items.map((it, j) => <li key={j}>{renderInline(it, colors)}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} style={{ margin: "8px 0", paddingLeft: SPACE[6], display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
                {b.items.map((it, j) => <li key={j}>{renderInline(it, colors)}</li>)}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                style={{
                  margin: "12px 0",
                  padding: "8px 16px",
                  borderLeft: `3px solid ${colors.accent}`,
                  background: colors.surfaceMuted,
                  borderRadius: 6,
                  color: colors.textMuted,
                }}
              >
                {b.lines.map((l, j) => <div key={j}>{renderInline(l, colors)}</div>)}
              </blockquote>
            );
          case "p":
          default:
            return <p key={i} style={{ margin: "0 0 12px" }}>{renderInline(b.text, colors)}</p>;
        }
      })}
    </div>
  );
}
