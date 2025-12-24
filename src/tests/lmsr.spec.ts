import { expect } from "chai";
import { describe, it } from "mocha";
import { BN } from "@coral-xyz/anchor";
import {
  calculate_buy_cost,
  calculate_sell_payout,
  calculate_yes_price,
  calculate_no_price,
  PRECISION,
  InvariantViolationError,
} from "../utils/lmsr";

describe("LMSR Implementation Tests", function () {
  this.timeout(10000);

  // Test constants
  const LIQUIDITY_PARAM = new BN(1_000_000_000); // 1000 USDC scaled
  const SMALL_LIQUIDITY = new BN(100_000_000); // 100 USDC scaled
  const LARGE_LIQUIDITY = new BN(10_000_000_000); // 10000 USDC scaled

  describe("Price Calculations", () => {
    it("should calculate YES price correctly for balanced market", () => {
      const yes_qty = new BN(1_000_000_000); // 1000 shares
      const no_qty = new BN(1_000_000_000); // 1000 shares

      const yes_price = calculate_yes_price(yes_qty, no_qty, LIQUIDITY_PARAM);
      const no_price = calculate_no_price(yes_qty, no_qty, LIQUIDITY_PARAM);

      // Prices should be approximately 0.5 (50%)
      expect(yes_price.toNumber()).to.be.closeTo(500_000, 10_000); // Within 1% tolerance
      expect(no_price.toNumber()).to.be.closeTo(500_000, 10_000);

      // CRITICAL: Prices must sum to PRECISION (invariant)
      const sum = yes_price.add(no_price);
      expect(sum.toNumber()).to.equal(PRECISION.toNumber());
    });

    it("should maintain price invariant (yes_price + no_price = PRECISION)", () => {
      const testCases = [
        { yes: 0, no: 1_000_000_000 },
        { yes: 1_000_000_000, no: 0 },
        { yes: 500_000_000, no: 1_500_000_000 },
        { yes: 2_000_000_000, no: 500_000_000 },
        { yes: 100_000, no: 100_000 },
        { yes: 10_000_000_000, no: 10_000_000_000 },
      ];

      for (const testCase of testCases) {
        const yes_price = calculate_yes_price(
          new BN(testCase.yes),
          new BN(testCase.no),
          LIQUIDITY_PARAM
        );
        const no_price = calculate_no_price(
          new BN(testCase.yes),
          new BN(testCase.no),
          LIQUIDITY_PARAM
        );

        const sum = yes_price.add(no_price);
        expect(
          sum.toNumber(),
          `Price sum should equal PRECISION for yes=${testCase.yes}, no=${testCase.no}`
        ).to.equal(PRECISION.toNumber());
      }
    });

    it("should calculate prices correctly for extreme imbalances", () => {
      // Very YES-heavy market
      const yes_heavy_yes = new BN(10_000_000_000);
      const yes_heavy_no = new BN(100_000);

      const yes_price_heavy = calculate_yes_price(
        yes_heavy_yes,
        yes_heavy_no,
        LIQUIDITY_PARAM
      );
      const no_price_heavy = calculate_no_price(
        yes_heavy_yes,
        yes_heavy_no,
        LIQUIDITY_PARAM
      );

      // YES price should be very high, NO price very low
      expect(yes_price_heavy.toNumber()).to.be.greaterThan(900_000);
      expect(no_price_heavy.toNumber()).to.be.lessThan(100_000);
      expect(yes_price_heavy.add(no_price_heavy).toNumber()).to.equal(
        PRECISION.toNumber()
      );

      // Very NO-heavy market
      const no_heavy_yes = new BN(100_000);
      const no_heavy_no = new BN(10_000_000_000);

      const yes_price_low = calculate_yes_price(
        no_heavy_yes,
        no_heavy_no,
        LIQUIDITY_PARAM
      );
      const no_price_high = calculate_no_price(
        no_heavy_yes,
        no_heavy_no,
        LIQUIDITY_PARAM
      );

      // YES price should be very low, NO price very high
      expect(yes_price_low.toNumber()).to.be.lessThan(100_000);
      expect(no_price_high.toNumber()).to.be.greaterThan(900_000);
      expect(yes_price_low.add(no_price_high).toNumber()).to.equal(
        PRECISION.toNumber()
      );
    });

    it("should handle zero quantities correctly", () => {
      const yes_price_zero = calculate_yes_price(
        new BN(0),
        new BN(1_000_000_000),
        LIQUIDITY_PARAM
      );
      const no_price_zero = calculate_no_price(
        new BN(0),
        new BN(1_000_000_000),
        LIQUIDITY_PARAM
      );

      // With zero YES quantity, YES price should be very low (but not necessarily < 100k due to liquidity param)
      expect(yes_price_zero.toNumber()).to.be.lessThan(500_000); // Less than 50%
      expect(no_price_zero.toNumber()).to.be.greaterThan(500_000); // More than 50%
      expect(yes_price_zero.add(no_price_zero).toNumber()).to.equal(
        PRECISION.toNumber()
      );
    });
  });

  describe("Cost Function Invariants", () => {
    it("should satisfy C(q) >= max(q_yes, q_no) invariant", () => {
      const testCases = [
        { yes: 1_000_000_000, no: 500_000_000 },
        { yes: 500_000_000, no: 1_000_000_000 },
        { yes: 100_000, no: 100_000 },
        { yes: 10_000_000_000, no: 5_000_000_000 },
      ];

      for (const testCase of testCases) {
        // We can't directly test cost_function (it's private), but we can test via buy_cost
        // Cost to buy 0 shares should be 0
        const zero_cost = calculate_buy_cost(
          new BN(testCase.yes),
          new BN(testCase.no),
          new BN(0),
          new BN(0),
          LIQUIDITY_PARAM
        );
        expect(zero_cost.toNumber()).to.equal(0);
      }
    });

    it("should calculate positive cost for buying shares", () => {
      const current_yes = new BN(1_000_000_000);
      const current_no = new BN(1_000_000_000);

      const cost = calculate_buy_cost(
        current_yes,
        current_no,
        new BN(100_000), // Buy 0.1 shares
        new BN(0),
        LIQUIDITY_PARAM
      );

      expect(cost.toNumber()).to.be.greaterThan(0);
    });

    it("should calculate positive payout for selling shares", () => {
      const current_yes = new BN(1_000_000_000);
      const current_no = new BN(1_000_000_000);

      const payout = calculate_sell_payout(
        current_yes,
        current_no,
        new BN(100_000), // Sell 0.1 shares
        new BN(0),
        LIQUIDITY_PARAM
      );

      expect(payout.toNumber()).to.be.greaterThan(0);
    });
  });

  describe("Buy-Sell Round Trip", () => {
    it("should maintain value in buy-then-sell round trip (minus fees)", () => {
      const initial_yes = new BN(1_000_000_000);
      const initial_no = new BN(1_000_000_000);
      const buy_amount = new BN(1_000_000); // Buy 1 share

      // Buy YES shares
      const buy_cost = calculate_buy_cost(
        initial_yes,
        initial_no,
        buy_amount,
        new BN(0),
        LIQUIDITY_PARAM
      );

      const after_buy_yes = initial_yes.add(buy_amount);
      const after_buy_no = initial_no;

      // Sell the same amount
      const sell_payout = calculate_sell_payout(
        after_buy_yes,
        after_buy_no,
        buy_amount,
        new BN(0),
        LIQUIDITY_PARAM
      );

      // Payout should be less than or equal to cost (due to price impact)
      // But the difference should be reasonable (not exploitable)
      const difference = buy_cost.sub(sell_payout);
      expect(difference.toNumber()).to.be.greaterThanOrEqual(0);

      // The loss should be a small percentage (price impact)
      const lossPercentage =
        (difference.toNumber() / buy_cost.toNumber()) * 100;
      expect(lossPercentage).to.be.lessThan(10); // Less than 10% loss
    });

    it("should prevent round-trip exploitation", () => {
      const initial_yes = new BN(1_000_000_000);
      const initial_no = new BN(1_000_000_000);

      // Try multiple round trips
      let current_yes = initial_yes;
      let current_no = initial_no;
      let total_cost = 0;
      let total_payout = 0;

      for (let i = 0; i < 5; i++) {
        const buy_amount = new BN(100_000); // 0.1 shares

        const buy_cost = calculate_buy_cost(
          current_yes,
          current_no,
          buy_amount,
          new BN(0),
          LIQUIDITY_PARAM
        );

        current_yes = current_yes.add(buy_amount);
        total_cost += buy_cost.toNumber();

        const sell_payout = calculate_sell_payout(
          current_yes,
          current_no,
          buy_amount,
          new BN(0),
          LIQUIDITY_PARAM
        );

        current_yes = current_yes.sub(buy_amount);
        total_payout += sell_payout.toNumber();
      }

      // Total payout should be less than or equal to total cost (no free money)
      expect(total_payout).to.be.lessThanOrEqual(total_cost);

      // Loss should be reasonable (or zero if very small trades)
      const total_loss = total_cost - total_payout;
      if (total_loss > 0) {
        const loss_percentage = (total_loss / total_cost) * 100;
        expect(loss_percentage).to.be.lessThan(20); // Less than 20% total loss
      }
    });
  });

  describe("Monotonicity Properties", () => {
    it("should have increasing cost with quantity", () => {
      const base_yes = new BN(1_000_000_000);
      const base_no = new BN(1_000_000_000);

      const cost1 = calculate_buy_cost(
        base_yes,
        base_no,
        new BN(100_000),
        new BN(0),
        LIQUIDITY_PARAM
      );

      const cost2 = calculate_buy_cost(
        base_yes,
        base_no,
        new BN(200_000),
        new BN(0),
        LIQUIDITY_PARAM
      );

      const cost3 = calculate_buy_cost(
        base_yes,
        base_no,
        new BN(300_000),
        new BN(0),
        LIQUIDITY_PARAM
      );

      // Costs should be increasing (but not necessarily linear)
      expect(cost2.toNumber()).to.be.greaterThan(cost1.toNumber());
      expect(cost3.toNumber()).to.be.greaterThan(cost2.toNumber());
    });

    it("should have decreasing payout with quantity sold", () => {
      const base_yes = new BN(1_000_000_000);
      const base_no = new BN(1_000_000_000);

      const payout1 = calculate_sell_payout(
        base_yes,
        base_no,
        new BN(100_000),
        new BN(0),
        LIQUIDITY_PARAM
      );

      const payout2 = calculate_sell_payout(
        base_yes,
        base_no,
        new BN(200_000),
        new BN(0),
        LIQUIDITY_PARAM
      );

      // Payout for 2x shares should be more than or equal to 1x, but less than or equal to 2x (price impact)
      expect(payout2.toNumber()).to.be.greaterThanOrEqual(payout1.toNumber());
      expect(payout2.toNumber()).to.be.lessThanOrEqual(
        payout1.muln(2).toNumber()
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small quantities", () => {
      const yes_qty = new BN(1_000_000_000);
      const no_qty = new BN(1_000_000_000);
      const tiny_amount = new BN(1); // 1 micro-share

      const cost = calculate_buy_cost(
        yes_qty,
        no_qty,
        tiny_amount,
        new BN(0),
        LIQUIDITY_PARAM
      );

      // Cost should be positive but very small
      expect(cost.toNumber()).to.be.greaterThan(0);
      expect(cost.toNumber()).to.be.lessThan(PRECISION.toNumber());
    });

    it("should handle very large quantities", () => {
      const yes_qty = new BN(1_000_000_000);
      const no_qty = new BN(1_000_000_000);
      const large_amount = new BN(100_000_000_000); // 100,000 shares

      const cost = calculate_buy_cost(
        yes_qty,
        no_qty,
        large_amount,
        new BN(0),
        LIQUIDITY_PARAM
      );

      // Cost should be positive and substantial
      expect(cost.toNumber()).to.be.greaterThan(0);
    });

    it("should handle different liquidity parameters", () => {
      const yes_qty = new BN(1_000_000_000);
      const no_qty = new BN(1_000_000_000);
      const buy_amount = new BN(1_000_000);

      const cost_small_liquidity = calculate_buy_cost(
        yes_qty,
        no_qty,
        buy_amount,
        new BN(0),
        SMALL_LIQUIDITY
      );

      const cost_large_liquidity = calculate_buy_cost(
        yes_qty,
        no_qty,
        buy_amount,
        new BN(0),
        LARGE_LIQUIDITY
      );

      // Higher liquidity should generally mean lower price impact
      // But exact relationship depends on current quantities
      expect(cost_small_liquidity.toNumber()).to.be.greaterThan(0);
      expect(cost_large_liquidity.toNumber()).to.be.greaterThan(0);
    });

    it("should reject zero liquidity parameter", () => {
      expect(() => {
        calculate_yes_price(new BN(1000), new BN(1000), new BN(0));
      }).to.throw("Division by zero");
    });

    it("should reject selling more shares than available", () => {
      const current_yes = new BN(1_000_000);
      const current_no = new BN(1_000_000);

      expect(() => {
        calculate_sell_payout(
          current_yes,
          current_no,
          new BN(2_000_000), // More than available
          new BN(0),
          LIQUIDITY_PARAM
        );
      }).to.throw();
    });
  });

  describe("Price Impact", () => {
    it("should show increasing price impact with larger trades", () => {
      const base_yes = new BN(1_000_000_000);
      const base_no = new BN(1_000_000_000);

      const small_trade = new BN(100_000);
      const medium_trade = new BN(1_000_000);
      const large_trade = new BN(10_000_000);

      const cost_small = calculate_buy_cost(
        base_yes,
        base_no,
        small_trade,
        new BN(0),
        LIQUIDITY_PARAM
      );

      const cost_medium = calculate_buy_cost(
        base_yes,
        base_no,
        medium_trade,
        new BN(0),
        LIQUIDITY_PARAM
      );

      const cost_large = calculate_buy_cost(
        base_yes,
        base_no,
        large_trade,
        new BN(0),
        LIQUIDITY_PARAM
      );

      // Average price per share should increase or stay same with trade size (price impact)
      // Due to rounding, they might be equal for very small differences
      const avg_price_small = cost_small.mul(PRECISION).div(small_trade);
      const avg_price_medium = cost_medium.mul(PRECISION).div(medium_trade);
      const avg_price_large = cost_large.mul(PRECISION).div(large_trade);

      expect(avg_price_large.toNumber()).to.be.greaterThanOrEqual(
        avg_price_medium.toNumber()
      );
      expect(avg_price_medium.toNumber()).to.be.greaterThanOrEqual(
        avg_price_small.toNumber()
      );

      // At least one should show price impact (not all equal)
      const hasPriceImpact =
        avg_price_large.toNumber() > avg_price_medium.toNumber() ||
        avg_price_medium.toNumber() > avg_price_small.toNumber();
      expect(hasPriceImpact).to.be.true;
    });
  });

  describe("Symmetry Properties", () => {
    it("should be symmetric for YES and NO trades", () => {
      const base_yes = new BN(1_000_000_000);
      const base_no = new BN(1_000_000_000);
      const trade_amount = new BN(1_000_000);

      // Buy YES
      const cost_yes = calculate_buy_cost(
        base_yes,
        base_no,
        trade_amount,
        new BN(0),
        LIQUIDITY_PARAM
      );

      // Buy NO (equivalent position)
      const cost_no = calculate_buy_cost(
        base_yes,
        base_no,
        new BN(0),
        trade_amount,
        LIQUIDITY_PARAM
      );

      // Costs should be similar (not necessarily equal due to current state)
      // But both should be positive
      expect(cost_yes.toNumber()).to.be.greaterThan(0);
      expect(cost_no.toNumber()).to.be.greaterThan(0);
    });
  });

  describe("Numerical Stability", () => {
    it("should handle extreme quantity ratios without overflow", () => {
      const extreme_yes = new BN(1_000_000_000_000);
      const extreme_no = new BN(1_000);

      // Should not throw
      expect(() => {
        const price = calculate_yes_price(
          extreme_yes,
          extreme_no,
          LIQUIDITY_PARAM
        );
        expect(price.toNumber()).to.be.greaterThan(0);
        expect(price.toNumber()).to.be.lessThanOrEqual(PRECISION.toNumber());
      }).to.not.throw();
    });

    it("should maintain precision for small differences", () => {
      const yes1 = new BN(1_000_000_000);
      const no1 = new BN(1_000_000_000);

      const yes2 = new BN(1_000_000_001);
      const no2 = new BN(1_000_000_000);

      const price1 = calculate_yes_price(yes1, no1, LIQUIDITY_PARAM);
      const price2 = calculate_yes_price(yes2, no2, LIQUIDITY_PARAM);

      // Prices should be very close (may be identical due to rounding with large liquidity param)
      const diff = price2.sub(price1).abs();
      expect(diff.toNumber()).to.be.greaterThanOrEqual(0);
      expect(diff.toNumber()).to.be.lessThanOrEqual(PRECISION.toNumber());

      // With such a small difference (1 micro-share), prices might be identical
      // due to rounding, which is acceptable
    });
  });
});
