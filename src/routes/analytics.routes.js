import { Router } from "express";
import { recordVisit } from "../services/analytics.service.js";
import { asyncHandler } from "../utils/http.js";

export const analyticsRouter = Router();

analyticsRouter.post(
  "/visit",
  asyncHandler(async (req, res) => {
    await recordVisit(req);
    res.status(201).json({ ok: true });
  }),
);
