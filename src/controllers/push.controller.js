import {
  getPushPublicKey,
  isPushEnabled,
  listUserPushSubscriptions,
  removePushSubscription,
  savePushSubscription,
  sendWelcomePushNotification,
} from "../services/push.service.js";
import { badRequest } from "../utils/http.js";

export const getPublicKey = async (_req, res) => {
  if (!isPushEnabled()) {
    throw badRequest("Push notifications are not configured");
  }

  res.status(200).json({ publicKey: getPushPublicKey() });
};

export const getSubscriptions = async (req, res) => {
  const items = await listUserPushSubscriptions(req.user._id);
  res.status(200).json({ items });
};

export const subscribe = async (req, res) => {
  const item = await savePushSubscription({
    userId: req.user._id,
    subscription: req.body?.subscription,
    userAgent: req.headers["user-agent"] || "",
  });
  await sendWelcomePushNotification(req.user._id);
  res.status(201).json({ item });
};

export const unsubscribe = async (req, res) => {
  await removePushSubscription({
    userId: req.user._id,
    endpoint: req.body?.endpoint,
  });
  res.status(200).json({ ok: true });
};
