import cron from "node-cron";
import { env } from "../config/env.js";
import { syncNewsFromRss } from "../services/news.service.js";
import { enqueueRedisJob } from "../services/redis-queue.service.js";

export const startNewsSyncJob = () => {
  cron.schedule(env.NEWS_SYNC_CRON, async () => {
    try {
      await enqueueRedisJob(
        {
          type: "sync-news",
          payload: {},
        },
        "system",
      );
    } catch (error) {
      // Keep the existing scheduled refresh working when Redis is unavailable.
      try {
        await syncNewsFromRss();
      } catch (fallbackError) {
        console.error("Scheduled news sync failed:", fallbackError?.message || fallbackError);
      }
    }
  });
};
