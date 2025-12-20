import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { typedHandler } from "../types/routeHandler";
import {
  addLiquidity,
  removeLiquidity,
  getLpPosition,
  getAllLpPositions,
  calculateLpShareValue,
  claimLpRewards,
} from "../controllers/controller_liquidity";

const router = Router();

// Add liquidity to a market (creates LP token mint on first liquidity)
router.post("/add", authenticateToken, typedHandler(addLiquidity));

// Remove liquidity from a market (early withdrawal before resolution)
router.post("/remove", authenticateToken, typedHandler(removeLiquidity));

// Claim LP rewards after market resolution (burns LP tokens)
router.post("/claim", authenticateToken, typedHandler(claimLpRewards));

// Get user's LP position for a specific market
router.get("/position/:market", authenticateToken, typedHandler(getLpPosition));

// Get all LP positions for the current user
router.get("/positions", authenticateToken, typedHandler(getAllLpPositions));

// Get the current LP share value for a market (public)
router.get("/share-value/:market", typedHandler(calculateLpShareValue));

export default router;
