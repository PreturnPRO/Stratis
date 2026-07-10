// API route skeleton (S1-T03-A).
// Each namespace is mounted here and currently returns placeholder 200s to
// confirm the routing works. Real handlers are added in later tasks:
//   /api/session    → session lifecycle      (S1-T03-F)
//   /api/transcript → transcript ingest/save (S1-T04-C / S1-T04-D)
//   /api/ai         → AI pipeline            (S1-T03-B…E)
//   /api/summary    → meeting summary        (S2-T07-E)
//   /api/meeting    → meeting CRUD           (S1-T03-G)
import { Router } from "express";
import { meetingRouter } from "./meeting";
import { aiRouter } from "./ai";
import { summaryRouter } from "./summary";
import { sessionRouter } from "./session";
import { transcriptRouter } from "./transcript";
import { documentRouter } from "./document";

export const apiRouter = Router();

apiRouter.use("/meeting", meetingRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/summary", summaryRouter);
apiRouter.use("/session", sessionRouter);
apiRouter.use("/transcript", transcriptRouter);
apiRouter.use("/document", documentRouter);
