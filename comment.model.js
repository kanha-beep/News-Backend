import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
    {
        newsLink: { type: String, required: true, trim: true, index: true },
        content: { type: String, required: true, trim: true, maxlength: 500 },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        userName: { type: String, required: true, trim: true, maxlength: 120 }
    },
    { timestamps: true }
);

commentSchema.index({ newsLink: 1, createdAt: -1 });

export const Comment = mongoose.model("Comment", commentSchema);
