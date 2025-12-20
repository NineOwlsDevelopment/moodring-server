import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { validateUUID } from "../middleware/validate";
import { typedHandler } from "../types/routeHandler";
import {
  submitResolution,
  getResolution,
  disputeResolution,
} from "../controllers/controller_resolution";

const router = Router();

// Protected routes
router.post("/submit", authenticateToken, typedHandler(submitResolution));
router.post("/dispute", authenticateToken, typedHandler(disputeResolution));

// Public routes
router.get("/:marketId", validateUUID("marketId"), typedHandler(getResolution));

export default router;
