// /api/transcript (S1-T03-A skeleton). Real transcript ingest → AI pipeline
// and persistence: S1-T04-C / S1-T04-D.
import { Router } from "express";
import { placeholder } from "./_placeholder";

export const transcriptRouter = Router();

transcriptRouter.get("/", placeholder("transcript", "transcript ingest/save comes in S1-T04-C/D"));
