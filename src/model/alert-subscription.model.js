import mongoose from "mongoose";

const alertSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["topic", "breaking"], required: true },
    topic: { type: String, required: true, trim: true },
    keywords: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

alertSubscriptionSchema.index({ user: 1, enabled: 1 });

export const AlertSubscription = mongoose.model("AlertSubscription", alertSubscriptionSchema);
