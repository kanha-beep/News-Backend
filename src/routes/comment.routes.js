import { Router } from "express";
import { addComment, getComments } from "../controllers/comment.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const commentRouter = Router();

commentRouter.get("/", asyncHandler(getComments));

commentRouter.post("/", requireAuth, asyncHandler(addComment));
