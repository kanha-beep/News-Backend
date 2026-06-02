import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createComment, listComments } from "../services/comment.service.js";
import { asyncHandler } from "../utils/http.js";

export const commentRouter = Router();

commentRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await listComments(req.query.link);
    res.status(200).json({ items });
  }),
);

commentRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const item = await createComment({
      link: req.body?.link,
      content: req.body?.content,
      user: req.user,
    });
    res.status(201).json({ item });
  }),
);
