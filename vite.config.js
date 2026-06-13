import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // S1-T03-C: forward API calls to the Express backend (PORT=3001).
      "/api": "http://localhost:3001",
    },
  },
});
