import { Router } from "express";
import {
  filterNews,
  getArticle,
  getLegacyHinduFeed,
  listNews,
  listTags,
  syncNews,
  toggleDislike,
  toggleFavorite,
  toggleLike,
} from "../controllers/news.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const newsRouter = Router();

newsRouter.get("/sync", optionalAuth, asyncHandler(syncNews));

newsRouter.get("/", optionalAuth, asyncHandler(listNews));

newsRouter.get("/article", optionalAuth, asyncHandler(getArticle));

newsRouter.post("/filter", optionalAuth, asyncHandler(filterNews));

newsRouter.get("/tags", asyncHandler(listTags));

newsRouter.post("/favorites/toggle", requireAuth, asyncHandler(toggleFavorite));

newsRouter.post("/likes/toggle", requireAuth, asyncHandler(toggleLike));
newsRouter.post("/dislikes/toggle", requireAuth, asyncHandler(toggleDislike));

newsRouter.get("/legacy-hindu", asyncHandler(getLegacyHinduFeed));
