import { Comment } from "../model/comment.model.js";
import { moderateComment } from "../utils/moderation.js";
import { readString } from "../utils/validation.js";
import { badRequest } from "../utils/http.js";

export const listComments = async (link) => {
  const newsLink = readString(link, "Article link", { required: true, max: 600 });
  const comments = await Comment.find({ newsLink }).sort({ createdAt: -1, _id: -1 }).limit(100).lean();

  return comments.map((comment) => ({
    id: comment._id.toString(),
    content: comment.content,
    userName: comment.userName,
    createdAt: comment.createdAt,
    moderationStatus: comment.moderationStatus || "approved",
  }));
};

export const createComment = async ({ link, content, user }) => {
  const newsLink = readString(link, "Article link", { required: true, max: 600 });
  const normalizedContent = readString(content, "Comment", {
    required: true,
    max: 500,
  });
  const moderation = moderateComment(normalizedContent);

  if (!moderation.accepted) {
    throw badRequest(moderation.reason);
  }

  const comment = await Comment.create({
    newsLink,
    content: normalizedContent,
    user: user._id,
    userName: user.name || user.email,
    moderationStatus: "approved",
  });

  return {
    id: comment._id.toString(),
    content: comment.content,
    userName: comment.userName,
    createdAt: comment.createdAt,
    moderationStatus: "approved",
  };
};
