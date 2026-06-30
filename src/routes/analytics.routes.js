import { Router } from "express";
import { createVisit } from "../controllers/analytics.controller.js";
import { asyncHandler } from "../utils/http.js";

export const analyticsRouter = Router();

analyticsRouter.post("/visit", asyncHandler(createVisit));
