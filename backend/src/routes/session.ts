// /api/session (S1-T03-A skeleton). Real session lifecycle (create/start/end,
// recovery on crash): S1-T03-F / S1-T05-C.
import { Router } from "express";
import { placeholder } from "./_placeholder";

export const sessionRouter = Router();

sessionRouter.get("/", placeholder("session", "session lifecycle comes in S1-T03-F"));
