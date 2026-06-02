import mongoose from "mongoose";
import { AlertSubscription } from "../../alert-subscription.model.js";
import { News } from "../../news.model.js";
import { badRequest } from "../utils/http.js";
import { readOptionalBoolean, readString } from "../utils/validation.js";

export const listAlerts = async (userId) =>
  AlertSubscription.find({ user: userId }).sort({ createdAt: -1 }).lean();

export const createAlert = async (payload, userId) => {
  const type = readString(payload?.type, "Alert type", { required: true, max: 40 }).toLowerCase();
  const topic = readString(payload?.topic, "Topic", { required: true, max: 120 });

  if (!["topic", "breaking"].includes(type)) {
    throw badRequest("Alert type must be topic or breaking");
  }

  return AlertSubscription.create({
    user: userId,
    type,
    topic,
    keywords: topic
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
    enabled: true,
  });
};

export const toggleAlert = async (alertId, enabled, userId) => {
  if (!mongoose.isValidObjectId(alertId)) {
    throw badRequest("Invalid alert id");
  }

  const alert = await AlertSubscription.findOneAndUpdate(
    { _id: alertId, user: userId },
    { $set: { enabled: readOptionalBoolean(enabled) } },
    { new: true },
  );

  if (!alert) {
    throw badRequest("Alert not found");
  }

  return alert;
};

export const deleteAlert = async (alertId, userId) => {
  if (!mongoose.isValidObjectId(alertId)) {
    throw badRequest("Invalid alert id");
  }

  const alert = await AlertSubscription.findOneAndDelete({
    _id: alertId,
    user: userId,
  });

  if (!alert) {
    throw badRequest("Alert not found");
  }

  return alert;
};

export const checkAlerts = async (userId) => {
  const [alerts, recentArticles] = await Promise.all([
    AlertSubscription.find({ user: userId }).sort({ createdAt: -1 }).lean(),
    News.find({}).sort({ publishedAt: -1, createdAt: -1 }).limit(100).lean(),
  ]);

  return alerts.map((alert) => {
    const matchedArticles = alert.enabled
      ? recentArticles.filter((article) => {
          const haystack = `${article.title || ""} ${article.description || ""} ${(article.tags || []).join(" ")}`.toLowerCase();
          return (alert.keywords || []).every((keyword) => haystack.includes(keyword));
        })
      : [];

    return {
      ...alert,
      matchCount: matchedArticles.length,
      latestMatch: matchedArticles[0] || null,
      matches: matchedArticles.slice(0, 3).map((article) => ({
        title: article.title,
        link: article.link,
        pubDate: article.pubDate,
        sourceName: article.sourceName,
      })),
    };
  });
};
