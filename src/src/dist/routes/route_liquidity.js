"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const routeHandler_1 = require("../types/routeHandler");
const controller_liquidity_1 = require("../controllers/controller_liquidity");
const router = (0, express_1.Router)();
// Add liquidity to a market (creates LP token mint on first liquidity)
router.post("/add", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_liquidity_1.addLiquidity));
// Remove liquidity from a market (early withdrawal before resolution)
router.post("/remove", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_liquidity_1.removeLiquidity));
// Claim LP rewards after market resolution (burns LP tokens)
router.post("/claim", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_liquidity_1.claimLpRewards));
// Get user's LP position for a specific market
router.get("/position/:market", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_liquidity_1.getLpPosition));
// Get all LP positions for the current user
router.get("/positions", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_liquidity_1.getAllLpPositions));
// Get the current LP share value for a market (public)
router.get("/share-value/:market", (0, routeHandler_1.typedHandler)(controller_liquidity_1.calculateLpShareValue));
exports.default = router;
//# sourceMappingURL=route_liquidity.js.map