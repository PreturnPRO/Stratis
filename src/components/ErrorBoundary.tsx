import React from "react";

interface Props {
  children: React.ReactNode;
  area?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[stratis] UI crash${this.props.area ? ` in ${this.props.area}` : ""}:`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: "48px 24px",
          textAlign: "center",
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          color: "#f2f2f3",
          background: "#09090b",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600 }}>Something broke on this screen</div>
        <div style={{ fontSize: 14, color: "#a1a1a6", maxWidth: 460, lineHeight: 1.6 }}>
          Your meeting data is safe — the transcript is saved as it happens. Reloading
          this screen will pick up where you left off.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid #8FAE6D",
              background: "#8FAE6D",
              color: "#10160b",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          <button
            onClick={this.reset}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid #2e2e33",
              background: "transparent",
              color: "#a1a1a6",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
        <details style={{ marginTop: 10, fontSize: 12, color: "#6b6b73", maxWidth: 560 }}>
          <summary style={{ cursor: "pointer" }}>Technical details</summary>
          <pre style={{ textAlign: "left", whiteSpace: "pre-wrap", marginTop: 8 }}>
            {error.message}
          </pre>
        </details>
      </div>
    );
  }
}
