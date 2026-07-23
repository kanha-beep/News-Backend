import { Router } from "express";
import {
  getLegacyHindu,
  getLegacyTags,
  toggleLegacyDislike,
  toggleLegacyFavorite,
  toggleLegacyLike,
} from "../controllers/legacy.controller.js";
import { optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const legacyRouter = Router();

legacyRouter.get("/hindu", optionalAuth, asyncHandler(getLegacyHindu));

legacyRouter.get("/tags", asyncHandler(getLegacyTags));

legacyRouter.post("/favorites/toggle", optionalAuth, asyncHandler(toggleLegacyFavorite));

legacyRouter.post("/likes/toggle", optionalAuth, asyncHandler(toggleLegacyLike));
legacyRouter.post("/dislikes/toggle", optionalAuth, asyncHandler(toggleLegacyDislike));
