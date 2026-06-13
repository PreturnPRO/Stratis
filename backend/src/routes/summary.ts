// /api/summary (S1-T03-A skeleton). Real post-meeting summary generation +
// delivery: S2-T07-E.
import { Router } from "express";
import { placeholder } from "./_placeholder";

export const summaryRouter = Router();

summaryRouter.get("/", placeholder("summary", "summary generation comes in S2-T07-E"));
