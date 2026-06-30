import { Router } from "express";
import { getPublicKey, getSubscriptions, subscribe, unsubscribe } from "../controllers/push.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const pushRouter = Router();

pushRouter.get("/public-key", asyncHandler(getPublicKey));

pushRouter.get("/subscriptions", requireAuth, asyncHandler(getSubscriptions));

pushRouter.post("/subscribe", requireAuth, asyncHandler(subscribe));

pushRouter.post("/unsubscribe", requireAuth, asyncHandler(unsubscribe));
