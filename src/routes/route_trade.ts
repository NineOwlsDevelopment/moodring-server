import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { tradeLimiter, claimLimiter } from "../middleware/rateLimit";
import { validateUUID } from "../middleware/validate";
import { typedHandler } from "../types/routeHandler";
import {
  buyShares,
  sellShares,
  claimWinnings,
  getTradeHistory,
  getPosition,
  getAllPositions,
  getPriceHistory,
  getMarketPriceHistory,
  getOHLCData,
  getUserTrades,
} from "../controllers/controller_trade";

const router = Router();

// Protected routes with rate limiting
router.post("/buy", authenticateToken, tradeLimiter, typedHandler(buyShares));
router.post("/sell", authenticateToken, tradeLimiter, typedHandler(sellShares));
router.post(
  "/claim-winnings",
  authenticateToken,
  claimLimiter,
  typedHandler(claimWinnings)
);

// Position routes
router.get(
  "/position/:option",
  authenticateToken,
  validateUUID("option"),
  typedHandler(getPosition)
);

// Position routes
router.get("/position/:option", authenticateToken, typedHandler(getPosition));
router.get("/positions", authenticateToken, typedHandler(getAllPositions));

// Trade history routes
router.get("/history", authenticateToken, typedHandler(getTradeHistory));
router.get(
  "/user/:userId",
  authenticateToken,
  validateUUID("userId"),
  typedHandler(getUserTrades)
);

// Price history routes (for charts)
// Note: More specific route must come before parameterized route
router.get(
  "/price-history/market/:marketId",
  typedHandler(getMarketPriceHistory)
);
router.get("/price-history/:optionId", typedHandler(getPriceHistory));
router.get("/ohlc/:optionId", typedHandler(getOHLCData));

export default router;
