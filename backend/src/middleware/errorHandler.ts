import type { Request, Response, NextFunction } from "express";

// Logs the path it rejected. A bare `{"ok":false,"error":"Not found"}` with no
// server-side trace is unattributable: a client calling /api/document/ with an
// empty id looks identical to a typo in a route mount, and neither shows up in
// the logs at all. The method and URL are enough to tell them apart.
export function notFound(req: Request, res: Response) {
  console.warn(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ ok: false, error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[error]", message);
  res.status(500).json({ ok: false, error: message });
}
