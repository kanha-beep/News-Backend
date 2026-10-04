import { Router } from "express";
import {
  getCurrentUser,
  googleLogin,
  login,
  register,
  updateLanguagePreference,
  updateInterests,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(register));

authRouter.post("/login", asyncHandler(login));

authRouter.post("/google", asyncHandler(googleLogin));

authRouter.get("/me", requireAuth, asyncHandler(getCurrentUser));

authRouter.put("/preferences/language", requireAuth, asyncHandler(updateLanguagePreference));
authRouter.put("/preferences/interests", requireAuth, asyncHandler(updateInterests));
