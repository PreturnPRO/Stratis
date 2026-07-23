import { useState } from "react";
import type { ReactNode } from "react";

export default function RollingText({
  children,
  accentColor,
}: {
  children: ReactNode;
  accentColor?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "inline-block", overflow: "hidden", height: "1.3em", verticalAlign: "top" }}
    >
      <span
        style={{
          display: "block",
          transition: "transform .34s cubic-bezier(.76,0,.24,1)",
          transform: hovered ? "translateY(-1.3em)" : "translateY(0)",
        }}
      >
        <span style={{ display: "block", height: "1.3em", lineHeight: "1.3em" }}>{children}</span>
        <span style={{ display: "block", height: "1.3em", lineHeight: "1.3em", color: accentColor }}>
          {children}
        </span>
      </span>
    </span>
  );
}
