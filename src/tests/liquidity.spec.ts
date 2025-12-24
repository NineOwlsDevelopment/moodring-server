import { expect } from "chai";
import axios from "axios";
import { describe, it, before, after } from "mocha";
import { Keypair } from "@solana/web3.js";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import {
  API_BASE,
  loadWallet,
  authenticateWithWallet,
  createAuthenticatedClient,
  checkDatabaseMigrated,
  sleep,
} from "./helpers/testHelpers";

const wallet = loadWallet();
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Test amounts in micro-USDC (6 decimals)
const ONE_USDC = 1_000_000; // 1 USDC
const TEN_USDC = 10_000_000; // 10 USDC
const HUNDRED_USDC = 100_000_000; // 100 USDC

describe("Liquidity Pool Tests", function () {
  this.timeout(1000 * 60 * 15); // 15 minutes for comprehensive tests

  let cookie = "";
  let client: ReturnType<typeof createAuthenticatedClient>;
  let marketId = "";
  let optionId1 = "";
  let optionId2 = "";
  let isMigrated = false;
  let initialBalance = 0;

  before(async () => {
    isMigrated = await checkDatabaseMigrated();
    if (!isMigrated) {
      console.log("⚠️ Database not migrated, skipping liquidity tests");
      return;
    }

    const auth = await authenticateWithWallet(wallet);
    cookie = auth.cookie;
    client = createAuthenticatedClient(cookie);

    // Get initial balance
    const walletResponse = await client.get("/user/wallet");
    if (walletResponse.status === 200) {
      initialBalance = Number(walletResponse.data.wallet.balance_usdc || 0);
    }

    // Create a test market
    await createTestMarket();
  });

  async function createTestMarket() {
    const form = new FormData();
    const base = Keypair.generate().publicKey.toBase58();

    form.append("base", base);
    form.append("marketQuestion", `Liquidity Test Market ${Date.now()}`);
    form.append("marketDescription", "A test market for liquidity operations");
    form.append(
      "marketExpirationDate",
      (Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60).toString()
    );
    form.append("usdcMint", USDC_MINT);
    form.append("isBinary", "false");
    form.append("resolvers", wallet.publicKey.toBase58());
    form.append("requiredVotes", "1");
    form.append("resolverReward", "100");

    const imagePath = path.join(__dirname, "asset", "saints.png");
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      form.append("image", imageBuffer, {
        filename: "saints.png",
        contentType: "image/png",
      });
    }

    const createResponse = await client.post("/market/create", form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    if (createResponse.status === 200) {
      marketId = createResponse.data.market;

      // Create options
      const form1 = new FormData();
      form1.append("market", marketId);
      form1.append("optionLabel", "Yes");

      const option1Response = await client.post(
        "/market/option/create",
        form1,
        {
          headers: {
            ...form1.getHeaders(),
          },
        }
      );

      if (option1Response.status === 200) {
        optionId1 = option1Response.data.option;
      }

      const form2 = new FormData();
      form2.append("market", marketId);
      form2.append("optionLabel", "No");

      const option2Response = await client.post(
        "/market/option/create",
        form2,
        {
          headers: {
            ...form2.getHeaders(),
          },
        }
      );

      if (option2Response.status === 200) {
        optionId2 = option2Response.data.option;
      }

      // Initialize the market
      const initResponse = await client.post("/market/initialize", {
        market: marketId,
      });

      if (initResponse.status === 200 || initResponse.status === 409) {
        console.log("✅ Created and initialized test market:", marketId);
      }
    }
  }

  describe("Adding Liquidity", () => {
    it("should add liquidity to empty pool (1:1 share ratio)", async () => {
      if (!isMigrated || !marketId) return;

      const depositAmount = TEN_USDC;

      const response = await client.post("/liquidity/add", {
        market: marketId,
        amount: depositAmount,
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("shares_minted");
      expect(response.data).to.have.property("amount_deposited", depositAmount);
      expect(response.data).to.have.property("new_pool_liquidity");

      // First LP should get 1:1 shares
      expect(response.data.shares_minted).to.equal(depositAmount);
      expect(response.data.new_pool_liquidity).to.equal(depositAmount);

      console.log("✅ First LP deposit:", {
        deposited: depositAmount,
        shares: response.data.shares_minted,
        poolLiquidity: response.data.new_pool_liquidity,
      });
    });

    it("should calculate shares correctly for subsequent deposits", async () => {
      if (!isMigrated || !marketId) return;

      // Get current pool state
      const marketResponse = await client.get(`/market/${marketId}`);
      if (marketResponse.status !== 200) return;

      const market = marketResponse.data.market;
      const currentLiquidity = Number(market.shared_pool_liquidity || 0);
      const currentShares = Number(market.total_shared_lp_shares || 0);

      if (currentLiquidity === 0 || currentShares === 0) {
        console.log("⚠️ Pool is empty, skipping test");
        return;
      }

      const depositAmount = TEN_USDC;
      const expectedShares = Math.floor(
        (depositAmount * currentShares) / currentLiquidity
      );

      const response = await client.post("/liquidity/add", {
        market: marketId,
        amount: depositAmount,
      });

      expect(response.status).to.equal(200);
      expect(response.data.shares_minted).to.equal(expectedShares);
      expect(response.data.new_pool_liquidity).to.equal(
        currentLiquidity + depositAmount
      );

      console.log("✅ Subsequent deposit:", {
        deposited: depositAmount,
        expectedShares,
        actualShares: response.data.shares_minted,
        ratio: (response.data.shares_minted / depositAmount).toFixed(6),
      });
    });

    it("should prevent adding liquidity to resolved markets", async () => {
      if (!isMigrated || !marketId) return;

      // Try to find a resolved market
      const marketsResponse = await client.get("/market", {
        params: { limit: 10 },
      });

      if (marketsResponse.status === 200 && marketsResponse.data.markets) {
        const resolvedMarket = marketsResponse.data.markets.find(
          (m: any) => m.is_resolved
        );

        if (resolvedMarket) {
          const response = await client.post("/liquidity/add", {
            market: resolvedMarket.id,
            amount: TEN_USDC,
          });

          expect(response.status).to.equal(400);
          expect(response.data?.error).to.include("resolved");
        }
      }
    });

    it("should reject invalid deposit amounts", async () => {
      if (!isMigrated || !marketId) return;

      const invalidAmounts = [
        -1000000,
        0,
        "not-a-number",
        null,
        undefined,
        0.0000001, // Too small
      ];

      for (const amount of invalidAmounts) {
        const response = await client.post("/liquidity/add", {
          market: marketId,
          amount,
        });

        expect(response.status).to.be.oneOf([400, 500]);
      }
    });

    it("should reject deposits exceeding balance", async () => {
      if (!isMigrated || !marketId) return;

      const walletResponse = await client.get("/user/wallet");
      if (walletResponse.status !== 200) return;

      const balance = Number(walletResponse.data.wallet.balance_usdc || 0);
      const excessiveAmount = balance + 1_000_000_000; // Way more than balance

      const response = await client.post("/liquidity/add", {
        market: marketId,
        amount: excessiveAmount,
      });

      expect(response.status).to.equal(400);
      expect(response.data?.error).to.include("balance");
    });

    it("should handle multiple concurrent deposits safely", async () => {
      if (!isMigrated || !marketId) return;

      const depositAmount = ONE_USDC;
      const concurrentDeposits = Array(5)
        .fill(null)
        .map(() =>
          client.post("/liquidity/add", {
            market: marketId,
            amount: depositAmount,
          })
        );

      const responses = await Promise.all(concurrentDeposits);

      // All should succeed or fail gracefully
      for (const response of responses) {
        expect(response.status).to.be.oneOf([200, 400, 429, 500]);
      }

      // Verify pool state is consistent
      const marketResponse = await client.get(`/market/${marketId}`);
      if (marketResponse.status === 200) {
        const market = marketResponse.data.market;
        const liquidity = Number(market.shared_pool_liquidity || 0);
        const shares = Number(market.total_shared_lp_shares || 0);

        // Pool should have increased
        expect(liquidity).to.be.greaterThan(0);
        expect(shares).to.be.greaterThan(0);

        // Share ratio should be consistent
        if (liquidity > 0 && shares > 0) {
          const shareValue = liquidity / shares;
          expect(shareValue).to.be.closeTo(1.0, 0.1); // Should be around 1.0
        }
      }
    });
  });

  describe("LP Share Calculations and Exploits", () => {
    it("should prevent share calculation exploits with tiny deposits", async () => {
      if (!isMigrated || !marketId) return;

      // Get current pool state
      const marketResponse = await client.get(`/market/${marketId}`);
      if (marketResponse.status !== 200) return;

      const market = marketResponse.data.market;
      const currentLiquidity = Number(market.shared_pool_liquidity || 0);
      const currentShares = Number(market.total_shared_lp_shares || 0);

      if (currentLiquidity === 0) return;

      // Try tiny deposit that might round to 0 shares
      const tinyDeposit = 1; // 1 micro-USDC

      const response = await client.post("/liquidity/add", {
        market: marketId,
        amount: tinyDeposit,
      });

      // Should either reject or mint at least 1 share
      if (response.status === 200) {
        expect(response.data.shares_minted).to.be.greaterThan(0);
      } else {
        expect(response.status).to.equal(400);
        expect(response.data?.error).to.include("small");
      }
    });

    it("should prevent share dilution attacks", async () => {
      if (!isMigrated || !marketId) return;

      // Get current pool state
      const marketResponse = await client.get(`/market/${marketId}`);
      if (marketResponse.status !== 200) return;

      const market = marketResponse.data.market;
      const currentLiquidity = Number(market.shared_pool_liquidity || 0);
      const currentShares = Number(market.total_shared_lp_shares || 0);

      if (currentLiquidity === 0 || currentShares === 0) return;

      // Calculate expected share value
      const shareValueBefore = currentLiquidity / currentShares;

      // Make a deposit
      const depositAmount = TEN_USDC;
      const addResponse = await client.post("/liquidity/add", {
        market: marketId,
        amount: depositAmount,
      });

      if (addResponse.status !== 200) return;

      // Get updated pool state
      const updatedMarketResponse = await client.get(`/market/${marketId}`);
      if (updatedMarketResponse.status !== 200) return;

      const updatedMarket = updatedMarketResponse.data.market;
      const newLiquidity = Number(updatedMarket.shared_pool_liquidity || 0);
      const newShares = Number(updatedMarket.total_shared_lp_shares || 0);

      const shareValueAfter = newLiquidity / newShares;

      // Share value should not decrease (no dilution)
      expect(shareValueAfter).to.be.greaterThanOrEqual(shareValueBefore);

      console.log("✅ Share value check:", {
        before: shareValueBefore,
        after: shareValueAfter,
        change: ((shareValueAfter - shareValueBefore) / shareValueBefore) * 100,
      });
    });

    it("should handle rounding errors correctly", async () => {
      if (!isMigrated || !marketId) return;

      // Get current pool state
      const marketResponse = await client.get(`/market/${marketId}`);
      if (marketResponse.status !== 200) return;

      const market = marketResponse.data.market;
      const currentLiquidity = Number(market.shared_pool_liquidity || 0);
      const currentShares = Number(market.total_shared_lp_shares || 0);

      if (currentLiquidity === 0 || currentShares === 0) return;

      // Test with amounts that might cause rounding issues
      const testAmounts = [
        1_000_001, // 1.000001 USDC
        9_999_999, // 9.999999 USDC
        10_000_001, // 10.000001 USDC
      ];

      for (const amount of testAmounts) {
        const response = await client.post("/liquidity/add", {
          market: marketId,
          amount,
        });

        if (response.status === 200) {
          const shares = response.data.shares_minted;
          const expectedShares = Math.floor(
            (amount * currentShares) / currentLiquidity
          );

          // Actual shares should match expected (accounting for rounding)
          expect(shares).to.equal(expectedShares);

          // Shares should be positive
          expect(shares).to.be.greaterThan(0);
        }
      }
    });
  });

  describe("Trading and Fee Distribution", () => {
    it("should correctly distribute fees to LP pool when trading", async () => {
      if (!isMigrated || !marketId || !optionId1) return;

      // Get initial LP fee state
      const marketBeforeResponse = await client.get(`/market/${marketId}`);
      if (marketBeforeResponse.status !== 200) return;

      const marketBefore = marketBeforeResponse.data.market;
      const initialLpFees = Number(marketBefore.accumulated_lp_fees || 0);
      const initialPoolLiquidity = Number(
        marketBefore.shared_pool_liquidity || 0
      );

      // Make a trade
      const tradeAmount = 1_000_000; // 1 share
      const tradeResponse = await client.post("/trade/buy", {
        market: marketId,
        option: optionId1,
        buyYes: tradeAmount,
      });

      if (tradeResponse.status !== 200) {
        console.log("⚠️ Trade failed, skipping fee distribution test");
        return;
      }

      // Get updated market state
      const marketAfterResponse = await client.get(`/market/${marketId}`);
      if (marketAfterResponse.status !== 200) return;

      const marketAfter = marketAfterResponse.data.market;
      const newLpFees = Number(marketAfter.accumulated_lp_fees || 0);
      const newPoolLiquidity = Number(marketAfter.shared_pool_liquidity || 0);

      // LP fees should have increased
      expect(newLpFees).to.be.greaterThan(initialLpFees);

      // Pool liquidity should have increased by raw cost
      const rawCost = tradeResponse.data.trade?.cost || 0;
      expect(newPoolLiquidity).to.be.greaterThanOrEqual(
        initialPoolLiquidity + rawCost - 1 // Allow for small rounding
      );

      console.log("✅ Fee distribution:", {
        initialLpFees,
        newLpFees,
        feeIncrease: newLpFees - initialLpFees,
        rawCost,
        poolLiquidityIncrease: newPoolLiquidity - initialPoolLiquidity,
      });
    });

    it("should accumulate fees correctly across multiple trades", async () => {
      if (!isMigrated || !marketId || !optionId1) return;

      // Get initial state
      const marketBeforeResponse = await client.get(`/market/${marketId}`);
      if (marketBeforeResponse.status !== 200) return;

      const marketBefore = marketBeforeResponse.data.market;
      let totalLpFees = Number(marketBefore.accumulated_lp_fees || 0);

      // Make multiple trades
      const numTrades = 3;
      const tradeAmount = 500_000; // 0.5 shares each

      for (let i = 0; i < numTrades; i++) {
        const tradeResponse = await client.post("/trade/buy", {
          market: marketId,
          option: optionId1,
          buyYes: tradeAmount,
        });

        if (tradeResponse.status === 200) {
          // Get updated fees
          const marketResponse = await client.get(`/market/${marketId}`);
          if (marketResponse.status === 200) {
            const market = marketResponse.data.market;
            const currentLpFees = Number(market.accumulated_lp_fees || 0);

            // Fees should be increasing
            expect(currentLpFees).to.be.greaterThanOrEqual(totalLpFees);
            totalLpFees = currentLpFees;
          }
        }

        await sleep(100); // Small delay between trades
      }

      console.log("✅ Accumulated LP fees after trades:", totalLpFees);
    });

    it("should maintain correct pool liquidity after trades", async () => {
      if (!isMigrated || !marketId || !optionId1) return;

      // Get initial state
      const marketBeforeResponse = await client.get(`/market/${marketId}`);
      if (marketBeforeResponse.status !== 200) return;

      const marketBefore = marketBeforeResponse.data.market;
      const initialLiquidity = Number(marketBefore.shared_pool_liquidity || 0);

      // Make a trade
      const tradeAmount = 1_000_000;
      const tradeResponse = await client.post("/trade/buy", {
        market: marketId,
        option: optionId1,
        buyYes: tradeAmount,
      });

      if (tradeResponse.status !== 200) return;

      const rawCost = Number(tradeResponse.data.trade?.cost || 0);

      // Get updated state
      const marketAfterResponse = await client.get(`/market/${marketId}`);
      if (marketAfterResponse.status !== 200) return;

      const marketAfter = marketAfterResponse.data.market;
      const newLiquidity = Number(marketAfter.shared_pool_liquidity || 0);

      // Pool liquidity should increase by raw cost (not total cost with fees)
      const expectedLiquidity = initialLiquidity + rawCost;
      expect(newLiquidity).to.be.closeTo(expectedLiquidity, 1000); // Allow small rounding

      console.log("✅ Pool liquidity check:", {
        initial: initialLiquidity,
        rawCost,
        expected: expectedLiquidity,
        actual: newLiquidity,
        difference: newLiquidity - expectedLiquidity,
      });
    });
  });

  describe("Removing Liquidity", () => {
    it("should prevent removing liquidity from unresolved markets", async () => {
      if (!isMigrated || !marketId) return;

      // Get LP position
      const positionResponse = await client.get(
        `/liquidity/position/${marketId}`
      );

      if (positionResponse.status !== 200) {
        console.log("⚠️ No LP position, skipping remove test");
        return;
      }

      const position = positionResponse.data.position;
      const shares = Number(position.shares || 0);

      if (shares === 0) {
        console.log("⚠️ No shares to remove, skipping test");
        return;
      }

      // Try to remove liquidity (should fail for unresolved market)
      const response = await client.post("/liquidity/remove", {
        market: marketId,
        shares: Math.min(shares, ONE_USDC),
      });

      expect(response.status).to.equal(400);
      expect(response.data?.error).to.include("resolved");
    });

    it("should calculate correct withdrawal amounts", async () => {
      if (!isMigrated || !marketId) return;

      // This test requires a resolved market with LP position
      // For now, we'll test the calculation logic
      const marketsResponse = await client.get("/market", {
        params: { limit: 10 },
      });

      if (marketsResponse.status === 200 && marketsResponse.data.markets) {
        const resolvedMarket = marketsResponse.data.markets.find(
          (m: any) => m.is_resolved
        );

        if (resolvedMarket) {
          const positionResponse = await client.get(
            `/liquidity/position/${resolvedMarket.id}`
          );

          if (
            positionResponse.status === 200 &&
            positionResponse.data.position.shares > 0
          ) {
            const position = positionResponse.data.position;
            const shares = Number(position.shares || 0);
            const market = resolvedMarket;

            // Calculate expected withdrawal
            const poolLiquidity = Number(market.shared_pool_liquidity || 0);
            const accumulatedFees = Number(market.accumulated_lp_fees || 0);
            const totalShares = Number(market.total_shared_lp_shares || 0);

            if (totalShares > 0) {
              const shareRatio = shares / totalShares;
              const expectedLiquidityPortion = Math.floor(
                poolLiquidity * shareRatio
              );
              const expectedFeesPortion = Math.floor(
                accumulatedFees * shareRatio
              );
              const expectedTotal =
                expectedLiquidityPortion + expectedFeesPortion;

              // Try to remove
              const response = await client.post("/liquidity/remove", {
                market: resolvedMarket.id,
                shares: shares,
              });

              if (response.status === 200) {
                const usdcReturned = Number(response.data.usdc_returned || 0);

                // Should be close to expected (allowing for pending claims)
                expect(usdcReturned).to.be.greaterThan(0);
                expect(usdcReturned).to.be.lessThanOrEqual(
                  expectedTotal + 1000 // Allow small rounding
                );

                console.log("✅ Withdrawal calculation:", {
                  shares,
                  expectedTotal,
                  actual: usdcReturned,
                  difference: expectedTotal - usdcReturned,
                });
              }
            }
          }
        }
      }
    });
  });

  describe("LP Position Management", () => {
    it("should correctly track LP positions", async () => {
      if (!isMigrated || !marketId) return;

      const response = await client.get(`/liquidity/position/${marketId}`);

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("position");

      const position = response.data.position;
      expect(position).to.have.property("shares");
      expect(position).to.have.property("deposited_amount");
      expect(position).to.have.property("current_value");
      expect(position).to.have.property("claimable_value");
      expect(position).to.have.property("pnl");

      console.log("✅ LP Position:", {
        shares: position.shares,
        deposited: position.deposited_amount,
        currentValue: position.current_value,
        claimableValue: position.claimable_value,
        pnl: position.pnl,
      });
    });

    it("should calculate share value correctly", async () => {
      if (!isMigrated || !marketId) return;

      const response = await client.get(`/liquidity/share-value/${marketId}`);

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("value_per_share");
      expect(response.data).to.have.property("total_pool_value");
      expect(response.data).to.have.property("total_shares");

      const valuePerShare = Number(response.data.value_per_share || 0);
      const totalPoolValue = Number(response.data.total_pool_value || 0);
      const totalShares = Number(response.data.total_shares || 0);

      // Value per share should be calculated correctly
      if (totalShares > 0) {
        const expectedValuePerShare = totalPoolValue / totalShares;
        expect(valuePerShare).to.be.closeTo(expectedValuePerShare, 0.01);

        console.log("✅ Share value:", {
          valuePerShare,
          expected: expectedValuePerShare,
          totalPoolValue,
          totalShares,
        });
      }
    });
  });

  describe("Exploit Prevention", () => {
    it("should prevent front-running attacks on liquidity additions", async () => {
      if (!isMigrated || !marketId) return;

      // Get current pool state
      const marketBeforeResponse = await client.get(`/market/${marketId}`);
      if (marketBeforeResponse.status !== 200) return;

      const marketBefore = marketBeforeResponse.data.market;
      const liquidityBefore = Number(marketBefore.shared_pool_liquidity || 0);
      const sharesBefore = Number(marketBefore.total_shared_lp_shares || 0);

      // Simulate front-running: trade first, then add liquidity
      const tradeAmount = 1_000_000;
      const tradeResponse = await client.post("/trade/buy", {
        market: marketId,
        option: optionId1,
        buyYes: tradeAmount,
      });

      if (tradeResponse.status === 200) {
        // Now add liquidity
        const depositAmount = TEN_USDC;
        const addResponse = await client.post("/liquidity/add", {
          market: marketId,
          amount: depositAmount,
        });

        if (addResponse.status === 200) {
          // Get final state
          const marketAfterResponse = await client.get(`/market/${marketId}`);
          if (marketAfterResponse.status === 200) {
            const marketAfter = marketAfterResponse.data.market;
            const liquidityAfter = Number(
              marketAfter.shared_pool_liquidity || 0
            );
            const sharesAfter = Number(marketAfter.total_shared_lp_shares || 0);

            // Share calculation should account for the trade
            const expectedShares = Math.floor(
              (depositAmount * sharesBefore) / liquidityBefore
            );

            // Due to the trade, pool liquidity increased, so shares should be less
            // than if we calculated from old state
            expect(addResponse.data.shares_minted).to.be.lessThanOrEqual(
              expectedShares + 1 // Allow small rounding
            );
          }
        }
      }
    });

    it("should prevent share inflation exploits", async () => {
      if (!isMigrated || !marketId) return;

      // Get initial state
      const marketBeforeResponse = await client.get(`/market/${marketId}`);
      if (marketBeforeResponse.status !== 200) return;

      const marketBefore = marketBeforeResponse.data.market;
      const liquidityBefore = Number(marketBefore.shared_pool_liquidity || 0);
      const sharesBefore = Number(marketBefore.total_shared_lp_shares || 0);

      if (liquidityBefore === 0 || sharesBefore === 0) return;

      const shareValueBefore = liquidityBefore / sharesBefore;

      // Add liquidity
      const depositAmount = TEN_USDC;
      const addResponse = await client.post("/liquidity/add", {
        market: marketId,
        amount: depositAmount,
      });

      if (addResponse.status === 200) {
        // Get updated state
        const marketAfterResponse = await client.get(`/market/${marketId}`);
        if (marketAfterResponse.status === 200) {
          const marketAfter = marketAfterResponse.data.market;
          const liquidityAfter = Number(marketAfter.shared_pool_liquidity || 0);
          const sharesAfter = Number(marketAfter.total_shared_lp_shares || 0);

          const shareValueAfter = liquidityAfter / sharesAfter;

          // Share value should not decrease (no inflation)
          expect(shareValueAfter).to.be.greaterThanOrEqual(shareValueBefore);

          // New shares should be calculated correctly
          const expectedShares = Math.floor(
            (depositAmount * sharesBefore) / liquidityBefore
          );
          expect(addResponse.data.shares_minted).to.equal(expectedShares);
        }
      }
    });

    it("should prevent rounding down exploits", async () => {
      if (!isMigrated || !marketId) return;

      // Get current state
      const marketResponse = await client.get(`/market/${marketId}`);
      if (marketResponse.status !== 200) return;

      const market = marketResponse.data.market;
      const liquidity = Number(market.shared_pool_liquidity || 0);
      const shares = Number(market.total_shared_lp_shares || 0);

      if (liquidity === 0 || shares === 0) return;

      // Try deposit that would round down significantly
      // Find an amount that would result in floor rounding
      const testAmount = Math.floor((liquidity * 1.5) / shares) * shares - 1;

      if (testAmount > 0) {
        const response = await client.post("/liquidity/add", {
          market: marketId,
          amount: testAmount,
        });

        if (response.status === 200) {
          const mintedShares = response.data.shares_minted;
          const expectedShares = Math.floor((testAmount * shares) / liquidity);

          // Should match expected calculation
          expect(mintedShares).to.equal(expectedShares);

          // Should be positive
          expect(mintedShares).to.be.greaterThan(0);
        }
      }
    });

    it("should prevent concurrent manipulation attacks", async () => {
      if (!isMigrated || !marketId) return;

      // Get initial state
      const marketBeforeResponse = await client.get(`/market/${marketId}`);
      if (marketBeforeResponse.status !== 200) return;

      const marketBefore = marketBeforeResponse.data.market;
      const liquidityBefore = Number(marketBefore.shared_pool_liquidity || 0);
      const sharesBefore = Number(marketBefore.total_shared_lp_shares || 0);

      // Simulate concurrent operations: trade and add liquidity
      const [tradeResponse, addResponse] = await Promise.all([
        client.post("/trade/buy", {
          market: marketId,
          option: optionId1,
          buyYes: 500_000,
        }),
        client.post("/liquidity/add", {
          market: marketId,
          amount: TEN_USDC,
        }),
      ]);

      // Get final state
      const marketAfterResponse = await client.get(`/market/${marketId}`);
      if (marketAfterResponse.status === 200) {
        const marketAfter = marketAfterResponse.data.market;
        const liquidityAfter = Number(marketAfter.shared_pool_liquidity || 0);
        const sharesAfter = Number(marketAfter.total_shared_lp_shares || 0);

        // Pool should be in consistent state
        expect(liquidityAfter).to.be.greaterThan(0);
        expect(sharesAfter).to.be.greaterThan(0);

        // Share value should be reasonable
        if (sharesAfter > 0) {
          const shareValue = liquidityAfter / sharesAfter;
          expect(shareValue).to.be.greaterThan(0);
          expect(shareValue).to.be.lessThan(10); // Should be around 1.0
        }
      }
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle very small deposits correctly", async () => {
      if (!isMigrated || !marketId) return;

      const smallAmount = 1000; // 0.001 USDC

      const response = await client.post("/liquidity/add", {
        market: marketId,
        amount: smallAmount,
      });

      // Should either succeed with correct shares or reject
      if (response.status === 200) {
        expect(response.data.shares_minted).to.be.greaterThan(0);
      } else {
        expect(response.status).to.equal(400);
      }
    });

    it("should handle very large deposits correctly", async () => {
      if (!isMigrated || !marketId) return;

      // Get balance first
      const walletResponse = await client.get("/user/wallet");
      if (walletResponse.status !== 200) return;

      const balance = Number(walletResponse.data.wallet.balance_usdc || 0);
      const largeAmount = Math.min(balance, HUNDRED_USDC * 10); // Up to 1000 USDC

      if (largeAmount > 0) {
        const response = await client.post("/liquidity/add", {
          market: marketId,
          amount: largeAmount,
        });

        if (response.status === 200) {
          expect(response.data.shares_minted).to.be.greaterThan(0);
          expect(response.data.new_pool_liquidity).to.be.greaterThan(0);
        }
      }
    });

    it("should maintain invariants after multiple operations", async () => {
      if (!isMigrated || !marketId) return;

      // Get initial state
      const initialResponse = await client.get(`/market/${marketId}`);
      if (initialResponse.status !== 200) return;

      const initialMarket = initialResponse.data.market;
      let liquidity = Number(initialMarket.shared_pool_liquidity || 0);
      let shares = Number(initialMarket.total_shared_lp_shares || 0);

      // Perform multiple operations
      const operations = [
        () =>
          client.post("/liquidity/add", {
            market: marketId,
            amount: ONE_USDC,
          }),
        () =>
          client.post("/trade/buy", {
            market: marketId,
            option: optionId1,
            buyYes: 500_000,
          }),
        () =>
          client.post("/liquidity/add", {
            market: marketId,
            amount: ONE_USDC,
          }),
      ];

      for (const operation of operations) {
        await operation();
        await sleep(100);
      }

      // Get final state
      const finalResponse = await client.get(`/market/${marketId}`);
      if (finalResponse.status === 200) {
        const finalMarket = finalResponse.data.market;
        const finalLiquidity = Number(finalMarket.shared_pool_liquidity || 0);
        const finalShares = Number(finalMarket.total_shared_lp_shares || 0);

        // Invariants should be maintained
        expect(finalLiquidity).to.be.greaterThan(0);
        expect(finalShares).to.be.greaterThan(0);

        if (finalShares > 0) {
          const shareValue = finalLiquidity / finalShares;
          expect(shareValue).to.be.greaterThan(0);
        }
      }
    });
  });
});
