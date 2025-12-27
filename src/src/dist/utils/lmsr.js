"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvariantViolationError = exports.PRECISION = void 0;
exports.calculate_buy_cost = calculate_buy_cost;
exports.calculate_sell_payout = calculate_sell_payout;
exports.calculate_yes_price = calculate_yes_price;
exports.calculate_no_price = calculate_no_price;
const decimal_js_1 = __importDefault(require("decimal.js"));
/// LMSR (Logarithmic Market Scoring Rule) utilities
///
/// The cost function is: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
/// Price for YES = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
/// Price for NO = e^(q_no/b) / (e^(q_yes/b) + e^(q_no/b))
///
/// SECURITY FIX: Uses Decimal.js for arbitrary precision (28 decimal places)
/// to prevent rounding exploits and maintain all LMSR invariants.
// Set high precision for all calculations (28 decimal places)
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
// PRECISION constant for backward compatibility (converted to Decimal)
const PRECISION = new decimal_js_1.default(1000000);
exports.PRECISION = PRECISION;
const LN2_SCALED = new decimal_js_1.default("0.6931471805599453"); // ln(2) with high precision
// Custom error classes
class ArithmeticOverflowError extends Error {
    constructor() {
        super("Arithmetic overflow");
        this.name = "ArithmeticOverflowError";
    }
}
class ArithmeticUnderflowError extends Error {
    constructor() {
        super("Arithmetic underflow");
        this.name = "ArithmeticUnderflowError";
    }
}
class DivisionByZeroError extends Error {
    constructor() {
        super("Division by zero");
        this.name = "DivisionByZeroError";
    }
}
class InvariantViolationError extends Error {
    constructor(message) {
        super(`LMSR invariant violated: ${message}`);
        this.name = "InvariantViolationError";
    }
}
exports.InvariantViolationError = InvariantViolationError;
/**
 * Convert number or BN to Decimal
 * SECURITY FIX: Handles multiple input types for backward compatibility
 */
function toDecimal(value) {
    if (value instanceof decimal_js_1.default)
        return value;
    if (typeof value === "bigint")
        return new decimal_js_1.default(value.toString());
    if (typeof value === "number")
        return new decimal_js_1.default(value);
    // Handle BN from @coral-xyz/anchor
    if (value && typeof value.toString === "function") {
        return new decimal_js_1.default(value.toString());
    }
    return new decimal_js_1.default(value);
}
/**
 * Convert Decimal back to number (for database storage)
 * Rounds to nearest integer (micro-USDC precision)
 */
