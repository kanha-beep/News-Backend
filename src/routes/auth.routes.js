import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";
import { loginUser, registerUser, sanitizeUser } from "../services/auth.service.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const result = await loginUser(req.body);
    res.status(200).json(result);
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.status(200).json({ user: sanitizeUser(req.user) });
  }),
);
