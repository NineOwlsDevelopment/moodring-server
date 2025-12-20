import { Router } from "express";
import {
  setPauseFlags,
  getPauseFlags,
  getProtocolFees,
  withdrawProtocolFees,
  createCategory,
  getCategories,
  deleteCategory,
  toggleMarketFeatured,
  toggleMarketVerified,
  updateMarketCategories,
  processWithdrawal,
  getPendingWithdrawals,
  getAdminStats,
  getUsers,
  adjustUserBalance,
  approveBalanceAdjustment,
  getHotWalletStatus,
  getAdminSettings,
  updateAdminSettings,
  getAdminSettingsGroup,
  getSuspiciousTrades,
  getSuspiciousTradesStats,
  reviewSuspiciousTrade,
  getUserSuspiciousTrades,
  toggleUserAdmin,
  createCircleHotWallet,
} from "../controllers/controller_admin";
import { authenticateToken } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { typedHandler } from "../types/routeHandler";

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticateToken as any, requireAdmin as any);

// Platform management
router.get("/pause", typedHandler(getPauseFlags));
router.post("/pause", typedHandler(setPauseFlags));

// Fee management (off-chain)
router.get("/fees", typedHandler(getProtocolFees));
router.post("/fees/withdraw", typedHandler(withdrawProtocolFees));

// Category management
router.get("/categories", getCategories);
router.post("/categories", createCategory);
router.delete("/categories/:id", deleteCategory);

// Market management
router.post("/market/:id/feature", toggleMarketFeatured);
router.post("/market/:id/verify", toggleMarketVerified);
router.post("/market/:id/categories", updateMarketCategories);

// Withdrawal management
router.get("/withdrawals/pending", getPendingWithdrawals);
router.post("/withdrawal/:id/process", processWithdrawal);

// User management
router.get("/users", typedHandler(getUsers));
router.post("/user/:id/balance", typedHandler(adjustUserBalance));
router.post(
  "/balance-adjustment/:requestId/approve",
  typedHandler(approveBalanceAdjustment)
);
router.post("/user/:id/admin", typedHandler(toggleUserAdmin));

// Dashboard stats
router.get("/stats", getAdminStats);

// Hot wallet management
router.get("/hot-wallet", getHotWalletStatus);
router.post("/circle-hot-wallet", typedHandler(createCircleHotWallet));

// Admin settings management
router.get("/settings", typedHandler(getAdminSettings));
router.put("/settings", typedHandler(updateAdminSettings));
router.get("/settings/:group", typedHandler(getAdminSettingsGroup));

// Suspicious trade management
router.get("/suspicious-trades", typedHandler(getSuspiciousTrades));
router.get("/suspicious-trades/stats", getSuspiciousTradesStats);
router.post("/suspicious-trades/:id/review", reviewSuspiciousTrade);
router.get("/suspicious-trades/user/:userId", getUserSuspiciousTrades);

export default router;
