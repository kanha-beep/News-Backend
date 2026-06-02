import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import {
  buildIntelligenceOverview,
  getEventTimeline,
  listEventClusters,
  runSemanticSearch,
} from "../services/news.service.js";
import { asyncHandler, badRequest } from "../utils/http.js";

export const intelligenceRouter = Router();

intelligenceRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const overview = await buildIntelligenceOverview();
    res.status(200).json(overview);
  }),
);

intelligenceRouter.get(
  "/events",
  asyncHandler(async (_req, res) => {
    const items = await listEventClusters();
    res.status(200).json({ items });
  }),
);

intelligenceRouter.get(
  "/events/:eventId",
  asyncHandler(async (req, res) => {
    const item = await getEventTimeline(req.params.eventId);
    if (!item) {
      throw badRequest("Event not found");
    }

    res.status(200).json({ item });
  }),
);

intelligenceRouter.get(
  "/search",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const query = String(req.query.q || "").trim();
    if (!query) {
      throw badRequest("Search query is required");
    }

    const items = await runSemanticSearch({
      query,
      userFavoriteLinks: req.user?.favoriteLinks || [],
      userLikedLinks: req.user?.likedLinks || [],
    });
    res.status(200).json({ items });
  }),
);
