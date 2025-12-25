"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_admin_1 = require("../controllers/controller_admin");
const auth_1 = require("../middleware/auth");
const admin_1 = require("../middleware/admin");
const rateLimit_1 = require("../middleware/rateLimit");
const routeHandler_1 = require("../types/routeHandler");
const router = (0, express_1.Router)();
// All admin routes require authentication, admin role, and rate limiting
router.use(auth_1.authenticateToken, admin_1.requireAdmin, rateLimit_1.adminLimiter);
// Platform management
router.get("/pause", (0, routeHandler_1.typedHandler)(controller_admin_1.getPauseFlags));
router.post("/pause", (0, routeHandler_1.typedHandler)(controller_admin_1.setPauseFlags));
// Fee management (off-chain)
router.get("/fees", (0, routeHandler_1.typedHandler)(controller_admin_1.getProtocolFees));
router.post("/fees/withdraw", (0, routeHandler_1.typedHandler)(controller_admin_1.withdrawProtocolFees));
// Category management
router.get("/categories", controller_admin_1.getCategories);
router.post("/categories", controller_admin_1.createCategory);
router.delete("/categories/:id", controller_admin_1.deleteCategory);
// Market management
router.post("/market/:id/feature", controller_admin_1.toggleMarketFeatured);
router.post("/market/:id/verify", controller_admin_1.toggleMarketVerified);
router.post("/market/:id/categories", controller_admin_1.updateMarketCategories);
// Withdrawal management
router.get("/withdrawals/pending", controller_admin_1.getPendingWithdrawals);
router.post("/withdrawal/:id/process", controller_admin_1.processWithdrawal);
// User management
router.get("/users", (0, routeHandler_1.typedHandler)(controller_admin_1.getUsers));
router.post("/user/:id/balance", (0, routeHandler_1.typedHandler)(controller_admin_1.adjustUserBalance));
router.post("/balance-adjustment/:requestId/approve", (0, routeHandler_1.typedHandler)(controller_admin_1.approveBalanceAdjustment));
router.post("/user/:id/admin", (0, routeHandler_1.typedHandler)(controller_admin_1.toggleUserAdmin));
// Dashboard stats
router.get("/stats", controller_admin_1.getAdminStats);
// Hot wallet management
router.get("/hot-wallet", controller_admin_1.getHotWalletStatus);
router.post("/circle-hot-wallet", (0, routeHandler_1.typedHandler)(controller_admin_1.createCircleHotWallet));
router.post("/hot-wallet/withdraw-to-cold-storage", (0, routeHandler_1.typedHandler)(controller_admin_1.withdrawToColdStorage));
// Admin settings management
router.get("/settings", (0, routeHandler_1.typedHandler)(controller_admin_1.getAdminSettings));
router.put("/settings", (0, routeHandler_1.typedHandler)(controller_admin_1.updateAdminSettings));
router.get("/settings/:group", (0, routeHandler_1.typedHandler)(controller_admin_1.getAdminSettingsGroup));
// Suspicious trade management
router.get("/suspicious-trades", (0, routeHandler_1.typedHandler)(controller_admin_1.getSuspiciousTrades));
router.get("/suspicious-trades/stats", controller_admin_1.getSuspiciousTradesStats);
router.post("/suspicious-trades/:id/review", controller_admin_1.reviewSuspiciousTrade);
router.get("/suspicious-trades/user/:userId", controller_admin_1.getUserSuspiciousTrades);
// Dispute management
router.get("/disputes", (0, routeHandler_1.typedHandler)(controller_admin_1.getDisputes));
router.get("/disputes/:id", (0, routeHandler_1.typedHandler)(controller_admin_1.getDispute));
router.post("/disputes/:id/resolve", (0, routeHandler_1.typedHandler)(controller_admin_1.resolveDispute));
exports.default = router;
//# sourceMappingURL=route_admin.js.map