import React from "react";
import ReactDOM from "react-dom/client";
/* Self-hosted variable Inter. The type scale, the -0.024em display tracking and
   the 400/500/600/700 ladder in tokens/colors.ts are all tuned to Inter's
   metrics; without this the whole system rendered in Arial. */
import "@fontsource-variable/inter";
import App from "./App";
import "./index.css";
import { installDevMock, isDevMockEnabled } from "./mocks/devMock";

/* Opt-in only, and dev-only — see mocks/devMock.ts. Must run before render so
   the first fetch from any page already sees the patched window.fetch. */
if (isDevMockEnabled()) installDevMock();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);