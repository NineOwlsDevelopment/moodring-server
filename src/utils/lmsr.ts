import { BN } from "@coral-xyz/anchor";

/// LMSR (Logarithmic Market Scoring Rule) utilities
///
/// The cost function is: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
/// Price for YES = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
/// Price for NO = e^(q_no/b) / (e^(q_yes/b) + e^(q_no/b))

const PRECISION = new BN(1_000_000);

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

/// Calculate the cost to buy shares using LMSR
/// Returns the cost in USDC (scaled by PRECISION)
export function calculate_buy_cost(
  current_yes: BN,
  current_no: BN,
  buy_yes: BN,
  buy_no: BN,
  liquidity_param: BN
): BN {
  // Cost = C(q_new) - C(q_current)
  const cost_before = cost_function(current_yes, current_no, liquidity_param);
  const new_yes = current_yes.add(buy_yes);
  const new_no = current_no.add(buy_no);
  const cost_after = cost_function(new_yes, new_no, liquidity_param);

  const result = cost_after.sub(cost_before);
  if (result.isNeg()) {
    throw new ArithmeticUnderflowError();
  }
  return result;
}

/// Calculate the payout from selling shares using LMSR
/// Returns the payout in USDC (scaled by PRECISION)
export function calculate_sell_payout(
  current_yes: BN,
  current_no: BN,
  sell_yes: BN,
  sell_no: BN,
  liquidity_param: BN
): BN {
  // Payout = C(q_current) - C(q_new)
  const cost_before = cost_function(current_yes, current_no, liquidity_param);

  if (current_yes.lt(sell_yes) || current_no.lt(sell_no)) {
    throw new ArithmeticUnderflowError();
  }

  const new_yes = current_yes.sub(sell_yes);
  const new_no = current_no.sub(sell_no);
  const cost_after = cost_function(new_yes, new_no, liquidity_param);

  const result = cost_before.sub(cost_after);
  if (result.isNeg()) {
    throw new ArithmeticUnderflowError();
  }
  return result;
}

/// Calculate current price for YES shares (scaled by PRECISION)
/// Price = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
export function calculate_yes_price(
  yes_quantity: BN,
  no_quantity: BN,
  liquidity_param: BN
): BN {
  if (liquidity_param.isZero()) {
    throw new DivisionByZeroError();
  }

  // For numerical stability, use: price = 1 / (1 + e^((q_no - q_yes)/b))
  let diff: BN;
  if (yes_quantity.gte(no_quantity)) {
    const d = yes_quantity.sub(no_quantity);
    // exp_approx returns negative exponent result: e^(-(yes-no)/b) = e^((no-yes)/b)
    const exp_val = exp_approx(d, liquidity_param, false);
    // price = 1 / (1 + exp_val) = PRECISION / (PRECISION + exp_val)
    const denominator = PRECISION.add(exp_val);
    diff = PRECISION.mul(PRECISION).div(denominator);
  } else {
    const d = no_quantity.sub(yes_quantity);
    // exp_approx returns positive exponent result: e^((no-yes)/b)
    const exp_val = exp_approx(d, liquidity_param, true);
    // price = 1 / (1 + exp_val) = PRECISION / (PRECISION + exp_val)
    // NOTE: Previously this was incorrectly computing exp_val/(1+exp_val) which is the NO price
    const denominator = PRECISION.add(exp_val);
    diff = PRECISION.mul(PRECISION).div(denominator);
  }

  // Clamp prices to reasonable bounds to prevent exact 0/1 values
  // This ensures LMSR prices stay within practical trading ranges
  const minPrice = PRECISION.divn(1000); // 0.001 scaled by PRECISION (1000)
  const maxPrice = PRECISION.muln(999).divn(1000); // 0.999 scaled by PRECISION (999000)

  // Ensure prices never reach exact boundaries
  if (diff.lte(minPrice) || diff.lte(new BN(0))) {
    return minPrice;
  } else if (diff.gte(maxPrice) || diff.gte(PRECISION)) {
    return maxPrice;
  }

  return diff;
}

/// Calculate current price for NO shares (scaled by PRECISION)
export function calculate_no_price(
  yes_quantity: BN,
  no_quantity: BN,
  liquidity_param: BN
): BN {
  const yes_price = calculate_yes_price(
    yes_quantity,
    no_quantity,
    liquidity_param
  );
  const result = PRECISION.sub(yes_price);
  if (result.isNeg()) {
    throw new ArithmeticUnderflowError();
  }
  return result;
}

