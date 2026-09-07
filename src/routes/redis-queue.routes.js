import { Router } from "express";
import {
  createRedisQueueJob,
  getRedisQueueJob,
  listRedisQueueJobs,
} from "../controllers/redis-queue.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const redisQueueRouter = Router();

redisQueueRouter.use(requireAuth);

redisQueueRouter.get("/jobs", asyncHandler(listRedisQueueJobs));
redisQueueRouter.get("/jobs/:jobId", asyncHandler(getRedisQueueJob));
redisQueueRouter.post("/jobs", asyncHandler(createRedisQueueJob));
