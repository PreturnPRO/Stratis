// Backend base URLs — single source of truth for the frontend.
//
// Deployment: set VITE_API_BASE (and optionally VITE_WS_BASE) at build time.
// The WS base is derived from the API base by default (http→ws, https→wss),
// so a single VITE_API_BASE usually covers both. Falls back to localhost:3001
// for local dev so `npm run dev` works with no extra config.
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

export const WS_BASE =
  import.meta.env.VITE_WS_BASE ?? API_BASE.replace(/^http/, "ws");