/// Cost function: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
/// Returns cost scaled by PRECISION
function cost_function(
  yes_quantity: BN,
  no_quantity: BN,
  liquidity_param: BN
): BN {
  if (liquidity_param.isZero()) {
    throw new DivisionByZeroError();
  }

  // For numerical stability, factor out the larger exponent:
  // C(q) = b * [max(q_yes, q_no)/b + ln(1 + e^(-|q_yes - q_no|/b))]

  const max_q = yes_quantity.gt(no_quantity) ? yes_quantity : no_quantity;
  const diff = yes_quantity.gt(no_quantity)
    ? yes_quantity.sub(no_quantity)
    : no_quantity.sub(yes_quantity);

  // Calculate ln(1 + e^(-diff/b)) using approximation
  const ln_term = ln_one_plus_exp_approx(diff, liquidity_param);

  // Result = max_q + b * ln_term / PRECISION
  const scaled_ln = liquidity_param.mul(ln_term).div(PRECISION);

  return max_q.add(scaled_ln);
}

/// Approximate e^(x/b) using Taylor series
/// Returns value scaled by PRECISION
/// If is_positive is false, returns e^(-x/b)
function exp_approx(x: BN, b: BN, is_positive: boolean): BN {
  if (b.isZero()) {
    throw new DivisionByZeroError();
  }

  // Calculate x/b (scaled by PRECISION)
  const ratio = x.mul(PRECISION).div(b);

  // For extremely large ratios, cap to prevent performance issues and numerical instability
  // While BigNumbers can handle large numbers, extreme values can cause slow computations
  const maxRatio = PRECISION.muln(500); // Reasonable upper bound
  if (ratio.gt(maxRatio)) {
    return is_positive ? PRECISION.muln(1e15) : new BN(1); // Very large/small but finite
  }
  if (ratio.lt(maxRatio.neg())) {
    return is_positive ? new BN(1) : PRECISION.muln(1e15); // Very small/large but finite
  }

  // Taylor series: e^x ≈ 1 + x + x²/2! + x³/3! + x⁴/4! + ...
  // We'll compute up to x^4 for reasonable accuracy

  let result = PRECISION.clone(); // 1.0
  let term = ratio.clone();

  // Add x
  result = result.add(term);

  // Add x²/2!
  term = term.mul(ratio).div(PRECISION).divn(2);
  result = result.add(term);

  // Add x³/3!
  term = term.mul(ratio).div(PRECISION).divn(3);
  result = result.add(term);

  // Add x⁴/4!
  term = term.mul(ratio).div(PRECISION).divn(4);
  result = result.add(term);

  if (!is_positive) {
    // For e^(-x), return 1/result
    result = PRECISION.mul(PRECISION).div(result);
  }

  return result;
}

/// Approximate ln(1 + e^(-x/b)) for the cost function
/// Returns value scaled by PRECISION
function ln_one_plus_exp_approx(x: BN, b: BN): BN {
  if (b.isZero()) {
    throw new DivisionByZeroError();
  }

  // Calculate x/b (scaled by PRECISION)
  const ratio = x.mul(PRECISION).div(b);

  // For extremely large ratios, use approximations to prevent performance issues
  const maxRatio = PRECISION.muln(500);
  if (ratio.gt(maxRatio)) {
    return new BN(0); // ln(1 + e^(-large)) ≈ 0
  }

  // For small ratio t = x/b, use series around t=0:
  // ln(1 + e^{-t}) ≈ ln(2) - t/2 + t^2/8
  // ratio stores t scaled by PRECISION
  if (ratio.lt(PRECISION)) {
    // ln(2) * PRECISION
    const ln2_scaled = new BN(693_147);

    // - t/2 term: (ratio / 2)
    const half_t = ratio.divn(2);

    // + t^2/8 term: ((ratio * ratio) / PRECISION) / 8
    const t_sq_over_8 = ratio.mul(ratio).div(PRECISION).divn(8);

    // Assemble: ln2_scaled - half_t + t_sq_over_8
    const tmp = ln2_scaled.sub(half_t).add(t_sq_over_8);

    return tmp;
  }

  // For medium values, use approximation
  // ln(1 + e^(-x)) ≈ e^(-x) for x > 1
  const exp_neg = exp_approx(x, b, false);

  // ln(1 + y) ≈ y - y²/2 + y³/3 for small y
  let result = exp_neg.clone();

  // Subtract y²/2
  const term2 = exp_neg.mul(exp_neg).div(PRECISION).divn(2);
  result = result.sub(term2);

  // Add y³/3
  const term3 = term2.mul(exp_neg).div(PRECISION).divn(3);
  result = result.add(term3);

  return result;
}

// Export PRECISION for use in tests
export { PRECISION };
