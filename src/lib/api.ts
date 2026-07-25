export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

export const WS_BASE =
  import.meta.env.VITE_WS_BASE ?? API_BASE.replace(/^http/, "ws");

if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE) {
  console.error(
    "[stratis] VITE_API_BASE is not set — this production build is calling " +
      "http://localhost:3001, which will fail. Set VITE_API_BASE to your " +
      "backend URL (e.g. https://<service>.up.railway.app) in the Vercel " +
      "project environment and redeploy.",
  );
}
