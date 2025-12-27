"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_auth_1 = require("../controllers/controller_auth");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const routeHandler_1 = require("../types/routeHandler");
const router = (0, express_1.Router)();
// Magic Link (Email OTP) Routes - rate limited
router.post("/magic-link/request", rateLimit_1.authLimiter, controller_auth_1.requestMagicLink);
router.post("/magic-link/verify", rateLimit_1.authLimiter, controller_auth_1.verifyMagicLink);
// Wallet Authentication Routes - rate limited
router.post("/wallet/nonce", rateLimit_1.authLimiter, controller_auth_1.generateWalletNonce);
router.post("/wallet/authenticate", rateLimit_1.authLimiter, controller_auth_1.authenticateWithWallet);
// Token Management
router.post("/refresh", controller_auth_1.refreshAccessToken);
// Protected Routes (require JWT)
router.get("/me", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_auth_1.getCurrentUser));
router.post("/logout", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_auth_1.logout));
exports.default = router;
//# sourceMappingURL=route_auth.js.map