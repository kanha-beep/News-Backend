import dotenv from "dotenv";

dotenv.config();

const requiredEnv = [
  "MONGO_URI",
  "JWT_SECRET",
  "PORT",
];

for (const key of requiredEnv) {
  if (!process.env[key]?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (process.env.JWT_SECRET === "change-me-in-env") {
  throw new Error("JWT_SECRET must be set to a real secret value.");
}

export const env = {
  PORT: Number.parseInt(process.env.PORT, 10),
  MONGO_URI: process.env.MONGO_URI.trim(),
  JWT_SECRET: process.env.JWT_SECRET.trim(),
  FRONT_END_URI: (process.env.FRONT_END_URI || "").trim(),
  BLOG_FRONT_END_URI: (process.env.BLOG_FRONT_END_URI || "https://blogs-frontend-omega.vercel.app").replace(/\/+$/, ""),
  BLOGS_MONGO_URI: (process.env.BLOGS_MONGO_URI || "").trim(),
  RUST_RSS_FETCHER_BIN: (process.env.RUST_RSS_FETCHER_BIN || "").trim(),
  HINDU_HOME_RSS: (process.env.HINDU_HOME_RSS || "https://www.thehindu.com/feeder/default.rss").trim(),
  NEWS_SYNC_CRON: (process.env.NEWS_SYNC_CRON || "*/10 * * * *").trim(),
  PUSH_VAPID_PUBLIC_KEY: (process.env.PUSH_VAPID_PUBLIC_KEY || "").trim(),
  PUSH_VAPID_PRIVATE_KEY: (process.env.PUSH_VAPID_PRIVATE_KEY || "").trim(),
  PUSH_VAPID_SUBJECT: (process.env.PUSH_VAPID_SUBJECT || "").trim(),
  ALLOWED_ORIGINS: (process.env.FRONT_END_URI || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

env.PUSH_ENABLED = Boolean(
  env.PUSH_VAPID_PUBLIC_KEY &&
    env.PUSH_VAPID_PRIVATE_KEY &&
    env.PUSH_VAPID_SUBJECT,
);

if (!Number.isInteger(env.PORT) || env.PORT <= 0) {
  throw new Error("PORT must be a valid positive integer.");
}
