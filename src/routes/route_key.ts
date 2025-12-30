import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { validateUUID } from "../middleware/validate";
import { typedHandler } from "../types/routeHandler";
import {
  buyKeys,
  sellKeys,
  getKeyPrice,
  getKeyOwnership,
  setRequiredKeys,
  getKeyHolders,
} from "../controllers/controller_key";

const router = Router();

// Key operations (protected)
router.post("/buy", authenticateToken, typedHandler(buyKeys));
router.post("/sell", authenticateToken, typedHandler(sellKeys));
router.get(
  "/ownership/:trader_id",
  authenticateToken,
  validateUUID("trader_id"),
  typedHandler(getKeyOwnership)
);
router.post("/set-required", authenticateToken, typedHandler(setRequiredKeys));

// Public routes
router.get(
  "/price/:trader_id",
  validateUUID("trader_id"),
  typedHandler(getKeyPrice)
);
router.get(
  "/holders/:trader_id",
  validateUUID("trader_id"),
  typedHandler(getKeyHolders)
);

export default router;

