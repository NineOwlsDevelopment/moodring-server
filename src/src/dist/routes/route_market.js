"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const validate_1 = require("../middleware/validate");
const routeHandler_1 = require("../types/routeHandler");
const controller_market_1 = require("../controllers/controller_market");
const controller_admin_1 = require("../controllers/controller_admin");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Protected routes
router.get("/my-markets", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_market_1.getMyMarkets));
router.get("/watchlist", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_market_1.getWatchlist));
router.post("/create", auth_1.authenticateToken, rateLimit_1.marketCreationLimiter, upload.single("image"), (0, routeHandler_1.typedHandler)(controller_market_1.createMarket));
router.post("/option/create", auth_1.authenticateToken, upload.single("image"), (0, routeHandler_1.typedHandler)(controller_market_1.createOption));
router.put("/:id", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), upload.single("image"), (0, routeHandler_1.typedHandler)(controller_market_1.updateMarket));
router.put("/option/:id", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), upload.single("image"), (0, routeHandler_1.typedHandler)(controller_market_1.updateOption));
router.delete("/option/:id", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_market_1.deleteOption));
router.post("/initialize", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_market_1.initializeMarket));
router.post("/withdraw-creator-fee", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_market_1.withdrawCreatorFee));
router.post("/:id/watchlist", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_market_1.addToWatchlist));
router.delete("/:id/watchlist", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_market_1.removeFromWatchlist));
router.delete("/:id", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_market_1.deleteMarket));
router.get("/:id/watchlist/status", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_market_1.getWatchlistStatus));
// Public routes
router.get("/", (0, routeHandler_1.typedHandler)(controller_market_1.getMarkets));
router.get("/categories", (0, routeHandler_1.typedHandler)(controller_admin_1.getCategories));
router.get("/creation-fee", (0, routeHandler_1.typedHandler)(controller_market_1.getMarketCreationFee));
router.get("/featured", (0, routeHandler_1.typedHandler)(controller_market_1.getFeaturedMarkets));
router.get("/trending", (0, routeHandler_1.typedHandler)(controller_market_1.getTrendingMarkets));
router.get("/option/:option/fair-value", (0, validate_1.validateUUID)("option"), (0, routeHandler_1.typedHandler)(controller_market_1.getFairValue));
router.get("/:id", (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_market_1.getMarket));
router.get("/:id/oembed", (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_market_1.getMarketOEmbed));
router.get("/:id/meta", (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_market_1.getMarketMeta));
router.post("/estimate-buy", (0, routeHandler_1.typedHandler)(controller_market_1.estimateBuyCost));
router.post("/estimate-sell", (0, routeHandler_1.typedHandler)(controller_market_1.estimateSellPayout));
exports.default = router;
//# sourceMappingURL=route_market.js.map