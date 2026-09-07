import { enqueueRedisJob, getRedisJob, listRedisJobs } from "../services/redis-queue.service.js";
import { badRequest } from "../utils/http.js";

export const createRedisQueueJob = async (req, res) => {
  const item = await enqueueRedisJob(req.body, req.user._id);
  res.status(201).json({ item });
};

export const getRedisQueueJob = async (req, res) => {
  const item = await getRedisJob(req.params.jobId, req.user._id);

  if (!item) {
    throw badRequest("Redis queue job not found");
  }

  res.status(200).json({ item });
};

export const listRedisQueueJobs = async (req, res) => {
  const items = await listRedisJobs(req.user._id);
  res.status(200).json({ items });
};
