"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const routeHandler_1 = require("../types/routeHandler");
const controller_key_1 = require("../controllers/controller_key");
const router = (0, express_1.Router)();
// Key operations (protected)
router.post("/buy", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_key_1.buyKeys));
router.post("/sell", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_key_1.sellKeys));
router.get("/ownership/:trader_id", auth_1.authenticateToken, (0, validate_1.validateUUID)("trader_id"), (0, routeHandler_1.typedHandler)(controller_key_1.getKeyOwnership));
router.post("/set-required", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_key_1.setRequiredKeys));
// Public routes
router.get("/price/:trader_id", (0, validate_1.validateUUID)("trader_id"), (0, routeHandler_1.typedHandler)(controller_key_1.getKeyPrice));
router.get("/holders/:trader_id", (0, validate_1.validateUUID)("trader_id"), (0, routeHandler_1.typedHandler)(controller_key_1.getKeyHolders));
exports.default = router;
//# sourceMappingURL=route_key.js.map