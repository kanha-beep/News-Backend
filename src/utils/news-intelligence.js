const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
]);

export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeTitleKey = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const parsePublishedAt = (pubDate) => {
  const date = pubDate ? new Date(pubDate) : null;
  return Number.isNaN(date?.getTime()) ? null : date;
};

export const buildDateKeys = (publishedAt) => {
  if (!publishedAt) {
    return {
      publishedDateKey: "",
      publishedMonthKey: "",
    };
  }

  const year = publishedAt.getFullYear();
  const month = String(publishedAt.getMonth() + 1).padStart(2, "0");
  const day = String(publishedAt.getDate()).padStart(2, "0");

  return {
    publishedDateKey: `${year}-${month}-${day}`,
    publishedMonthKey: `${year}-${month}`,
  };
};

export const getCategoryDetails = (urlStr) => {
  try {
    const url = new URL(urlStr);
    const segments = url.pathname.split("/").filter(Boolean);

    return {
      level1: segments[0] || "general",
      level2: segments[1] || null,
      level3: segments[2] || null,
    };
  } catch {
    return { level1: "general", level2: null, level3: null };
  }
};

export const tokenize = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));

export const buildFingerprint = (title = "") => tokenize(title).slice(0, 8).join("-");

export const extractEntities = (article) => {
  const text = `${article.title || ""} ${article.description || ""}`;
  const matches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g) || [];
  return [...new Set(matches)].slice(0, 8);
};

export const getTags = (item) => {
  const title = (item.title || "").toLowerCase();
  const desc = (item.description || "").toLowerCase();
  const url = (item.link || "").toLowerCase();
  const text = `${title} ${desc}`;
  const tags = [];

  if (url.includes("/sport/")) tags.push("sports");
  if (url.includes("/news/international/")) tags.push("international");
  if (url.includes("/business/")) tags.push("economy");
  if (url.includes("/opinion/")) tags.push("opinion");
  if (/(minister|cabinet|parliament|bjp|congress|election|chief minister|prime minister)/.test(text)) tags.push("politics");
  if (/(student|exam|university|admission|school|cet)/.test(text)) tags.push("education");
  if (/(arrest|assault|murder|theft|robbery|police|court|case)/.test(text)) tags.push("crime");
  if (/(ganja|narcotic|drug|contraband|smuggling)/.test(text)) tags.push("drugs");
  if (/(hospital|doctor|health|disease|vaccine)/.test(text)) tags.push("health");

  return [...new Set(tags)];
};

export const normalizeFeedItem = (item, feedContext = {}) => {
  const publishedAt = parsePublishedAt(item.pubDate);
  const dateKeys = buildDateKeys(publishedAt);
  const category = getCategoryDetails(item.link);
  const sourceDomain = (() => {
    try {
      return new URL(item.link).hostname.replace(/^www\./, "");
    } catch {
      return "unknown";
    }
  })();

  const normalized = {
    title: item.title || "",
    link: item.link,
    canonicalLink: item.link,
    pubDate: item.pubDate || "",
    publishedAt,
    publishedDateKey: dateKeys.publishedDateKey,
    publishedMonthKey: dateKeys.publishedMonthKey,
    description: item.description || "",
    guid: item.guid?._ || item.guid || "",
    category: category.level1,
    subCategory: category.level2,
    tags: [],
    sourceName: feedContext.sourceName || feedContext.title || "Unknown source",
    sourceDomain,
    normalizedTitle: normalizeTitleKey(item.title || ""),
    fingerprint: buildFingerprint(item.title || item.link || ""),
    entities: [],
  };

  normalized.tags = getTags(normalized);
  normalized.entities = extractEntities(normalized);

  return normalized;
};

export const scoreSimilarity = (leftArticle, rightArticle) => {
  const leftTokens = new Set(tokenize(`${leftArticle.title} ${leftArticle.description}`));
  const rightTokens = new Set(tokenize(`${rightArticle.title} ${rightArticle.description}`));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / Math.max(leftTokens.size, rightTokens.size);
};

