import { env } from "./src/config/env.js";
import { createApp } from "./src/app.js";
import { connectBlogsDb, connectDb } from "./src/config/database.js";
import { connectRedis } from "./src/config/redis.js";
import { connectRedisFeatures } from "./src/config/redis-features.js";
import { startNewsSyncJob } from "./src/jobs/news-sync.job.js";
import { warmNewsIntelligence } from "./src/services/news.service.js";
import { startRedisQueueWorker } from "./src/services/redis-queue.service.js";

const startServer = async () => {
  try {
    await connectRedis();
    await connectRedisFeatures();
    await connectDb();
    await connectBlogsDb();
    await warmNewsIntelligence();
    startNewsSyncJob();
    await startRedisQueueWorker();

    const app = createApp();
    app.listen(env.PORT, () => {
      console.log(`API running on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error?.message || error);
    process.exit(1);
  }
};

startServer();
