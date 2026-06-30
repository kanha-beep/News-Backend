import mongoose from "mongoose";

const blogDraftSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourceArticleLink: { type: String, required: true, trim: true },
    sourceArticleTitle: { type: String, default: "", trim: true },
    headline: { type: String, default: "", trim: true },
    summary: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    content: { type: String, default: "" },
    status: { type: String, default: "draft", trim: true },
  },
  { timestamps: true },
);

blogDraftSchema.index({ user: 1, updatedAt: -1 });

export const BlogDraft = mongoose.model("BlogDraft", blogDraftSchema);
