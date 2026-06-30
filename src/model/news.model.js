import mongoose from "mongoose";

const newsSchema = new mongoose.Schema({
    title: { type: String, trim: true },
    link: { type: String, unique: true, required: true, trim: true },
    canonicalLink: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    pubDate: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
    publishedDateKey: { type: String, default: "" },
    publishedMonthKey: { type: String, default: "" },
    category: { type: String, default: "general" },
    subCategory: { type: String, default: null },
    tags: { type: [String], default: [] },
    blogId: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', default: null },
    sourceName: { type: String, default: "", trim: true },
    sourceDomain: { type: String, default: "", trim: true },
    normalizedTitle: { type: String, default: "", trim: true },
    fingerprint: { type: String, default: "", trim: true, index: true },
    duplicateLinks: { type: [String], default: [] },
    entities: { type: [String], default: [] }
}, { timestamps: true });

newsSchema.index({ tags: 1 });
newsSchema.index({ publishedDateKey: 1 });
newsSchema.index({ publishedMonthKey: 1 });
newsSchema.index({ sourceDomain: 1, publishedAt: -1 });
export const News = mongoose.model("New", newsSchema);