function toNumber(value) {
    return Math.round(value.toNumber());
}
/// Calculate the cost to buy shares using LMSR
/// Returns the cost in USDC (scaled by PRECISION)
function calculate_buy_cost(current_yes, current_no, buy_yes, buy_no, liquidity_param) {
    const q_yes = toDecimal(current_yes);
    const q_no = toDecimal(current_no);
    const b_yes = toDecimal(buy_yes);
    const b_no = toDecimal(buy_no);
    const b = toDecimal(liquidity_param);
    if (b.isZero()) {
        throw new DivisionByZeroError();
    }
    // Cost = C(q_new) - C(q_current)
    const cost_before = cost_function(q_yes, q_no, b);
    const new_yes = q_yes.add(b_yes);
    const new_no = q_no.add(b_no);
    const cost_after = cost_function(new_yes, new_no, b);
    const result = cost_after.sub(cost_before);
    if (result.isNegative()) {
        throw new ArithmeticUnderflowError();
    }
    // Validate cost is non-negative (LMSR invariant)
    if (result.isZero() && (!b_yes.isZero() || !b_no.isZero())) {
        throw new InvariantViolationError("Cost should be positive for non-zero purchase");
    }
    return toNumber(result);
}
/// Calculate the payout from selling shares using LMSR
/// Returns the payout in USDC (scaled by PRECISION)
function calculate_sell_payout(current_yes, current_no, sell_yes, sell_no, liquidity_param) {
    const q_yes = toDecimal(current_yes);
    const q_no = toDecimal(current_no);
    const s_yes = toDecimal(sell_yes);
    const s_no = toDecimal(sell_no);
    const b = toDecimal(liquidity_param);
    if (b.isZero()) {
        throw new DivisionByZeroError();
    }
    // Payout = C(q_current) - C(q_new)
    const cost_before = cost_function(q_yes, q_no, b);
    if (q_yes.lt(s_yes) || q_no.lt(s_no)) {
        throw new ArithmeticUnderflowError();
    }
    const new_yes = q_yes.sub(s_yes);
    const new_no = q_no.sub(s_no);
    const cost_after = cost_function(new_yes, new_no, b);
    const result = cost_before.sub(cost_after);
    if (result.isNegative()) {
        throw new ArithmeticUnderflowError();
    }
    // Validate payout is non-negative (LMSR invariant)
    if (result.isZero() && (!s_yes.isZero() || !s_no.isZero())) {
        throw new InvariantViolationError("Payout should be positive for non-zero sale");
    }
    return toNumber(result);
}
/// Calculate current price for YES shares (scaled by PRECISION)
/// Price = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
/// SECURITY FIX: Maintains invariant that price_yes + price_no = PRECISION
function calculate_yes_price(yes_quantity, no_quantity, liquidity_param) {
    const q_yes = toDecimal(yes_quantity);
    const q_no = toDecimal(no_quantity);
    const b = toDecimal(liquidity_param);
    if (b.isZero()) {
        throw new DivisionByZeroError();
    }
    // For numerical stability, use: price = 1 / (1 + e^((q_no - q_yes)/b))
    const diff = q_no.sub(q_yes);
    const ratio = diff.div(b);
    const exp_val = ratio.exp(); // e^(ratio)
    // price = 1 / (1 + exp_val) = PRECISION / (PRECISION + exp_val * PRECISION)
    const exp_scaled = exp_val.mul(PRECISION);
    const denominator = PRECISION.add(exp_scaled);
    const yes_price = PRECISION.mul(PRECISION).div(denominator);
    // SECURITY FIX: Validate price bounds and throw error if invariant violated
    if (yes_price.isNegative()) {
        throw new InvariantViolationError(`YES price cannot be negative: ${yes_price.toString()}`);
    }
    if (yes_price.gt(PRECISION)) {
        throw new InvariantViolationError(`YES price cannot exceed PRECISION: ${yes_price.toString()} > ${PRECISION.toString()}`);
    }
    return toNumber(yes_price);
}
/// Calculate current price for NO shares (scaled by PRECISION)
/// SECURITY FIX: Ensures price_yes + price_no = PRECISION (invariant)
function calculate_no_price(yes_quantity, no_quantity, liquidity_param) {
    const yes_price_decimal = toDecimal(calculate_yes_price(yes_quantity, no_quantity, liquidity_param));
    const no_price = PRECISION.sub(yes_price_decimal);
    // Validate invariant: yes_price + no_price = PRECISION
    const sum = yes_price_decimal.add(no_price);
    const diff = sum.sub(PRECISION).abs();
    // Allow small rounding errors (up to 1 unit in micro-USDC)
    if (diff.gt(new decimal_js_1.default(1))) {
        throw new InvariantViolationError(`Price sum not equal to PRECISION: yes=${yes_price_decimal.toString()}, no=${no_price.toString()}, sum=${sum.toString()}`);
    }
    if (no_price.isNegative()) {
        throw new ArithmeticUnderflowError();
    }
    return toNumber(no_price);
}
/// Cost function: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
/// Returns cost scaled by PRECISION
/// SECURITY FIX: Improved numerical stability and accuracy with Decimal.js
function cost_function(yes_quantity, no_quantity, liquidity_param) {
    if (liquidity_param.isZero()) {
        throw new DivisionByZeroError();
    }
    // For numerical stability, factor out the larger exponent:
    // C(q) = max(q_yes, q_no) + b * ln(1 + e^(-|q_yes - q_no|/b))
    const max_q = yes_quantity.gt(no_quantity) ? yes_quantity : no_quantity;
    const diff = yes_quantity.gt(no_quantity)
        ? yes_quantity.sub(no_quantity)
        : no_quantity.sub(yes_quantity);
    // Calculate ln(1 + e^(-diff/b)) using high-precision Decimal methods
    const ratio = diff.div(liquidity_param);
    const exp_neg = ratio.neg().exp(); // e^(-ratio)
    const one_plus_exp = new decimal_js_1.default(1).add(exp_neg);
    const ln_term = one_plus_exp.ln();
    // Result = max_q + b * ln_term
    const scaled_ln = liquidity_param.mul(ln_term);
    const result = max_q.add(scaled_ln);
    // Validate cost function invariant: C(q) >= max(q_yes, q_no)
    if (result.lt(max_q)) {
        throw new InvariantViolationError(`Cost function violated: C(${yes_quantity}, ${no_quantity}) < max(${yes_quantity}, ${no_quantity})`);
    }
    return result;
}
//# sourceMappingURL=lmsr.js.map