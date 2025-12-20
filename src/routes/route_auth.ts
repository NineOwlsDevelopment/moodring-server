import { Router } from "express";
import {
  requestMagicLink,
  verifyMagicLink,
  generateWalletNonce,
  authenticateWithWallet,
  refreshAccessToken,
  getCurrentUser,
  logout,
} from "../controllers/controller_auth";
import { authenticateToken } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";
import { typedHandler } from "../types/routeHandler";

const router = Router();

// Magic Link (Email OTP) Routes - rate limited
router.post("/magic-link/request", authLimiter, requestMagicLink);
router.post("/magic-link/verify", authLimiter, verifyMagicLink);

// Wallet Authentication Routes - rate limited
router.post("/wallet/nonce", authLimiter, generateWalletNonce);
router.post("/wallet/authenticate", authLimiter, authenticateWithWallet);

// Token Management
router.post("/refresh", refreshAccessToken);

// Protected Routes (require JWT)
router.get("/me", authenticateToken, typedHandler(getCurrentUser));
router.post("/logout", authenticateToken, typedHandler(logout));

export default router;
