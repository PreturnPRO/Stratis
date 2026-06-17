/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend HTTP base, e.g. https://api.example.com. Defaults to localhost in dev. */
  readonly VITE_API_BASE?: string;
  /** Backend WebSocket base, e.g. wss://api.example.com. Derived from VITE_API_BASE if unset. */
  readonly VITE_WS_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
