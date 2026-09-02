import axios from "axios";
import { env } from "../config/env.js";
import { getCachedJson, setCachedJson } from "../config/redis.js";
import {
  DEFAULT_LANGUAGE_CODE,
  GOOGLE_SUPPORTED_LANGUAGE_CODES,
  LANGUAGE_TARGET_BY_CODE,
  SUPPORTED_LANGUAGE_CODES,
} from "../config/languages.js";

const TRANSLATION_BATCH_SIZE = 1;
const UI_TRANSLATION_CACHE_TTL_SECONDS = 24 * 60 * 60;
const UI_TRANSLATION_CACHE = new Map();

const buildTranslatableArticle = (article) => ({
  title: article?.title || "",
  description: article?.description || "",
  category: article?.category || "",
  subCategory: article?.subCategory || "",
  tags: Array.isArray(article?.tags) ? article.tags : [],
});

const mergeTranslatedArticle = (article, translated = {}, language) => ({
  ...article,
  title: translated.title || article.title,
  description: translated.description || article.description,
  category: translated.category || article.category,
  subCategory: translated.subCategory || article.subCategory,
  tags: Array.isArray(translated.tags) && translated.tags.length ? translated.tags : article.tags,
  translatedLanguage: language,
});

const chunkItems = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const buildSkippedArticle = (article) => ({
  ...article,
  translatedLanguage: DEFAULT_LANGUAGE_CODE,
  translationSkipped: true,
});

const getTranslationErrorDetails = (error) => ({
  message: error?.message || "Unknown translation error",
  status: error?.response?.status || null,
  detail: error?.response?.data?.detail || error?.response?.data?.message || null,
  url: error?.config?.url || null,
});

const requestTranslatedBatch = async (articles, language) => {
  const response = await axios.post(
    `${env.TRANSLATION_SERVICE_URL}/translate/articles`,
    {
      source_language: "english",
      target_language: LANGUAGE_TARGET_BY_CODE.get(language) || language,
      items: articles.map(buildTranslatableArticle),
    },
    {
      timeout: env.TRANSLATION_SERVICE_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        ...(env.TRANSLATION_SERVICE_API_KEY
          ? { "x-api-key": env.TRANSLATION_SERVICE_API_KEY }
          : {}),
      },
    },
  );

  const translatedItems = Array.isArray(response.data?.items) ? response.data.items : [];

  return articles.map((article, index) =>
    mergeTranslatedArticle(article, translatedItems[index] || {}, language),
  );
};

const requestTranslatedTexts = async (texts, language) => {
  const response = await axios.post(
    `${env.TRANSLATION_SERVICE_URL}/translate/texts`,
    {
      source_language: "english",
      target_language: LANGUAGE_TARGET_BY_CODE.get(language) || language,
      texts,
    },
    {
      timeout: env.TRANSLATION_SERVICE_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        ...(env.TRANSLATION_SERVICE_API_KEY
          ? { "x-api-key": env.TRANSLATION_SERVICE_API_KEY }
          : {}),
      },
    },
  );

  return Array.isArray(response.data?.texts) ? response.data.texts : [];
};

export const resolvePreferredLanguage = ({ queryLanguage, userLanguage }) => {
  const normalizedQueryLanguage =
    typeof queryLanguage === "string" ? queryLanguage.trim() : "";
  const normalizedUserLanguage =
    typeof userLanguage === "string" ? userLanguage.trim() : "";

  if (SUPPORTED_LANGUAGE_CODES.has(normalizedQueryLanguage)) {
    return normalizedQueryLanguage;
  }

  if (SUPPORTED_LANGUAGE_CODES.has(normalizedUserLanguage)) {
    return normalizedUserLanguage;
  }

  return DEFAULT_LANGUAGE_CODE;
};

export const translateArticlesIfNeeded = async (articles, language) => {
  if (
    language === DEFAULT_LANGUAGE_CODE ||
    !SUPPORTED_LANGUAGE_CODES.has(language) ||
    !GOOGLE_SUPPORTED_LANGUAGE_CODES.has(language) ||
    !Array.isArray(articles) ||
    articles.length === 0
  ) {
    return articles;
  }

  if (!env.TRANSLATION_SERVICE_URL) {
    return articles.map(buildSkippedArticle);
  }

  const batches = chunkItems(articles, TRANSLATION_BATCH_SIZE);
  const translatedResults = await Promise.all(
    batches.map(async (batch) => {
      try {
        return await requestTranslatedBatch(batch, language);
      } catch (error) {
        const details = getTranslationErrorDetails(error);
        console.warn(
          "Translation batch failed, returning English for that batch:",
          details,
        );
        return batch.map(buildSkippedArticle);
      }
    }),
  );

  return translatedResults.flat();
};

export const translateArticleIfNeeded = async (article, language) => {
  if (!article) {
    return article;
  }

  const [translatedArticle] = await translateArticlesIfNeeded([article], language);
  return translatedArticle;
};

export const buildTranslationSummary = (articles, requestedLanguage) => {
  const normalizedArticles = Array.isArray(articles) ? articles : [];
  const translatedCount = normalizedArticles.filter(
    (article) => article?.translatedLanguage === requestedLanguage && !article?.translationSkipped,
  ).length;
  const skippedCount = normalizedArticles.filter((article) => article?.translationSkipped).length;

  return {
    requestedLanguage,
    translatedCount,
    skippedCount,
    active: requestedLanguage !== DEFAULT_LANGUAGE_CODE && translatedCount > 0,
    fallbackToEnglish: requestedLanguage !== DEFAULT_LANGUAGE_CODE && skippedCount > 0,
  };
};

const UI_LABELS = {
  readArticle: "Read article",
  writeOpinion: "Write opinion",
  readBlog: "Read blog",
  shareArticle: "Share article",
  real: "Real",
  manipulative: "Manipulative",
  comment: "Comment",
};

export const getUiTranslations = async (language) => {
  if (
    language === DEFAULT_LANGUAGE_CODE ||
    !SUPPORTED_LANGUAGE_CODES.has(language) ||
    !GOOGLE_SUPPORTED_LANGUAGE_CODES.has(language) ||
    !env.TRANSLATION_SERVICE_URL
  ) {
    return { ...UI_LABELS, language: DEFAULT_LANGUAGE_CODE };
  }

  const cacheKey = `translations:ui:${language}`;
  const redisCachedLabels = await getCachedJson(cacheKey);
  if (redisCachedLabels) {
    return redisCachedLabels;
  }

  if (UI_TRANSLATION_CACHE.has(cacheKey)) {
    return UI_TRANSLATION_CACHE.get(cacheKey);
  }

  try {
    const keys = Object.keys(UI_LABELS);
    const translatedTexts = await requestTranslatedTexts(Object.values(UI_LABELS), language);
    const labels = keys.reduce((accumulator, key, index) => {
      accumulator[key] = translatedTexts[index] || UI_LABELS[key];
      return accumulator;
    }, {});
    const payload = { ...labels, language };
    UI_TRANSLATION_CACHE.set(cacheKey, payload);
    await setCachedJson(cacheKey, payload, UI_TRANSLATION_CACHE_TTL_SECONDS);
    return payload;
  } catch (error) {
    const details = getTranslationErrorDetails(error);
    console.warn(
      "UI translation failed, returning English labels:",
      details,
    );
    return { ...UI_LABELS, language: DEFAULT_LANGUAGE_CODE };
  }
};
