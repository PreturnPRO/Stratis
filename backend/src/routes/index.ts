import { Router } from "express";
import { meetingRouter } from "./meeting";
import { aiRouter } from "./ai";
import { summaryRouter } from "./summary";
import { sessionRouter } from "./session";
import { transcriptRouter } from "./transcript";
import { documentRouter } from "./document";
import { notificationRouter } from "./notification";
import { inviteRouter } from "./invite";
import { profileRouter } from "./profile";
import { billingRouter } from "./billing";
import { adminRouter } from "./admin";
import { trackRouter } from "./track";
import { feedbackRouter } from "./feedback";
import { systemRouter } from "./system";

export const apiRouter = Router();

apiRouter.use("/meeting", meetingRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/summary", summaryRouter);
apiRouter.use("/session", sessionRouter);
apiRouter.use("/transcript", transcriptRouter);
apiRouter.use("/document", documentRouter);
apiRouter.use("/notification", notificationRouter);

// Beta guard rails.
apiRouter.use("/invite", inviteRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/billing", billingRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/track", trackRouter);
apiRouter.use("/feedback", feedbackRouter);
apiRouter.use("/system", systemRouter);
