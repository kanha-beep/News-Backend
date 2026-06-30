import { Router } from "express";
import { createDraft, getDrafts, patchDraft } from "../controllers/blog-draft.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const blogDraftRouter = Router();

blogDraftRouter.use(requireAuth);

blogDraftRouter.get("/", asyncHandler(getDrafts));

blogDraftRouter.post("/", asyncHandler(createDraft));

blogDraftRouter.patch("/:draftId", asyncHandler(patchDraft));
