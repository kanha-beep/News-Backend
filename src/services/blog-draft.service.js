import mongoose from "mongoose";
import { BlogDraft } from "../../blog-draft.model.js";
import { News } from "../../news.model.js";
import { badRequest } from "../utils/http.js";
import { buildNeutralSummary } from "../utils/news-intelligence.js";

export const listDrafts = async (userId) =>
  BlogDraft.find({ user: userId }).sort({ updatedAt: -1 }).lean();

export const createDraftFromArticle = async ({ articleLink, notes, user }) => {
  const normalizedLink = (articleLink || "").trim();
  if (!normalizedLink) {
    throw badRequest("Article link is required");
  }

  const article = await News.findOne({ link: normalizedLink }).lean();
  if (!article) {
    throw badRequest("Article not found");
  }

  const draft = await BlogDraft.create({
    user: user._id,
    sourceArticleLink: article.link,
    sourceArticleTitle: article.title,
    status: "draft",
    headline: `Perspective: ${article.title}`,
    summary: buildNeutralSummary([article]),
    notes: (notes || "").trim(),
    content: [
      `## Why this story matters`,
      buildNeutralSummary([article]),
      "",
      `## What happened`,
      article.description || article.title,
      "",
      `## Your angle`,
      "Add your reporting, analysis, or first-person perspective here.",
    ].join("\n"),
  });

  return draft;
};

export const updateDraft = async (draftId, payload, userId) => {
  if (!mongoose.isValidObjectId(draftId)) {
    throw badRequest("Invalid draft id");
  }

  const draft = await BlogDraft.findOneAndUpdate(
    { _id: draftId, user: userId },
    {
      $set: {
        headline: typeof payload?.headline === "string" ? payload.headline.trim() : undefined,
        summary: typeof payload?.summary === "string" ? payload.summary.trim() : undefined,
        notes: typeof payload?.notes === "string" ? payload.notes.trim() : undefined,
        content: typeof payload?.content === "string" ? payload.content : undefined,
        status: typeof payload?.status === "string" ? payload.status.trim() : undefined,
      },
    },
    { new: true },
  );

  if (!draft) {
    throw badRequest("Draft not found");
  }

  return draft;
};
