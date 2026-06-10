// /api/meeting (S1-T03-A skeleton). Real meeting CRUD + dashboard data: S1-T03-G.
import { Router } from "express";
import { placeholder } from "./_placeholder";

export const meetingRouter = Router();

meetingRouter.get("/", placeholder("meeting", "meeting list/CRUD comes in S1-T03-G"));
