import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import { News } from "../model/news.model.js";
import { Comment } from "../model/comment.model.js";
import { User } from "../model/user.model.js";
import { env } from "../config/env.js";
import { getExternalBlogModel } from "../config/database.js";
import { notifyUsersAboutMatchingArticles } from "./push.service.js";
import {
  buildDateKeys,
  buildNeutralSummary,
  clusterArticles,
  escapeRegex,
  inferFallbackTags,
  normalizeFeedItem,
  normalizeTitleKey,
  sanitizeTags,
  scoreSemanticMatch,
} from "../utils/news-intelligence.js";
import {
  buildTranslationSummary,
  translateArticleIfNeeded,
  translateArticlesIfNeeded,
} from "./translation.service.js";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rustRssFetcherManifestPath = join(__dirname, "..", "..", "rss-fetcher", "Cargo.toml");
const CACHE_TTL_MS = 10 * 60 * 1000;

let feedCache = { data: null, ts: 0 };

const runRustRssFetcher = async (rssUrl) => {
  const command = env.RUST_RSS_FETCHER_BIN || "cargo";
  const args = env.RUST_RSS_FETCHER_BIN
    ? [rssUrl]
    : ["run", "--quiet", "--manifest-path", rustRssFetcherManifestPath, "--", rssUrl];

  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: join(__dirname, "..", ".."),
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  });

  const payload = stdout.trim();
  if (!payload) {
    throw new Error(stderr?.trim() || "Rust RSS fetcher returned empty output.");
  }

  return JSON.parse(payload);
};

const runNodeRssFetcher = async (rssUrl) => {
  const response = await axios.get(rssUrl, {
    timeout: 10000,
    headers: {
      "User-Agent": "Mozilla/5.0 (News Intelligence Feed Reader)",
    },
  });

  const parsed = await parseStringPromise(response.data, {
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
  });

  const channel = parsed?.rss?.channel || {};
  let items = channel.item || [];

  if (!Array.isArray(items)) {
    items = items ? [items] : [];
  }

  return {
    channel: {
      title: channel.title,
      link: channel.link,
      lastBuildDate: channel.lastBuildDate,
    },
    items,
  };
};

const dedupeNormalizedItems = (items) => {
  const articlesByFingerprint = new Map();

  for (const article of items) {
    const existing = articlesByFingerprint.get(article.fingerprint);

    if (!existing) {
      articlesByFingerprint.set(article.fingerprint, article);
      continue;
    }

    const existingCompleteness =
      (existing.description?.length || 0) + (existing.entities?.length || 0) * 10;
    const nextCompleteness =
      (article.description?.length || 0) + (article.entities?.length || 0) * 10;
    const preferredArticle = nextCompleteness >= existingCompleteness ? article : existing;
    const secondaryArticle = preferredArticle === article ? existing : article;

    preferredArticle.duplicateLinks = [...new Set([...(preferredArticle.duplicateLinks || []), secondaryArticle.link])];
    articlesByFingerprint.set(article.fingerprint, preferredArticle);
  }

  return [...articlesByFingerprint.values()];
};

const attachMatchingBlogs = async (articles) => {
  if (!articles.length) {
    return articles;
  }

  const externalBlogModel = getExternalBlogModel();
  const articleLinks = articles.map((article) => article.link).filter(Boolean);
  const articleTitles = articles.map((article) => article.title?.trim()).filter(Boolean);
  const blogCandidates = await externalBlogModel
    .find({
      $or: [
        articleLinks.length ? { url: { $in: articleLinks } } : null,
        articleLinks.length ? { sourceUrl: { $in: articleLinks } } : null,
        articleTitles.length ? { title: { $in: articleTitles } } : null,
      ].filter(Boolean),
    })
    .select({ _id: 1, title: 1, url: 1, sourceUrl: 1 })
    .lean();

  const blogByUrl = new Map();
  const blogBySourceUrl = new Map();
  const blogByTitle = new Map();

  for (const blog of blogCandidates) {
    if (blog.url) {
      blogByUrl.set(blog.url, blog);
    }

    if (blog.sourceUrl) {
      blogBySourceUrl.set(blog.sourceUrl, blog);
    }

    if (blog.title) {
      blogByTitle.set(normalizeTitleKey(blog.title), blog);
    }
  }

  return articles.map((article) => {
    const matchedBlog =
      blogBySourceUrl.get(article.link) ||
      blogByUrl.get(article.link) ||
      (article.title ? blogByTitle.get(normalizeTitleKey(article.title)) : null);

    return {
      ...article,
      blogId: matchedBlog?._id?.toString() || null,
      blogUrl: matchedBlog ? `${env.BLOG_FRONT_END_URI}/${matchedBlog._id}` : "",
    };
  });
};

