// Backend base URLs — single source of truth for the frontend.
//
// Deployment: set VITE_API_BASE (and optionally VITE_WS_BASE) at build time.
// The WS base is derived from the API base by default (http→ws, https→wss),
// so a single VITE_API_BASE usually covers both. Falls back to localhost:3001
// for local dev so `npm run dev` works with no extra config.
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

export const WS_BASE =
  import.meta.env.VITE_WS_BASE ?? API_BASE.replace(/^http/, "ws");

// A deployed build silently pointing at localhost is the #1 "everything is
// broken after deploy" cause — make it loud in the console.
if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE) {
  console.error(
    "[stratis] VITE_API_BASE is not set — this production build is calling " +
      "http://localhost:3001, which will fail. Set VITE_API_BASE to your " +
      "backend URL (e.g. https://<service>.up.railway.app) in the Vercel " +
      "project environment and redeploy.",
  );
}
