import { Router } from "express";
import { meetingRouter } from "./meeting";
import { aiRouter } from "./ai";
import { summaryRouter } from "./summary";
import { sessionRouter } from "./session";
import { transcriptRouter } from "./transcript";
import { documentRouter } from "./document";
import { notificationRouter } from "./notification";

export const apiRouter = Router();

apiRouter.use("/meeting", meetingRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/summary", summaryRouter);
apiRouter.use("/session", sessionRouter);
apiRouter.use("/transcript", transcriptRouter);
apiRouter.use("/document", documentRouter);
apiRouter.use("/notification", notificationRouter);
