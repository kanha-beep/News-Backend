import { getRedisFeaturesClient, isRedisFeaturesReady } from "../config/redis-features.js";
import { badRequest } from "../utils/http.js";
import { readString } from "../utils/validation.js";

const USER_DATA_PREFIX = "app:data:user";

const serviceUnavailable = (message) => {
  const error = new Error(message);
  error.statusCode = 503;
  error.publicMessage = message;
  return error;
};

const ensureRedisFeatures = () => {
  if (!isRedisFeaturesReady()) {
    throw serviceUnavailable("Redis persistent data is not available");
  }

  return getRedisFeaturesClient();
};

const normalizeDataKey = (key) =>
  readString(key, "Data key", {
    required: true,
    min: 1,
    max: 120,
  });

const buildUserDataKey = (userId, key) => `${USER_DATA_PREFIX}:${userId}:${normalizeDataKey(key)}`;

const parseStoredValue = (serializedValue, key) => {
  if (typeof serializedValue !== "string") {
    return null;
  }

  try {
    return JSON.parse(serializedValue);
  } catch {
    throw badRequest(`Stored data for ${key} is invalid JSON`);
  }
};

const normalizeStoredValue = (value) => {
  if (typeof value === "undefined") {
    throw badRequest("Value is required");
  }

  try {
    return JSON.stringify(value);
  } catch {
    throw badRequest("Value must be JSON serializable");
  }
};

export const listPersistentUserData = async (userId) => {
  const redis = ensureRedisFeatures();
  const keys = await redis.keys(`${USER_DATA_PREFIX}:${userId}:*`);

  if (!keys.length) {
    return [];
  }

  const serializedValues = await redis.mGet(keys);

  return keys
    .map((fullKey, index) => {
      const key = fullKey.split(":").slice(4).join(":");
      return {
        key,
        value: parseStoredValue(serializedValues[index], key),
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
};

export const getPersistentUserData = async (userId, key) => {
  const redis = ensureRedisFeatures();
  const normalizedKey = normalizeDataKey(key);
  const serializedValue = await redis.get(buildUserDataKey(userId, normalizedKey));

  if (serializedValue === null) {
    return null;
  }

  return {
    key: normalizedKey,
    value: parseStoredValue(serializedValue, normalizedKey),
  };
};

export const setPersistentUserData = async (userId, key, value) => {
  const redis = ensureRedisFeatures();
  const normalizedKey = normalizeDataKey(key);
  await redis.set(buildUserDataKey(userId, normalizedKey), normalizeStoredValue(value));

  return {
    key: normalizedKey,
    value,
  };
};

export const deletePersistentUserData = async (userId, key) => {
  const redis = ensureRedisFeatures();
  const normalizedKey = normalizeDataKey(key);
  const deletedCount = await redis.del(buildUserDataKey(userId, normalizedKey));

  return {
    key: normalizedKey,
    deleted: deletedCount > 0,
  };
};
