import { Router } from "express";
import { addAlert, getAlerts, removeAlert, runAlertCheck, updateAlert } from "../controllers/alert.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const alertRouter = Router();

alertRouter.use(requireAuth);

alertRouter.get("/", asyncHandler(getAlerts));

alertRouter.post("/", asyncHandler(addAlert));

alertRouter.patch("/:alertId", asyncHandler(updateAlert));

alertRouter.delete("/:alertId", asyncHandler(removeAlert));

alertRouter.get("/check", asyncHandler(runAlertCheck));
