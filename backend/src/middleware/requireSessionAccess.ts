import type { Request, Response, NextFunction } from "express";
import { checkSessionAccess } from "../lib/sessionAccess";

/**
 * Guards a route whose session id arrives in the body or the path.
 *
 * Written as middleware rather than a call inside each handler because the
 * handlers it protects are the ones that forgot: five routes in routes/ai.ts
 * read `body.sessionId` and acted on it with no ownership check at all. A guard
 * that has to be remembered in the body of every function is a guard that will
 * be missed by the next route added in a hurry.
 */
export function requireSessionAccess(source: "body" | "params" = "body") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const raw =
      source === "params"
        ? req.params.sessionId
        : typeof req.body?.sessionId === "string"
          ? req.body.sessionId
          : "";

    const access = await checkSessionAccess(raw ?? "", req.auth!.sub, req.auth!.orgId);
    if (!access.ok) {
      return res.status(access.status).json({ ok: false, error: access.error });
    }

    next();
  };
}
