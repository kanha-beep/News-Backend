import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { sanitizeUser } from "../services/auth.service.js";
import { getAvailableTags, syncNewsFromRss, upsertArticleIfMissing } from "../services/news.service.js";
import { asyncHandler, badRequest } from "../utils/http.js";

export const legacyRouter = Router();

legacyRouter.get(
  "/hindu",
  asyncHandler(async (req, res) => {
    const payload = await syncNewsFromRss(req.query.rssUrl || undefined);
    res.status(200).json(payload);
  }),
);

legacyRouter.get(
  "/tags",
  asyncHandler(async (_req, res) => {
    const items = await getAvailableTags();
    res.status(200).json({ items });
  }),
);

legacyRouter.post(
  "/favorites/toggle",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { link } = req.body || {};
    if (!link) {
      throw badRequest("Link is required");
    }

    await upsertArticleIfMissing(req.body);
    const alreadyFavorite = (req.user.favoriteLinks || []).includes(link);
    const updatedUser = await req.user.constructor.findByIdAndUpdate(
      req.user._id,
      alreadyFavorite ? { $pull: { favoriteLinks: link } } : { $addToSet: { favoriteLinks: link } },
      { new: true },
    );

    res.status(200).json({
      favorite: !alreadyFavorite,
      user: sanitizeUser(updatedUser),
    });
  }),
);

legacyRouter.post(
  "/likes/toggle",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { link } = req.body || {};
    if (!link) {
      throw badRequest("Link is required");
    }

    await upsertArticleIfMissing(req.body);
    const alreadyLiked = (req.user.likedLinks || []).includes(link);
    const updatedUser = await req.user.constructor.findByIdAndUpdate(
      req.user._id,
      alreadyLiked ? { $pull: { likedLinks: link } } : { $addToSet: { likedLinks: link } },
      { new: true },
    );

    res.status(200).json({
      liked: !alreadyLiked,
      user: sanitizeUser(updatedUser),
    });
  }),
);
