"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const routeHandler_1 = require("../types/routeHandler");
const controller_resolution_1 = require("../controllers/controller_resolution");
const router = (0, express_1.Router)();
// Protected routes
router.post("/submit", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_resolution_1.submitResolution));
router.post("/dispute", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_resolution_1.disputeResolution));
// Public routes
router.get("/:marketId", (0, validate_1.validateUUID)("marketId"), (0, routeHandler_1.typedHandler)(controller_resolution_1.getResolution));
exports.default = router;
//# sourceMappingURL=route_resolution.js.map