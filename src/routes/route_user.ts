import { Router } from "express";
import multer from "multer";
import {
  getPublicUserById,
  updateCurrentUser,
  deleteCurrentUser,
  generateWallet,
  uploadAvatar,
  getUserProfile,
  getUserPosts,
  followUser,
  unfollowUser,
  getFollowStatus,
} from "../controllers/controller_user";
import {
  getPortfolio,
  getPositions,
  getLiquidityPositions,
  getPnLSummary,
} from "../controllers/controller_portfolio";
import { authenticateToken, optionalAuth } from "../middleware/auth";
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
// Note: Specific routes must come before :id to avoid route conflicts
router.post("/follow/:id", authenticateToken, typedHandler(followUser)); // Follow a user (supports UUID or username)
router.post("/unfollow/:id", authenticateToken, typedHandler(unfollowUser)); // Unfollow a user (supports UUID or username)
router.get(
  "/follow-status/:id",
  authenticateToken,
  typedHandler(getFollowStatus)
); // Get follow status (supports UUID or username)
router.get("/:id/posts", optionalAuth, typedHandler(getUserPosts)); // Get user's posts (supports UUID or username, optional auth)
router.get("/:id", typedHandler(getPublicUserById)); // Public profile view (limited data)
router.get("/profile/:id", typedHandler(getUserProfile)); // Detailed public profile with stats
router.put("/me", authenticateToken, typedHandler(updateCurrentUser)); // Update own profile
router.post(
  "/me/avatar",
  authenticateToken,
  upload.single("avatar"),
  typedHandler(uploadAvatar)
); // Upload avatar/profile picture
router.delete("/me", authenticateToken, typedHandler(deleteCurrentUser)); // Delete own account

export default router;
