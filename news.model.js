import mongoose from "mongoose";

const newsSchema = new mongoose.Schema({
    title: { type: String, trim: true },
    link: { type: String, unique: true, required: true, trim: true },
    description: { type: String, default: "" },
    pubDate: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
    publishedDateKey: { type: String, default: "" },
    publishedMonthKey: { type: String, default: "" },
    category: { type: String, default: "general" },
    subCategory: { type: String, default: null },
    tags: { type: [String], default: [] },
    blogId: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', default: null }
}, { timestamps: true });

newsSchema.index({ tags: 1 });
newsSchema.index({ publishedDateKey: 1 });
newsSchema.index({ publishedMonthKey: 1 });
export const News = mongoose.model("New", newsSchema);

