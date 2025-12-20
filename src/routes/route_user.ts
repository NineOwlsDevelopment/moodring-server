import { Router } from "express";
import multer from "multer";
import {
  getPublicUserById,
  getUserProfile,
  updateCurrentUser,
  deleteCurrentUser,
  generateWallet,
  uploadAvatar,
} from "../controllers/controller_user";
import {
  getPortfolio,
  getPositions,
  getLiquidityPositions,
  getPnLSummary,
} from "../controllers/controller_portfolio";
import { authenticateToken } from "../middleware/auth";
import { typedHandler } from "../types/routeHandler";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Portfolio routes (must come before :id routes)
router.get("/portfolio", authenticateToken, typedHandler(getPortfolio));
router.get(
  "/portfolio/positions",
  authenticateToken,
  typedHandler(getPositions)
);
router.get(
  "/portfolio/liquidity",
  authenticateToken,
  typedHandler(getLiquidityPositions)
);
router.get("/portfolio/pnl", authenticateToken, typedHandler(getPnLSummary));

// Wallet management
router.post(
  "/wallet/generate",
  authenticateToken,
  typedHandler(generateWallet)
);

// User routes - protected with authentication
// Users can only update/delete their own account
router.get("/:id", typedHandler(getPublicUserById)); // Public profile view (limited data)
router.get("/:id/profile", typedHandler(getUserProfile)); // Detailed public profile with stats
router.put("/me", authenticateToken, typedHandler(updateCurrentUser)); // Update own profile
router.post(
  "/me/avatar",
  authenticateToken,
  upload.single("avatar"),
  typedHandler(uploadAvatar)
); // Upload avatar/profile picture
router.delete("/me", authenticateToken, typedHandler(deleteCurrentUser)); // Delete own account

export default router;
