import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: [String],
      default: [],
    },
    likes: {
      type: Number,
      default: 0,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
  },
  {
    timestamps: true,
    strict: false,
    collection: "blogs",
  },
);

export const Blog = mongoose.models.Blog || mongoose.model("Blog", blogSchema);
