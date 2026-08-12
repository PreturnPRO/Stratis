import type { Request, Response, NextFunction } from "express";
import { reportError } from "../lib/errorReporter";

// Logs the path it rejected. A bare `{"ok":false,"error":"Not found"}` with no
// server-side trace is unattributable: a client calling /api/document/ with an
// empty id looks identical to a typo in a route mount, and neither shows up in
// the logs at all. The method and URL are enough to tell them apart.
export function notFound(req: Request, res: Response) {
  console.warn(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ ok: false, error: "Not found" });
}

// The log gets the real error; the customer gets a sentence. An unexpected
// throw carries whatever the thing that threw it knew — a Postgres message
// naming a column, a provider URL, a key-file path — and none of that belongs
// in an HTTP body served to the public internet. Dev keeps the detail, because
// there the reader of the response is the person who caused it.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : "Internal server error";
  // Logs the detail and, in production, pushes one alert per distinct failure.
  // The route pattern rather than the URL, so /api/document/abc and
  // /api/document/def are one failure and not two.
  reportError(err, {
    where: `${req.method} ${req.route?.path ?? req.baseUrl ?? req.originalUrl}`,
    meta: { url: req.originalUrl, orgId: req.auth?.orgId ?? null },
  });
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === "production" ? "Something went wrong on our side" : message,
  });
}
