export default function AmbientBackground({ theme }: { theme: "dark" | "light" }) {
  const grid = theme === "light" ? "rgba(60,56,36,.045)" : "rgba(255,255,255,.028)";
  const glow = theme === "light" ? "rgba(84,113,58,.10)" : "rgba(143,174,109,.10)";
  const glow2 = theme === "light" ? "rgba(23,127,156,.06)" : "rgba(42,179,212,.06)";
  const bg = theme === "light" ? "#f6f4ee" : "#09090b";

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
          backgroundSize: "52px 52px",
          animation: "ambGridDrift 14s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-10%",
          width: "70vw",
          height: "70vw",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
          filter: "blur(20px)",
          animation: "ambA 22s ease-in-out infinite alternate",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "-10%",
          width: "60vw",
          height: "60vw",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow2} 0%, transparent 65%)`,
          filter: "blur(24px)",
          animation: "ambB 28s ease-in-out infinite alternate",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, transparent 40%, ${bg} 100%)`,
        }}
      />
    </div>
  );
}
