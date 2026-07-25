import type { Request, Response } from "express";

export function placeholder(namespace: string, note: string) {
  return (_req: Request, res: Response) => {
    res.json({
      ok: true,
      data: { namespace, status: "skeleton", note },
    });
  };
}
