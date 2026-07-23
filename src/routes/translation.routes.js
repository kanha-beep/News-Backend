import { Router } from "express";
import { getUiLabels } from "../controllers/translation.controller.js";
import { optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const translationRouter = Router();

translationRouter.get("/ui", optionalAuth, asyncHandler(getUiLabels));
