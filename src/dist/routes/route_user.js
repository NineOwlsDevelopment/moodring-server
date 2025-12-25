"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const controller_user_1 = require("../controllers/controller_user");
const controller_portfolio_1 = require("../controllers/controller_portfolio");
const auth_1 = require("../middleware/auth");
const routeHandler_1 = require("../types/routeHandler");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Portfolio routes (must come before :id routes)
router.get("/portfolio", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_portfolio_1.getPortfolio));
router.get("/portfolio/positions", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_portfolio_1.getPositions));
router.get("/portfolio/liquidity", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_portfolio_1.getLiquidityPositions));
router.get("/portfolio/pnl", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_portfolio_1.getPnLSummary));
// Wallet management
router.post("/wallet/generate", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_user_1.generateWallet));
// User routes - protected with authentication
// Users can only update/delete their own account
router.get("/:id", (0, routeHandler_1.typedHandler)(controller_user_1.getPublicUserById)); // Public profile view (limited data)
router.get("/:id/profile", (0, routeHandler_1.typedHandler)(controller_user_1.getUserProfile)); // Detailed public profile with stats
router.put("/me", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_user_1.updateCurrentUser)); // Update own profile
router.post("/me/avatar", auth_1.authenticateToken, upload.single("avatar"), (0, routeHandler_1.typedHandler)(controller_user_1.uploadAvatar)); // Upload avatar/profile picture
router.delete("/me", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_user_1.deleteCurrentUser)); // Delete own account
exports.default = router;
//# sourceMappingURL=route_user.js.map