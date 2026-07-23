import { sanitizeUser } from "../services/auth.service.js";
import {
  getArticleByLink,
  getAvailableTags,
  getPaginatedNews,
  syncNewsFromRss,
  upsertArticleIfMissing,
} from "../services/news.service.js";
import { resolvePreferredLanguage } from "../services/translation.service.js";
import { badRequest } from "../utils/http.js";

export const syncNews = async (req, res) => {
  const payload = await syncNewsFromRss(req.query.rssUrl || undefined, {
    language: resolvePreferredLanguage({
      queryLanguage: req.query.language,
      userLanguage: req.user?.preferredLanguage,
    }),
  });
  res.status(200).json(payload);
};

export const listNews = async (req, res) => {
  const payload = await getPaginatedNews({
    tag: req.query.tag,
    title: req.query.title,
    date: req.query.date,
    month: req.query.month,
    page: req.query.page,
    favoriteLinks: req.query.favoritesOnly === "true" ? req.user?.favoriteLinks || [] : undefined,
    userFavoriteLinks: req.user?.favoriteLinks || [],
    userLikedLinks: req.user?.likedLinks || [],
    userDislikedLinks: req.user?.dislikedLinks || [],
    language: resolvePreferredLanguage({
      queryLanguage: req.query.language,
      userLanguage: req.user?.preferredLanguage,
    }),
  });
  res.status(200).json(payload);
};

export const getArticle = async (req, res) => {
  const article = await getArticleByLink({
    link: req.query.link,
    userFavoriteLinks: req.user?.favoriteLinks || [],
    userLikedLinks: req.user?.likedLinks || [],
    userDislikedLinks: req.user?.dislikedLinks || [],
    language: resolvePreferredLanguage({
      queryLanguage: req.query.language,
      userLanguage: req.user?.preferredLanguage,
    }),
  });

  if (!article) {
    throw badRequest("Article not found");
  }

  res.status(200).json({ item: article });
};

export const filterNews = async (req, res) => {
  const payload = await getPaginatedNews({
    tag: req.body?.tag,
    title: req.body?.title,
    date: req.body?.date,
    month: req.body?.month,
    page: req.body?.page,
    favoriteLinks: req.body?.favoritesOnly ? req.user?.favoriteLinks || [] : undefined,
    userFavoriteLinks: req.user?.favoriteLinks || [],
    userLikedLinks: req.user?.likedLinks || [],
    userDislikedLinks: req.user?.dislikedLinks || [],
    language: resolvePreferredLanguage({
      queryLanguage: req.body?.language,
      userLanguage: req.user?.preferredLanguage,
    }),
  });
  res.status(200).json(payload);
};

export const listTags = async (_req, res) => {
  const items = await getAvailableTags();
  res.status(200).json({ items });
};

export const toggleFavorite = async (req, res) => {
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
};

export const toggleLike = async (req, res) => {
  const { link } = req.body || {};
  if (!link) {
    throw badRequest("Link is required");
  }

  await upsertArticleIfMissing(req.body);
  const alreadyLiked = (req.user.likedLinks || []).includes(link);
  const updatedUser = await req.user.constructor.findByIdAndUpdate(
    req.user._id,
    alreadyLiked
      ? { $pull: { likedLinks: link } }
      : {
          $addToSet: { likedLinks: link },
          $pull: { dislikedLinks: link },
        },
    { new: true },
  );

  req.user = updatedUser;
  res.status(200).json({
    liked: !alreadyLiked,
    disliked: false,
    user: sanitizeUser(updatedUser),
  });
};

export const toggleDislike = async (req, res) => {
  const { link } = req.body || {};
  if (!link) {
    throw badRequest("Link is required");
  }

  await upsertArticleIfMissing(req.body);
  const alreadyDisliked = (req.user.dislikedLinks || []).includes(link);
  const updatedUser = await req.user.constructor.findByIdAndUpdate(
    req.user._id,
    alreadyDisliked
      ? { $pull: { dislikedLinks: link } }
      : {
          $addToSet: { dislikedLinks: link },
          $pull: { likedLinks: link },
        },
    { new: true },
  );

  req.user = updatedUser;
  res.status(200).json({
    liked: false,
    disliked: !alreadyDisliked,
    user: sanitizeUser(updatedUser),
  });
};

export const getLegacyHinduFeed = async (_req, res) => {
  const payload = await syncNewsFromRss();
  res.status(200).json(payload);
};
