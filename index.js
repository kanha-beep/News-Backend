import { env } from "./src/config/env.js";
import { createApp } from "./src/app.js";
import { connectBlogsDb, connectDb } from "./src/config/database.js";
import { connectRedis } from "./src/config/redis.js";
import { startNewsSyncJob } from "./src/jobs/news-sync.job.js";
import { warmNewsIntelligence } from "./src/services/news.service.js";

const startServer = async () => {
  try {
    await connectRedis();
    await connectDb();
    await connectBlogsDb();
    await warmNewsIntelligence();
    startNewsSyncJob();

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
