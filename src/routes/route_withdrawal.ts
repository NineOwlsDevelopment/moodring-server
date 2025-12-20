import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { withdrawalLimiter } from "../middleware/rateLimit";
import { validateBody, validateUUID } from "../middleware/validate";
import { withdrawalSchema } from "../middleware/validate";
import { typedHandler } from "../types/routeHandler";
import {
  requestWithdrawal,
  cancelWithdrawal,
  getWithdrawalHistory,
  getWithdrawal,
  getWithdrawalTotals,
} from "../controllers/controller_withdrawal";

const router = Router();

// @route POST /api/withdrawal/request - Request a withdrawal
router.post(
  "/request",
  authenticateToken,
  withdrawalLimiter,
  validateBody(withdrawalSchema),
  typedHandler(requestWithdrawal)
);

// @route POST /api/withdrawal/:id/cancel - Cancel a pending withdrawal
router.post(
  "/:id/cancel",
  authenticateToken,
  validateUUID("id"),
  typedHandler(cancelWithdrawal)
);

// @route GET /api/withdrawal/history - Get withdrawal history
router.get("/history", authenticateToken, typedHandler(getWithdrawalHistory));

// @route GET /api/withdrawal/totals - Get total withdrawals
router.get("/totals", authenticateToken, typedHandler(getWithdrawalTotals));

// @route GET /api/withdrawal/:id - Get a specific withdrawal
router.get(
  "/:id",
  authenticateToken,
  validateUUID("id"),
  typedHandler(getWithdrawal)
);

export default router;
