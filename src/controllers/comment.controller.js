import { createComment, listComments } from "../services/comment.service.js";

export const getComments = async (req, res) => {
  const items = await listComments(req.query.link);
  res.status(200).json({ items });
};

export const addComment = async (req, res) => {
  const item = await createComment({
    link: req.body?.link,
    content: req.body?.content,
    user: req.user,
  });
  res.status(201).json({ item });
};
