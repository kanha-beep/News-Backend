import { Router } from "express";
import { getEvent, getEvents, getOverview, searchIntelligence } from "../controllers/intelligence.controller.js";
import { optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const intelligenceRouter = Router();

intelligenceRouter.get("/overview", asyncHandler(getOverview));

intelligenceRouter.get("/events", asyncHandler(getEvents));

intelligenceRouter.get("/events/:eventId", asyncHandler(getEvent));

intelligenceRouter.get("/search", optionalAuth, asyncHandler(searchIntelligence));
