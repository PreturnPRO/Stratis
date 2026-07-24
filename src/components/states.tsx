import { FONT } from "../constants";
import { useEffect, useState } from "react";
import { useTheme } from "../hooks/useTheme";

export function EmptyState({ message = "Nothing here yet" }) {
  const { colors } = useTheme();
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
      border: `1px dashed ${colors.border}`,
      borderRadius: 8,
      color: colors.textMuted,
      fontSize: FONT.size.body,
      textAlign: "center",
      gap: 8,
    }}>
      <div style={{ fontSize: FONT.size.heading, opacity: 0.4 }}>⊘</div>
      <div>{message}</div>
    </div>
  );
}

function SkeletonCard() {
  const { colors } = useTheme();
  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ width: 48, height: 10, background: colors.borderLight, borderRadius: 3 }} />
      <div style={{ width: "60%", height: 13, background: colors.borderLight, borderRadius: 3 }} />
      <div style={{ width: "90%", height: 11, background: colors.border, borderRadius: 3 }} />
      <div style={{ width: "75%", height: 11, background: colors.border, borderRadius: 3 }} />
    </div>
  );
}

const APPEAR_DELAY_MS = 500;

export function LoadingState({
  count = 3,
  delayMs = 1500,
  onDone,
  persist = false,
}: {
  count?: number;
  delayMs?: number;
  onDone?: () => void;
  persist?: boolean;
}) {
  const [shown, setShown]     = useState(false);
  const [visible, setVisible] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    const appearTimer = setTimeout(() => setShown(true), APPEAR_DELAY_MS);
    return () => clearTimeout(appearTimer);
  }, []);

  useEffect(() => {
    if (persist) return;

    const t = setTimeout(() => {
      setVisible(false);
      if (onDone) onDone();
    }, delayMs);

    return () => clearTimeout(t);
  }, [delayMs, onDone, persist]);

  if (!visible || !shown) return null;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 8,
      animation: "pulse 1.2s ease-in-out infinite",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "4px 0 8px",
        color: colors.textMuted,
        fontSize: FONT.size.label,
      }}>
        <div style={{
          width: 14,
          height: 14,
          border: `2px solid ${colors.border}`,
          borderTopColor: colors.accent,
          borderRadius: "50%",
          flexShrink: 0,
          animation: "spin 0.7s linear infinite",
        }} />
        Loading...
      </div>

      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}