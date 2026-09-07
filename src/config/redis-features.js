import { createClient } from "redis";
import { env } from "./env.js";

let redisFeaturesClient = null;
let redisQueueReaderClient = null;
let redisFeaturesInitialized = false;

const buildRedisClient = () =>
  createClient({
    url: env.REDIS_URL,
    socket: {
      connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: false,
    },
  });

const attachRedisLogging = (client, label) => {
  client.on("error", (error) => {
    console.warn(`${label} Redis connection error:`, error.message);
  });
};

export const connectRedisFeatures = async () => {
  if (redisFeaturesInitialized) {
    return isRedisFeaturesReady();
  }

  redisFeaturesInitialized = true;
  redisFeaturesClient = buildRedisClient();
  attachRedisLogging(redisFeaturesClient, "Primary");

  try {
    await redisFeaturesClient.connect();
    redisQueueReaderClient = redisFeaturesClient.duplicate();
    attachRedisLogging(redisQueueReaderClient, "Queue reader");
    await redisQueueReaderClient.connect();
    console.log("Redis queue and persistent data features connected.");
    return true;
  } catch (error) {
    console.warn(
      "Redis queue and persistent data features are unavailable:",
      error?.message || error,
    );
    return false;
  }
};

export const isRedisFeaturesReady = () =>
  Boolean(redisFeaturesClient?.isReady && redisQueueReaderClient?.isReady);

export const getRedisFeaturesClient = () => redisFeaturesClient;

export const getRedisQueueReaderClient = () => redisQueueReaderClient;
