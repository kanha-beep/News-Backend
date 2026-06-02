import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, badRequest } from "../utils/http.js";
import {
  getPushPublicKey,
  isPushEnabled,
  listUserPushSubscriptions,
  removePushSubscription,
  savePushSubscription,
  sendWelcomePushNotification,
} from "../services/push.service.js";

export const pushRouter = Router();

pushRouter.get(
  "/public-key",
  asyncHandler(async (_req, res) => {
    if (!isPushEnabled()) {
      throw badRequest("Push notifications are not configured");
    }

    res.status(200).json({ publicKey: getPushPublicKey() });
  }),
);

pushRouter.get(
  "/subscriptions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await listUserPushSubscriptions(req.user._id);
    res.status(200).json({ items });
  }),
);

pushRouter.post(
  "/subscribe",
  requireAuth,
  asyncHandler(async (req, res) => {
    const item = await savePushSubscription({
      userId: req.user._id,
      subscription: req.body?.subscription,
      userAgent: req.headers["user-agent"] || "",
    });
    await sendWelcomePushNotification(req.user._id);
    res.status(201).json({ item });
  }),
);

pushRouter.post(
  "/unsubscribe",
  requireAuth,
  asyncHandler(async (req, res) => {
    await removePushSubscription({
      userId: req.user._id,
      endpoint: req.body?.endpoint,
    });
    res.status(200).json({ ok: true });
  }),
);
