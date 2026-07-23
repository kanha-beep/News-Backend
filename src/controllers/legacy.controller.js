import { sanitizeUser } from "../services/auth.service.js";
import { getAvailableTags, syncNewsFromRss, upsertArticleIfMissing } from "../services/news.service.js";
import { resolvePreferredLanguage } from "../services/translation.service.js";
import { badRequest } from "../utils/http.js";

export const getLegacyHindu = async (req, res) => {
  const payload = await syncNewsFromRss(req.query.rssUrl || undefined, {
    language: resolvePreferredLanguage({
      queryLanguage: req.query.language,
      userLanguage: req.user?.preferredLanguage,
    }),
  });
  res.status(200).json(payload);
};

export const getLegacyTags = async (_req, res) => {
  const items = await getAvailableTags();
  res.status(200).json({ items });
};

export const toggleLegacyFavorite = async (req, res) => {
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
};

export const toggleLegacyLike = async (req, res) => {
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
    alreadyLiked
      ? { $pull: { likedLinks: link } }
      : {
          $addToSet: { likedLinks: link },
          $pull: { dislikedLinks: link },
        },
    { new: true },
  );

  res.status(200).json({
    liked: !alreadyLiked,
    disliked: false,
    user: sanitizeUser(updatedUser),
  });
};

export const toggleLegacyDislike = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

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

  res.status(200).json({
    liked: false,
    disliked: !alreadyDisliked,
    user: sanitizeUser(updatedUser),
  });
};
