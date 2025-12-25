"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const validate_1 = require("../middleware/validate");
const routeHandler_1 = require("../types/routeHandler");
const controller_trade_1 = require("../controllers/controller_trade");
const router = (0, express_1.Router)();
// Protected routes with rate limiting
router.post("/buy", auth_1.authenticateToken, rateLimit_1.tradeLimiter, (0, routeHandler_1.typedHandler)(controller_trade_1.buyShares));
router.post("/sell", auth_1.authenticateToken, rateLimit_1.tradeLimiter, (0, routeHandler_1.typedHandler)(controller_trade_1.sellShares));
router.post("/claim-winnings", auth_1.authenticateToken, rateLimit_1.claimLimiter, (0, routeHandler_1.typedHandler)(controller_trade_1.claimWinnings));
// Position routes
router.get("/position/:option", auth_1.authenticateToken, (0, validate_1.validateUUID)("option"), (0, routeHandler_1.typedHandler)(controller_trade_1.getPosition));
// Position routes
router.get("/position/:option", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_trade_1.getPosition));
router.get("/positions", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_trade_1.getAllPositions));
// Trade history routes
router.get("/history", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_trade_1.getTradeHistory));
router.get("/recent", (0, routeHandler_1.typedHandler)(controller_trade_1.getRecentTrades));
router.get("/market/:id", (0, routeHandler_1.typedHandler)(controller_trade_1.getMarketTrades));
// Price history routes (for charts)
// Note: More specific route must come before parameterized route
router.get("/price-history/market/:marketId", (0, routeHandler_1.typedHandler)(controller_trade_1.getMarketPriceHistory));
router.get("/price-history/:optionId", (0, routeHandler_1.typedHandler)(controller_trade_1.getPriceHistory));
router.get("/ohlc/:optionId", (0, routeHandler_1.typedHandler)(controller_trade_1.getOHLCData));
exports.default = router;
//# sourceMappingURL=route_trade.js.map