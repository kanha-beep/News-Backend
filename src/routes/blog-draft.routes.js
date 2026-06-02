import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createDraftFromArticle, listDrafts, updateDraft } from "../services/blog-draft.service.js";
import { asyncHandler } from "../utils/http.js";

export const blogDraftRouter = Router();

blogDraftRouter.use(requireAuth);

blogDraftRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await listDrafts(req.user._id);
    res.status(200).json({ items });
  }),
);

blogDraftRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const item = await createDraftFromArticle({
      articleLink: req.body?.articleLink,
      notes: req.body?.notes,
      user: req.user,
    });
    res.status(201).json({ item });
  }),
);

blogDraftRouter.patch(
  "/:draftId",
  asyncHandler(async (req, res) => {
    const item = await updateDraft(req.params.draftId, req.body, req.user._id);
    res.status(200).json({ item });
  }),
);
