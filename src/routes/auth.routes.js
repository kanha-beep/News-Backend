import { Router } from "express";
import { getCurrentUser, login, register } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(register));

authRouter.post("/login", asyncHandler(login));

authRouter.get("/me", requireAuth, asyncHandler(getCurrentUser));
