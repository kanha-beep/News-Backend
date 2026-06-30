import { createDraftFromArticle, listDrafts, updateDraft } from "../services/blog-draft.service.js";

export const getDrafts = async (req, res) => {
  const items = await listDrafts(req.user._id);
  res.status(200).json({ items });
};

export const createDraft = async (req, res) => {
  const item = await createDraftFromArticle({
    articleLink: req.body?.articleLink,
    notes: req.body?.notes,
    user: req.user,
  });
  res.status(201).json({ item });
};

export const patchDraft = async (req, res) => {
  const item = await updateDraft(req.params.draftId, req.body, req.user._id);
  res.status(200).json({ item });
};
