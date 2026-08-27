import express from "express";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { newsRouter } from "./routes/news.routes.js";
import { commentRouter } from "./routes/comment.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";
import { alertRouter } from "./routes/alert.routes.js";
import { intelligenceRouter } from "./routes/intelligence.routes.js";
import { blogDraftRouter } from "./routes/blog-draft.routes.js";
import { legacyRouter } from "./routes/legacy.routes.js";
import { pushRouter } from "./routes/push.routes.js";
import { translationRouter } from "./routes/translation.routes.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error.js";

const sanitizeRequest = (req, _res, next) => {
  const sanitizeOptions = { replaceWith: "_" };

  if (req.body) {
    mongoSanitize.sanitize(req.body, sanitizeOptions);
  }

  if (req.params) {
    mongoSanitize.sanitize(req.params, sanitizeOptions);
  }

  if (req.query) {
    mongoSanitize.sanitize(req.query, sanitizeOptions);
  }

  next();
};

export const createApp = () => {
  const app = express();
  console.log("1. cors atrt")
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.ALLOWED_ORIGINS.length === 0 || env.ALLOWED_ORIGINS.includes(origin)) {
          console.log("2.")
          return callback(null, true);
        }
        console.log("3. ")
        return callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  console.log("5.")
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));
  app.use(sanitizeRequest);
  app.use(hpp());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/news", newsRouter);
  app.use("/api/comments", commentRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/alerts", alertRouter);
  app.use("/api/intelligence", intelligenceRouter);
  app.use("/api/blog-drafts", blogDraftRouter);
  app.use("/api/push", pushRouter);
  app.use("/api/translations", translationRouter);
  app.use("/api", legacyRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