export const clusterArticles = (articles) => {
  const clusters = [];

  for (const article of articles) {
    const cluster = clusters.find((currentCluster) => {
      const representative = currentCluster.articles[0];
      return (
        article.fingerprint === representative.fingerprint ||
        scoreSimilarity(article, representative) >= 0.45
      );
    });

    if (cluster) {
      cluster.articles.push(article);
      continue;
    }

    clusters.push({
      id: article.fingerprint || article._id?.toString() || article.link,
      articles: [article],
    });
  }

  return clusters
    .map((cluster) => {
      const sortedArticles = [...cluster.articles].sort((left, right) => {
        const leftTime = new Date(left.publishedAt || left.createdAt || 0).getTime();
        const rightTime = new Date(right.publishedAt || right.createdAt || 0).getTime();
        return rightTime - leftTime;
      });
      const latest = sortedArticles[0];
      const earliest = sortedArticles[sortedArticles.length - 1];
      const allTags = [...new Set(sortedArticles.flatMap((article) => article.tags || []))];
      const allEntities = [...new Set(sortedArticles.flatMap((article) => article.entities || []))];
      const evolvingSummary = buildNeutralSummary(sortedArticles);
      const sourceCount = new Set(sortedArticles.map((article) => article.sourceDomain)).size;
      const corroborationLabel =
        sourceCount > 1
          ? `${sourceCount} sources are covering this event.`
          : "This is currently a single-source signal.";

      return {
        id: cluster.id,
        title: latest?.title || "Untitled event",
        summary: evolvingSummary,
        articleCount: sortedArticles.length,
        sourceCount,
        corroborationLabel,
        tags: allTags.slice(0, 6),
        entities: allEntities.slice(0, 10),
        timeline: sortedArticles.map((article) => ({
          title: article.title,
          link: article.link,
          publishedAt: article.publishedAt,
          sourceName: article.sourceName,
          sourceDomain: article.sourceDomain,
        })),
        coverageShift: describeCoverageShift(sortedArticles),
        startedAt: earliest?.publishedAt || earliest?.createdAt || null,
        updatedAt: latest?.publishedAt || latest?.createdAt || null,
        articles: sortedArticles,
      };
    })
    .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
};

export const buildNeutralSummary = (articles) => {
  const [latest] = articles;
  const entities = [...new Set(articles.flatMap((article) => article.entities || []))].slice(0, 3);
  const tags = [...new Set(articles.flatMap((article) => article.tags || []))].slice(0, 3);

  return [
    latest?.title || "This event is evolving across multiple reports.",
    entities.length ? `Key entities: ${entities.join(", ")}.` : null,
    tags.length ? `Coverage themes: ${tags.join(", ")}.` : null,
    `This cluster combines ${articles.length} related report${articles.length === 1 ? "" : "s"} into one evolving event.`,
  ]
    .filter(Boolean)
    .join(" ");
};

export const describeCoverageShift = (articles) => {
  if (articles.length < 2) {
    return "Coverage is still emerging from a single report.";
  }

  const earliest = articles[articles.length - 1];
  const latest = articles[0];
  const earliestTokens = new Set(tokenize(`${earliest.title} ${earliest.description}`));
  const latestTokens = new Set(tokenize(`${latest.title} ${latest.description}`));
  const newFocus = [...latestTokens].filter((token) => !earliestTokens.has(token)).slice(0, 4);

  if (newFocus.length === 0) {
    return "Coverage remains stable, with later reports reinforcing the same core facts.";
  }

  return `Coverage shifted toward ${newFocus.join(", ")} as the story developed.`;
};

export const scoreSemanticMatch = (article, query) => {
  const queryTokens = new Set(tokenize(query));
  const articleTokens = new Set(tokenize(`${article.title} ${article.description} ${(article.tags || []).join(" ")}`));

  if (queryTokens.size === 0 || articleTokens.size === 0) {
    return 0;
  }

  let score = 0;
  for (const token of queryTokens) {
    if (articleTokens.has(token)) {
      score += 12;
    }
  }

  for (const entity of article.entities || []) {
    if (query.toLowerCase().includes(entity.toLowerCase())) {
      score += 18;
    }
  }

  if ((article.title || "").toLowerCase().includes(query.toLowerCase())) {
    score += 25;
  }

  return score;
};
