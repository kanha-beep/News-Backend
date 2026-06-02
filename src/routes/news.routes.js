import { Router } from "express";
import { News } from "../../news.model.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { sanitizeUser } from "../services/auth.service.js";
import {
  getArticleByLink,
  getAvailableTags,
  getPaginatedNews,
  syncNewsFromRss,
  upsertArticleIfMissing,
} from "../services/news.service.js";
import { asyncHandler, badRequest } from "../utils/http.js";
import { normalizeFeedItem } from "../utils/news-intelligence.js";

export const newsRouter = Router();

newsRouter.get(
  "/sync",
  asyncHandler(async (req, res) => {
    const payload = await syncNewsFromRss(req.query.rssUrl || undefined);
    res.status(200).json(payload);
  }),
);

newsRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const payload = await getPaginatedNews({
      tag: req.query.tag,
      title: req.query.title,
      date: req.query.date,
      month: req.query.month,
      page: req.query.page,
      favoriteLinks: req.query.favoritesOnly === "true" ? req.user?.favoriteLinks || [] : undefined,
      userFavoriteLinks: req.user?.favoriteLinks || [],
      userLikedLinks: req.user?.likedLinks || [],
    });
    res.status(200).json(payload);
  }),
);

newsRouter.get(
  "/article",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const article = await getArticleByLink({
      link: req.query.link,
      userFavoriteLinks: req.user?.favoriteLinks || [],
      userLikedLinks: req.user?.likedLinks || [],
    });

    if (!article) {
      throw badRequest("Article not found");
    }

    res.status(200).json({ item: article });
  }),
);

newsRouter.post(
  "/filter",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const payload = await getPaginatedNews({
      tag: req.body?.tag,
      title: req.body?.title,
      date: req.body?.date,
      month: req.body?.month,
      page: req.body?.page,
      favoriteLinks: req.body?.favoritesOnly ? req.user?.favoriteLinks || [] : undefined,
      userFavoriteLinks: req.user?.favoriteLinks || [],
      userLikedLinks: req.user?.likedLinks || [],
    });
    res.status(200).json(payload);
  }),
);

newsRouter.get(
  "/tags",
  asyncHandler(async (_req, res) => {
    const items = await getAvailableTags();
    res.status(200).json({ items });
  }),
);

newsRouter.post(
  "/favorites/toggle",
  requireAuth,
  asyncHandler(async (req, res) => {
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

    req.user = updatedUser;
    res.status(200).json({
      favorite: !alreadyFavorite,
      user: sanitizeUser(updatedUser),
    });
  }),
);

newsRouter.post(
  "/likes/toggle",
  requireAuth,
  asyncHandler(async (req, res) => {
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

    req.user = updatedUser;
    res.status(200).json({
      liked: !alreadyLiked,
      user: sanitizeUser(updatedUser),
    });
  }),
);

newsRouter.get(
  "/legacy-hindu",
  asyncHandler(async (_req, res) => {
    const payload = await syncNewsFromRss();
    res.status(200).json(payload);
  }),
);