const attachEngagementCounts = async (articles) => {
  if (!articles.length) {
    return articles;
  }

  const articleLinks = [...new Set(articles.map((article) => article.link).filter(Boolean))];
  const [likeCounts, dislikeCounts, commentCounts] = await Promise.all([
    User.aggregate([
      { $match: { likedLinks: { $in: articleLinks } } },
      { $unwind: "$likedLinks" },
      { $match: { likedLinks: { $in: articleLinks } } },
      { $group: { _id: "$likedLinks", count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { dislikedLinks: { $in: articleLinks } } },
      { $unwind: "$dislikedLinks" },
      { $match: { dislikedLinks: { $in: articleLinks } } },
      { $group: { _id: "$dislikedLinks", count: { $sum: 1 } } },
    ]),
    Comment.aggregate([
      { $match: { newsLink: { $in: articleLinks } } },
      { $group: { _id: "$newsLink", count: { $sum: 1 } } },
    ]),
  ]);

  const likeCountMap = new Map(likeCounts.map((item) => [item._id, item.count]));
  const dislikeCountMap = new Map(dislikeCounts.map((item) => [item._id, item.count]));
  const commentCountMap = new Map(commentCounts.map((item) => [item._id, item.count]));

  return articles.map((article) => ({
    ...article,
    likeCount: likeCountMap.get(article.link) || 0,
    dislikeCount: dislikeCountMap.get(article.link) || 0,
    commentCount: commentCountMap.get(article.link) || 0,
  }));
};

export const syncNewsFromRss = async (rssUrl = env.HINDU_HOME_RSS, options = {}) => {
  const { language = "en" } = options;
  if (feedCache.data && Date.now() - feedCache.ts < CACHE_TTL_MS && rssUrl === env.HINDU_HOME_RSS) {
    const translatedItems = await translateArticlesIfNeeded(feedCache.data.items, language);
    return {
      ...feedCache.data,
      items: translatedItems,
      language,
      translation: buildTranslationSummary(translatedItems, language),
    };
  }

  let fetchedFeed;

  try {
    fetchedFeed = await runRustRssFetcher(rssUrl);
  } catch (error) {
    console.warn("Rust RSS fetcher failed, falling back to Node fetcher:", error?.message || error);
    fetchedFeed = await runNodeRssFetcher(rssUrl);
  }

  const channel = fetchedFeed?.channel || {};
  const candidateItems = (Array.isArray(fetchedFeed?.items) ? fetchedFeed.items : [])
    .filter((item) => item?.link)
    .map((item) =>
      normalizeFeedItem(item, {
        sourceName: channel.title || "RSS Feed",
        title: channel.title || "RSS Feed",
      }),
    );
  const existingArticles = candidateItems.length
    ? await News.find({
        $or: [
          { link: { $in: candidateItems.map((item) => item.link) } },
          { fingerprint: { $in: candidateItems.map((item) => item.fingerprint) } },
        ],
      })
        .select({ link: 1, fingerprint: 1 })
        .lean()
    : [];
  const existingKeys = new Set(
    existingArticles.flatMap((item) => [item.link, item.fingerprint].filter(Boolean)),
  );
  const normalizedItems = dedupeNormalizedItems(
    candidateItems,
  );
  const newArticles = normalizedItems.filter(
    (article) => !existingKeys.has(article.link) && !existingKeys.has(article.fingerprint),
  );

  if (normalizedItems.length) {
    await News.bulkWrite(
      normalizedItems.map((article) => ({
        updateOne: {
          filter: {
            $or: [{ link: article.link }, { fingerprint: article.fingerprint }],
          },
          update: {
            $set: {
              ...article,
              duplicateLinks: article.duplicateLinks || [],
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  const basePayload = {
    source: channel.title || "RSS Feed",
    title: channel.title,
    link: channel.link,
    updated: channel.lastBuildDate,
    count: normalizedItems.length,
    items: normalizedItems,
  };

  if (rssUrl === env.HINDU_HOME_RSS) {
    feedCache = { data: basePayload, ts: Date.now() };
  }

  if (newArticles.length) {
    await notifyUsersAboutMatchingArticles(newArticles);
  }

  const translatedItems = await translateArticlesIfNeeded(basePayload.items, language);

  return {
    ...basePayload,
    items: translatedItems,
    language,
    translation: buildTranslationSummary(translatedItems, language),
  };
};

const buildNewsQuery = ({ tag, title, date, month, favoriteLinks }) => {
  const query = {};

  if (Array.isArray(favoriteLinks)) {
    query.link = favoriteLinks.length ? { $in: favoriteLinks } : { $in: [] };
  }

  const normalizedTags = String(tag || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (normalizedTags.length === 1) {
    query.tags = normalizedTags[0];
  } else if (normalizedTags.length > 1) {
    query.tags = { $in: normalizedTags };
  }

  if (title?.trim()) {
    query.title = { $regex: escapeRegex(title.trim()), $options: "i" };
  }

  if (date?.trim()) {
    query.publishedDateKey = date.trim();
  } else if (month?.trim()) {
    query.publishedMonthKey = month.trim();
  }

  return query;
};

const decorateArticle = (article, favoriteSet, likedSet, dislikedSet) => {
  const tags = sanitizeTags(
    Array.isArray(article.tags) && article.tags.length > 0
      ? article.tags
      : inferFallbackTags(article),
  );

  return {
    ...article,
    tags,
    isFavorite: favoriteSet.has(article.link),
    isLiked: likedSet.has(article.link),
    isDisliked: dislikedSet.has(article.link),
  };
};

export const getPaginatedNews = async ({
  tag,
  title,
  date,
  month,
  page,
  favoriteLinks,
  userFavoriteLinks,
  userLikedLinks,
  userDislikedLinks,
  language = "en",
}) => {
  const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const limit = 4;
  const skip = (normalizedPage - 1) * limit;
  const query = buildNewsQuery({ tag, title, date, month, favoriteLinks });
  const favoriteSet = new Set(userFavoriteLinks || []);
  const likedSet = new Set(userLikedLinks || []);
  const dislikedSet = new Set(userDislikedLinks || []);

  const [news, total] = await Promise.all([
    News.find(query)
      .sort({ publishedAt: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    News.countDocuments(query),
  ]);

  const newsWithBlogs = await attachMatchingBlogs(news);
  const newsWithEngagement = await attachEngagementCounts(newsWithBlogs);

  const translatedItems = await translateArticlesIfNeeded(
    newsWithEngagement.map((article) =>
      decorateArticle(article, favoriteSet, likedSet, dislikedSet),
    ),
    language,
  );

  return {
    count: news.length,
    total,
    page: normalizedPage,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    items: translatedItems,
    language,
    translation: buildTranslationSummary(translatedItems, language),
  };
};

export const getArticleByLink = async ({
  link,
  userFavoriteLinks,
  userLikedLinks,
  userDislikedLinks,
  language = "en",
}) => {
  const article = await News.findOne({ link: (link || "").trim() }).lean();

  if (!article) {
    return null;
  }

  const [articleWithBlog] = await attachMatchingBlogs([article]);
  const [articleWithEngagement] = await attachEngagementCounts([articleWithBlog]);

  return translateArticleIfNeeded(
    decorateArticle(
      articleWithEngagement,
      new Set(userFavoriteLinks || []),
      new Set(userLikedLinks || []),
      new Set(userDislikedLinks || []),
    ),
    language,
  );
};

export const upsertArticleIfMissing = async (payload) => {
  const link = payload?.link?.trim();
  if (!link) {
    return null;
  }

  let article = await News.findOne({ link });
  if (article) {
    return article;
  }

  const publishedAt = payload?.pubDate ? new Date(payload.pubDate) : null;
  const normalizedPublishedAt = Number.isNaN(publishedAt?.getTime()) ? null : publishedAt;
  const dateKeys = buildDateKeys(normalizedPublishedAt);
  const normalizedArticle = normalizeFeedItem(
    {
      ...payload,
      pubDate: payload?.pubDate || "",
      description: payload?.description || "",
      title: payload?.title || "",
    },
    { sourceName: "User Seeded Article", title: "User Seeded Article" },
  );

  article = await News.create({
    ...normalizedArticle,
    publishedAt: normalizedPublishedAt,
    ...dateKeys,
  });
  feedCache = { data: null, ts: 0 };

  return article;
};

export const getAvailableTags = async () => {
  const [storedTags, untaggedArticles] = await Promise.all([
    News.distinct("tags"),
    News.find({
      $or: [{ tags: { $exists: false } }, { tags: { $size: 0 } }],
    })
      .select({ title: 1, description: 1, link: 1, category: 1, subCategory: 1 })
      .lean(),
  ]);

  const inferredTags = untaggedArticles.flatMap((article) => inferFallbackTags(article));
  return sanitizeTags([...storedTags, ...inferredTags])
    .sort((left, right) => left.localeCompare(right));
};

export const buildIntelligenceOverview = async () => {
  const articles = await News.find({})
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(150)
    .lean();
  const clusters = clusterArticles(articles);

  return {
    eventCount: clusters.length,
    articleCount: articles.length,
    breakingCount: clusters.filter((cluster) => cluster.articleCount >= 2).length,
    topEvents: clusters.slice(0, 5).map((cluster) => ({
      id: cluster.id,
      title: cluster.title,
      summary: cluster.summary,
      articleCount: cluster.articleCount,
      sourceCount: cluster.sourceCount,
      corroborationLabel: cluster.corroborationLabel,
      entities: cluster.entities,
      coverageShift: cluster.coverageShift,
      updatedAt: cluster.updatedAt,
    })),
  };
};

export const listEventClusters = async () => {
  const articles = await News.find({})
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(200)
    .lean();

  return clusterArticles(articles);
};

export const getEventTimeline = async (eventId) => {
  const clusters = await listEventClusters();
  return clusters.find((cluster) => cluster.id === eventId) || null;
};

export const runSemanticSearch = async ({
  query,
  userFavoriteLinks,
  userLikedLinks,
  userDislikedLinks,
}) => {
  const articles = await News.find({})
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(200)
    .lean();
  const favoriteSet = new Set(userFavoriteLinks || []);
  const likedSet = new Set(userLikedLinks || []);
  const dislikedSet = new Set(userDislikedLinks || []);

  const matchingArticles = articles
    .map((article) => ({
      ...article,
      semanticScore: scoreSemanticMatch(article, query),
      summary: buildNeutralSummary([article]),
    }))
    .filter((article) => article.semanticScore > 0)
    .sort((left, right) => right.semanticScore - left.semanticScore)
    .slice(0, 20);

  const articlesWithBlogs = await attachMatchingBlogs(matchingArticles);
  const articlesWithEngagement = await attachEngagementCounts(articlesWithBlogs);

  return articlesWithEngagement.map((article) =>
    decorateArticle(article, favoriteSet, likedSet, dislikedSet),
  );
};

export const warmNewsIntelligence = async () => {
  await syncNewsFromRss();
};
