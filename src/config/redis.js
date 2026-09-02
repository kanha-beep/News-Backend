import { createClient } from "redis";
import { env } from "./env.js";

let redisClient = null;
let redisReady = false;

export const connectRedis = async () => {
  redisClient = createClient({
    url: env.REDIS_URL,
    socket: {
      connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: false,
    },
  });

  redisClient.on("error", (error) => {
    console.warn("Redis error; using the in-memory cache fallback:", error.message);
  });

  try {
    await redisClient.connect();
    redisReady = true;
    console.log("Redis cache connected.");
  } catch (error) {
    console.warn("Redis is unavailable; using the in-memory cache fallback:", error.message);
  }
};

export const getCachedJson = async (key) => {
  if (!redisReady) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn(`Redis read failed for ${key}:`, error.message);
    return null;
  }
};

export const setCachedJson = async (key, value, ttlSeconds) => {
  if (!redisReady) {
    return false;
  }

  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (error) {
    console.warn(`Redis write failed for ${key}:`, error.message);
    return false;
  }
};

export const deleteCachedKey = async (key) => {
  if (!redisReady) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.warn(`Redis delete failed for ${key}:`, error.message);
    return false;
  }
};
