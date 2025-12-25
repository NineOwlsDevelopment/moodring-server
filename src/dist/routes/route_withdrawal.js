"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const validate_1 = require("../middleware/validate");
const routeHandler_1 = require("../types/routeHandler");
const controller_withdrawal_1 = require("../controllers/controller_withdrawal");
const router = (0, express_1.Router)();
// @route POST /api/withdrawal/request - Request a withdrawal
router.post("/request", auth_1.authenticateToken, rateLimit_1.withdrawalLimiter, (0, routeHandler_1.typedHandler)(controller_withdrawal_1.requestWithdrawal));
// @route POST /api/withdrawal/:id/cancel - Cancel a pending withdrawal
router.post("/:id/cancel", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_withdrawal_1.cancelWithdrawal));
// @route GET /api/withdrawal/history - Get withdrawal history
router.get("/history", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_withdrawal_1.getWithdrawalHistory));
// @route GET /api/withdrawal/totals - Get total withdrawals
router.get("/totals", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_withdrawal_1.getWithdrawalTotals));
// @route GET /api/withdrawal/:id - Get a specific withdrawal
router.get("/:id", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_withdrawal_1.getWithdrawal));
exports.default = router;
//# sourceMappingURL=route_withdrawal.js.map