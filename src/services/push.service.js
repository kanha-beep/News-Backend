import webpush from "web-push";
import { PushSubscriptionModel } from "../model/push-subscription.model.js";
import { AlertSubscription } from "../model/alert-subscription.model.js";
import { env } from "../config/env.js";
import { badRequest } from "../utils/http.js";

if (env.PUSH_ENABLED) {
  webpush.setVapidDetails(
    env.PUSH_VAPID_SUBJECT,
    env.PUSH_VAPID_PUBLIC_KEY,
    env.PUSH_VAPID_PRIVATE_KEY,
  );
}

const createNotificationPayload = ({ title, body, url }) =>
  JSON.stringify({
    title,
    body,
    url,
    icon: "/lightning-news-logo.png",
    badge: "/lightning-news-logo.png",
  });

const buildAlertUrl = () => {
  const baseUrl = env.ALLOWED_ORIGINS[0] || env.FRONT_END_URI || "";
  return baseUrl ? `${baseUrl.replace(/\/+$/, "")}/?view=alerts` : "/";
};

const articleHasMatchingTag = (article, alertTag) =>
  (article.tags || [])
    .map((tag) => String(tag || "").trim().toLowerCase())
    .some((tag) => tag === alertTag);

export const getPushPublicKey = () => env.PUSH_VAPID_PUBLIC_KEY;
export const isPushEnabled = () => env.PUSH_ENABLED;

export const listUserPushSubscriptions = async (userId) =>
  PushSubscriptionModel.find({ user: userId, isActive: true }).lean();

export const savePushSubscription = async ({ userId, subscription, userAgent }) => {
  if (!env.PUSH_ENABLED) {
    throw badRequest("Push notifications are not configured on the server");
  }

  const endpoint = subscription?.endpoint?.trim();
  const p256dh = subscription?.keys?.p256dh?.trim();
  const auth = subscription?.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    throw badRequest("Invalid push subscription payload");
  }

  return PushSubscriptionModel.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        user: userId,
        endpoint,
        expirationTime: subscription.expirationTime ? new Date(subscription.expirationTime) : null,
        keys: { p256dh, auth },
        userAgent: userAgent || "",
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

export const removePushSubscription = async ({ userId, endpoint }) => {
  if (!env.PUSH_ENABLED) {
    return;
  }

  if (!endpoint?.trim()) {
    throw badRequest("Push endpoint is required");
  }

  await PushSubscriptionModel.findOneAndUpdate(
    { user: userId, endpoint: endpoint.trim() },
    { $set: { isActive: false } },
  );
};

export const sendPushToSubscriptions = async (subscriptions, payload) => {
  if (!env.PUSH_ENABLED || !subscriptions.length) {
    return [];
  }

  return Promise.all(
    subscriptions.map(async (subscriptionDoc) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscriptionDoc.endpoint,
            expirationTime: subscriptionDoc.expirationTime?.getTime?.() || null,
            keys: subscriptionDoc.keys,
          },
          createNotificationPayload(payload),
        );

        await PushSubscriptionModel.updateOne(
          { _id: subscriptionDoc._id },
          { $set: { lastNotifiedAt: new Date(), isActive: true } },
        );

        return {
          ok: true,
          endpoint: subscriptionDoc.endpoint,
        };
      } catch (error) {
        const statusCode = error?.statusCode || error?.status;
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscriptionModel.updateOne(
            { _id: subscriptionDoc._id },
            { $set: { isActive: false } },
          );
        }

        const failure = {
          ok: false,
          endpoint: subscriptionDoc.endpoint,
          statusCode,
          message: error?.message || String(error),
          body: error?.body || null,
          headers: error?.headers || null,
        };

        console.error("Push notification failed:", failure);
        return failure;
      }
    }),
  );
};

export const sendWelcomePushNotification = async (userId) => {
  if (!env.PUSH_ENABLED) {
    return;
  }

  const subscriptions = await listUserPushSubscriptions(userId);
  if (!subscriptions.length) {
    return;
  }

  await sendPushToSubscriptions(subscriptions, {
    title: "Lightning News alerts enabled",
    body: "You will now receive push notifications for new matches on saved alerts.",
    url: buildAlertUrl(),
  });
};

export const sendTestPushNotification = async (userId) => {
  if (!env.PUSH_ENABLED) {
    throw badRequest("Push notifications are not configured on the server");
  }

  const subscriptions = await listUserPushSubscriptions(userId);
  if (!subscriptions.length) {
    throw badRequest("Enable push notifications in this browser first");
  }

  const results = await sendPushToSubscriptions(subscriptions, {
    title: "Lightning News test notification",
    body: "Push delivery is working for this browser.",
    url: buildAlertUrl(),
  });

  const successCount = results.filter((item) => item?.ok).length;
  if (successCount === 0) {
    const firstFailure = results.find((item) => item && !item.ok);
    throw badRequest(
      firstFailure?.statusCode
        ? `Push delivery failed (${firstFailure.statusCode}). Check server logs for details.`
        : "Push delivery failed. Check server logs for details.",
    );
  }

  return {
    ok: true,
    sent: successCount,
    total: results.length,
  };
};

export const notifyUsersAboutMatchingArticles = async (articles) => {
  if (!env.PUSH_ENABLED || !articles.length) {
    return;
  }

  const [alerts, subscriptions] = await Promise.all([
    AlertSubscription.find({ enabled: true }).lean(),
    PushSubscriptionModel.find({ isActive: true }).lean(),
  ]);

  const subscriptionsByUser = new Map();
  for (const subscription of subscriptions) {
    const key = subscription.user.toString();
    const currentItems = subscriptionsByUser.get(key) || [];
    currentItems.push(subscription);
    subscriptionsByUser.set(key, currentItems);
  }

  const notificationsByUser = new Map();

  for (const alert of alerts) {
    const matches = articles.filter((article) => {
      return articleHasMatchingTag(article, String(alert.topic || "").toLowerCase());
    });

    if (!matches.length) {
      continue;
    }

    const userKey = alert.user.toString();
    const currentState = notificationsByUser.get(userKey) || {
      topics: new Set(),
      matches: [],
    };

    currentState.topics.add(alert.topic);
    currentState.matches.push(...matches);
    notificationsByUser.set(userKey, currentState);
  }

  await Promise.all(
    [...notificationsByUser.entries()].map(async ([userId, state]) => {
      const userSubscriptions = subscriptionsByUser.get(userId) || [];
      if (!userSubscriptions.length) {
        return;
      }

      const uniqueMatches = [...new Map(state.matches.map((item) => [item.link, item])).values()];
      const topics = [...state.topics];
      const firstArticle = uniqueMatches[0];
      const title =
        uniqueMatches.length > 1
          ? `${uniqueMatches.length} new alert matches`
          : `New match for ${topics[0]}`;
      const body =
        uniqueMatches.length > 1
          ? `${topics.join(", ")}: ${firstArticle?.title || "New stories available"}`
          : firstArticle?.title || "A saved alert has a new matching story.";

      await sendPushToSubscriptions(userSubscriptions, {
        title,
        body,
        url: buildAlertUrl(),
      });
    }),
  );
};
