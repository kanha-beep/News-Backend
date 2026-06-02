import cron from "node-cron";
import { env } from "../config/env.js";
import { syncNewsFromRss } from "../services/news.service.js";

export const startNewsSyncJob = () => {
  cron.schedule(env.NEWS_SYNC_CRON, async () => {
    try {
      await syncNewsFromRss();
    } catch (error) {
      console.error("Scheduled news sync failed:", error?.message || error);
    }
  });
};
