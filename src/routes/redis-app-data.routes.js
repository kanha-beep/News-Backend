import { Router } from "express";
import {
  getRedisAppData,
  listRedisAppData,
  putRedisAppData,
  removeRedisAppData,
} from "../controllers/redis-app-data.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const redisAppDataRouter = Router();

redisAppDataRouter.use(requireAuth);

redisAppDataRouter.get("/", asyncHandler(listRedisAppData));
redisAppDataRouter.get("/:key", asyncHandler(getRedisAppData));
redisAppDataRouter.put("/:key", asyncHandler(putRedisAppData));
redisAppDataRouter.delete("/:key", asyncHandler(removeRedisAppData));
