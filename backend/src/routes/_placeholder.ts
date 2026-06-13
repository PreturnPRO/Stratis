// Shared helper for S1-T03-A skeleton routes: a uniform "this route is wired,
// not yet implemented" 200 response. Replaced per-namespace in later tasks.
import type { Request, Response } from "express";

export function placeholder(namespace: string, note: string) {
  return (_req: Request, res: Response) => {
    res.json({
      ok: true,
      data: { namespace, status: "skeleton", note },
    });
  };
}
