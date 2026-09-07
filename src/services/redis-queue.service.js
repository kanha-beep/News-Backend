import crypto from "node:crypto";
import {
  getRedisFeaturesClient,
  getRedisQueueReaderClient,
  isRedisFeaturesReady,
} from "../config/redis-features.js";
import {
  deletePersistentUserData,
  listPersistentUserData,
  setPersistentUserData,
} from "./redis-app-data.service.js";
import { syncNewsFromRss } from "./news.service.js";
import { badRequest } from "../utils/http.js";
import { readString } from "../utils/validation.js";

const QUEUE_KEY = "app:queue:jobs";
const JOB_PREFIX = "app:queue:job";

let workerStarted = false;

const serviceUnavailable = (message) => {
  const error = new Error(message);
  error.statusCode = 503;
  error.publicMessage = message;
  return error;
};

const ensureRedisFeatures = () => {
  if (!isRedisFeaturesReady()) {
    throw serviceUnavailable("Redis queue is not available");
  }

  return getRedisFeaturesClient();
};

const buildJobStorageKey = (jobId) => `${JOB_PREFIX}:${jobId}`;

const normalizeJobType = (type) =>
  readString(type, "Job type", {
    required: true,
    min: 1,
    max: 60,
    lowercase: true,
  });

const writeJob = async (redis, job) => {
  await redis.set(buildJobStorageKey(job.id), JSON.stringify(job));
  return job;
};

const readJob = async (redis, jobId) => {
  const serializedJob = await redis.get(buildJobStorageKey(jobId));
  return serializedJob ? JSON.parse(serializedJob) : null;
};

const processJobPayload = async (job) => {
  switch (job.type) {
    case "persist-user-data":
      return setPersistentUserData(job.userId, job.payload?.key, job.payload?.value);
    case "delete-user-data":
      return deletePersistentUserData(job.userId, job.payload?.key);
    case "list-user-data":
      return listPersistentUserData(job.userId);
    case "sync-news":
      return syncNewsFromRss(job.payload?.rssUrl || undefined, {
        language: job.payload?.language || "en",
      });
    case "echo":
      return job.payload;
    default:
      throw badRequest(`Unsupported queue job type: ${job.type}`);
  }
};

const markJobStatus = async (redis, jobId, updates) => {
  const job = await readJob(redis, jobId);

  if (!job) {
    return null;
  }

  const nextJob = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeJob(redis, nextJob);
  return nextJob;
};

const processQueuedJob = async (jobId) => {
  const redis = getRedisFeaturesClient();

  if (!redis?.isReady) {
    return null;
  }

  const queuedJob = await markJobStatus(redis, jobId, {
    status: "processing",
    startedAt: new Date().toISOString(),
    error: null,
  });

  if (!queuedJob) {
    return null;
  }

  try {
    const result = await processJobPayload(queuedJob);
    return markJobStatus(redis, jobId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      result,
    });
  } catch (error) {
    return markJobStatus(redis, jobId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: error?.publicMessage || error?.message || "Queue worker failed",
    });
  }
};

export const enqueueRedisJob = async (payload, userId) => {
  const redis = ensureRedisFeatures();
  const type = normalizeJobType(payload?.type);
  const job = {
    id: crypto.randomUUID(),
    type,
    status: "queued",
    userId: String(userId),
    payload: payload?.payload ?? {},
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };

  await writeJob(redis, job);
  await redis.rPush(QUEUE_KEY, job.id);
  return job;
};

export const getRedisJob = async (jobId, userId) => {
  const redis = ensureRedisFeatures();
  const normalizedJobId = readString(jobId, "Job id", { required: true, max: 120 });
  const job = await readJob(redis, normalizedJobId);

  if (!job || job.userId !== String(userId)) {
    return null;
  }

  return job;
};

export const listRedisJobs = async (userId) => {
  const redis = ensureRedisFeatures();
  const keys = await redis.keys(`${JOB_PREFIX}:*`);

  if (!keys.length) {
    return [];
  }

  const serializedJobs = await redis.mGet(keys);

  return serializedJobs
    .filter(Boolean)
    .map((serializedJob) => JSON.parse(serializedJob))
    .filter((job) => job.userId === String(userId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const startRedisQueueWorker = async () => {
  if (workerStarted || !isRedisFeaturesReady()) {
    return false;
  }

  const redisQueueReader = getRedisQueueReaderClient();
  if (!redisQueueReader?.isReady) {
    return false;
  }

  workerStarted = true;

  const run = async () => {
    while (workerStarted && isRedisFeaturesReady()) {
      try {
        const response = await redisQueueReader.sendCommand(["BLPOP", QUEUE_KEY, "1"]);

        if (!response || response.length < 2) {
          continue;
        }

        await processQueuedJob(response[1]);
      } catch (error) {
        console.warn("Redis queue worker stopped:", error?.message || error);
        workerStarted = false;
      }
    }
  };

  run().catch((error) => {
    workerStarted = false;
    console.warn("Redis queue worker crashed:", error?.message || error);
  });

  return true;
};
