import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { checkAlerts, createAlert, deleteAlert, listAlerts, toggleAlert } from "../services/alert.service.js";
import { asyncHandler } from "../utils/http.js";

export const alertRouter = Router();

alertRouter.use(requireAuth);

alertRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await listAlerts(req.user._id);
    res.status(200).json({ items });
  }),
);

alertRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const item = await createAlert(req.body, req.user._id);
    res.status(201).json({ item });
  }),
);

alertRouter.patch(
  "/:alertId",
  asyncHandler(async (req, res) => {
    const item = await toggleAlert(req.params.alertId, req.body?.enabled, req.user._id);
    res.status(200).json({ item });
  }),
);

alertRouter.delete(
  "/:alertId",
  asyncHandler(async (req, res) => {
    await deleteAlert(req.params.alertId, req.user._id);
    res.status(200).json({ ok: true });
  }),
);

alertRouter.get(
  "/check",
  asyncHandler(async (req, res) => {
    const items = await checkAlerts(req.user._id);
    res.status(200).json({ items });
  }),
);
