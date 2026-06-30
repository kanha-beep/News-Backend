import mongoose from "mongoose";

const visitSchema = new mongoose.Schema(
    {
        pageUrl: { type: String, default: "", trim: true },
        path: { type: String, default: "", trim: true },
        title: { type: String, default: "", trim: true },
        referrer: { type: String, default: "", trim: true },
        ipAddress: { type: String, default: "", trim: true },
        userAgent: { type: String, default: "", trim: true },
        browser: { type: String, default: "", trim: true },
        deviceType: { type: String, default: "", trim: true },
        os: { type: String, default: "", trim: true },
        screen: { type: String, default: "", trim: true },
        timezone: { type: String, default: "", trim: true },
        language: { type: String, default: "", trim: true },
        country: { type: String, default: "", trim: true },
        region: { type: String, default: "", trim: true },
        city: { type: String, default: "", trim: true }
    },
    { timestamps: true }
);

visitSchema.index({ createdAt: -1 });
visitSchema.index({ path: 1, createdAt: -1 });

export const Visit = mongoose.model("Visit", visitSchema);
