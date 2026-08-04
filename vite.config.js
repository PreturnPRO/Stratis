import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The frontend and the API now share one source of truth for plan,
      // invite, and release shapes — duplicating them was how the two halves
      // drifted apart before.
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  server: {
    proxy: {
      // S1-T03-C: forward API calls to the Express backend (PORT=3001).
      "/api": "http://localhost:3001",
      // WebSocket hub (suggestion cards) — proxied so dev mirrors prod.
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
});
