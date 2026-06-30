import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true, trim: true },
    expirationTime: { type: Date, default: null },
    keys: {
      p256dh: { type: String, required: true, trim: true },
      auth: { type: String, required: true, trim: true },
    },
    userAgent: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
    lastNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

pushSubscriptionSchema.index({ user: 1, isActive: 1 });

export const PushSubscriptionModel = mongoose.model("PushSubscription", pushSubscriptionSchema);
