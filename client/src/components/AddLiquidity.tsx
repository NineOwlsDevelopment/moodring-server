import { useState, useEffect, useMemo } from "react";
import { useUserStore } from "@/stores/userStore";
import { addLiquidity } from "@/api/api";
import { formatUSDC } from "@/utils/format";
import { toast } from "sonner";
import api from "@/config/axios";
import { useMarketSocket } from "@/hooks/useSocket";
import { MarketUpdate } from "@/services/socket";

interface AddLiquidityProps {
  marketId: string;
  onAdded?: () => void;
  compact?: boolean;
}

interface MarketLiquidityInfo {
  shared_pool_liquidity: number;
  total_shared_lp_shares: number;
  accumulated_lp_fees: number;
  is_resolved?: boolean;
}

export const AddLiquidity = ({
  marketId,
  onAdded,
  compact = false,
}: AddLiquidityProps) => {
  const { user } = useUserStore();
  const [isAdding, setIsAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [liquidityInfo, setLiquidityInfo] =
    useState<MarketLiquidityInfo | null>(null);
  const [_, setIsLoadingInfo] = useState(false);

  // Fetch market liquidity info
  const loadLiquidityInfo = async () => {
    if (!user) return;

    setIsLoadingInfo(true);
    try {
      const response = await api.get(`/market/${marketId}`);
      const market = response.data.market;
      setLiquidityInfo({
        shared_pool_liquidity: Number(
          (market as any).shared_pool_liquidity || 0
        ),
        total_shared_lp_shares: Number(
          (market as any).total_shared_lp_shares || 0
        ),
        accumulated_lp_fees: Number((market as any).accumulated_lp_fees || 0),
        is_resolved: (market as any).is_resolved || false,
      });
    } catch (error) {
      console.error("Failed to load liquidity info:", error);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadLiquidityInfo();
  }, [user, marketId]);

  // Subscribe to market updates via websocket
  useMarketSocket(marketId, {
    onMarket: (update: MarketUpdate) => {
      // Update liquidity info when market is updated (e.g., liquidity added/removed)
      if (update.event === "updated" && update.data) {
        if (update.data.shared_pool_liquidity !== undefined) {
          setLiquidityInfo((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              shared_pool_liquidity: Number(update.data.shared_pool_liquidity),
              total_shared_lp_shares: Number(
                update.data.total_shared_lp_shares ||
                  prev.total_shared_lp_shares
              ),
              accumulated_lp_fees: Number(
                update.data.accumulated_lp_fees || prev.accumulated_lp_fees
              ),
            };
          });
        }
      }
    },
  });

  // Calculate LP shares preview using the same formula as backend
  const lpSharesPreview = useMemo(() => {
    if (!amount || !liquidityInfo) return null;

    const inputAmount = parseFloat(amount);
    if (isNaN(inputAmount) || inputAmount <= 0) return null;

    // Convert to micro-USDC (same as backend expects)
    const amountInMicroUSDC = Math.floor(inputAmount * 1_000_000);
    const poolLiquidity = liquidityInfo.shared_pool_liquidity;
    const totalShares = liquidityInfo.total_shared_lp_shares;

    // Same formula as backend: if pool is empty, 1:1, otherwise (amount * totalShares) / poolLiquidity
    if (totalShares === 0 || poolLiquidity === 0) {
      console.log(
        "pool is empty, returning amountInMicroUSDC",
        amountInMicroUSDC
      );
      return amountInMicroUSDC; // First LP gets 1:1 shares
    }
    return Math.floor((amountInMicroUSDC * totalShares) / poolLiquidity);
  }, [amount, liquidityInfo]);

  const handleAdd = async () => {
    if (!user || !amount || parseFloat(amount) <= 0) return;

    setIsAdding(true);
    try {
      // User inputs regular USDC, API will convert to micro-USDC
      const result = await addLiquidity({
        market: marketId,
        amount: parseFloat(amount), // Regular USDC
      });

      toast.success(
        `Successfully added ${formatUSDC(
          result.amount_deposited
        )} liquidity! You received ${formatUSDC(
          result.shares_minted
        )} LP shares.`
      );

      setAmount("");
      // Don't reload - websocket will update the pool data automatically
      // await loadLiquidityInfo();

      if (onAdded) {
        onAdded();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          "Failed to add liquidity. Please try again."
      );
    } finally {
      setIsAdding(false);
    }
  };

  if (!user) {
    return null;
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-moon-grey-dark mb-1.5">
            Amount (USDC)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 pr-16 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-lg font-medium tabular-nums placeholder-moon-grey-dark focus:border-neon-iris/50 focus:ring-1 focus:ring-neon-iris/25 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={isAdding}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col border border-white/[0.08] rounded-md overflow-hidden bg-white/[0.03] backdrop-blur-sm">
              <button
                type="button"
                onClick={() => {
                  const current = parseFloat(amount) || 0;
                  const newValue = Math.max(0.01, current + 1.0);
                  setAmount(String(newValue.toFixed(2)));
                }}
                disabled={isAdding}
                className="w-7 h-6 flex items-center justify-center bg-white/[0.05] hover:bg-neon-iris/20 hover:border-neon-iris/50 text-moon-grey-dark hover:text-neon-iris-light active:bg-neon-iris/30 transition-all duration-200 border-b border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.05] disabled:hover:text-moon-grey-dark group"
                aria-label="Increment"
              >
                <svg
                  className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  const current = parseFloat(amount) || 0;
                  const newValue = Math.max(0.01, current - 1.0);
                  setAmount(String(newValue.toFixed(2)));
                }}
                disabled={isAdding}
                className="w-7 h-6 flex items-center justify-center bg-white/[0.05] hover:bg-neon-iris/20 hover:border-neon-iris/50 text-moon-grey-dark hover:text-neon-iris-light active:bg-neon-iris/30 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.05] disabled:hover:text-moon-grey-dark group"
                aria-label="Decrement"
              >
                <svg
                  className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {liquidityInfo && (
          <div className="text-[10px] text-moon-grey-dark space-y-0.5">
            <div>Pool: {formatUSDC(liquidityInfo.shared_pool_liquidity)}</div>
            {lpSharesPreview !== null && amount && parseFloat(amount) > 0 && (
              <div className="text-aqua-pulse/80">
                You will receive: {formatUSDC(lpSharesPreview).replace("$", "")}{" "}
                LP shares
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleAdd}
          disabled={isAdding || !amount || parseFloat(amount) <= 0}
          className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-neon-iris hover:bg-neon-iris/90 text-white shadow-lg shadow-neon-iris/25"
        >
          {isAdding ? "Adding..." : "Add Liquidity"}
        </button>
        {!liquidityInfo?.is_resolved && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-[10px] text-amber-400/90 leading-relaxed">
                <span className="font-semibold">Funds will be locked</span>{" "}
                until the market is resolved. You can only withdraw your
                proportional share of available liquidity after resolution.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-neon-iris/10 rounded-lg border border-neon-iris/20">
      <h4 className="text-sm font-medium text-white mb-3">Add Liquidity</h4>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-moon-grey-dark mb-1.5">
            Amount (USDC)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 pr-16 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-lg font-medium tabular-nums placeholder-moon-grey-dark focus:border-neon-iris/50 focus:ring-1 focus:ring-neon-iris/25 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={isAdding}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col border border-white/[0.08] rounded-md overflow-hidden bg-white/[0.03] backdrop-blur-sm">
              <button
                type="button"
                onClick={() => {
                  const current = parseFloat(amount) || 0;
                  const newValue = Math.max(0.01, current + 1.0);
                  setAmount(String(newValue.toFixed(2)));
                }}
                disabled={isAdding}
                className="w-7 h-6 flex items-center justify-center bg-white/[0.05] hover:bg-neon-iris/20 hover:border-neon-iris/50 text-moon-grey-dark hover:text-neon-iris-light active:bg-neon-iris/30 transition-all duration-200 border-b border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.05] disabled:hover:text-moon-grey-dark group"
                aria-label="Increment"
              >
                <svg
                  className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  const current = parseFloat(amount) || 0;
                  const newValue = Math.max(0.01, current - 1.0);
                  setAmount(String(newValue.toFixed(2)));
                }}
                disabled={isAdding}
                className="w-7 h-6 flex items-center justify-center bg-white/[0.05] hover:bg-neon-iris/20 hover:border-neon-iris/50 text-moon-grey-dark hover:text-neon-iris-light active:bg-neon-iris/30 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.05] disabled:hover:text-moon-grey-dark group"
                aria-label="Decrement"
              >
                <svg
                  className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {liquidityInfo && (
          <div className="text-xs text-moon-grey space-y-1">
            <div>
              Current Pool: {formatUSDC(liquidityInfo.shared_pool_liquidity)}
            </div>
            {liquidityInfo.accumulated_lp_fees > 0 && (
              <div>
                Fees Earned: {formatUSDC(liquidityInfo.accumulated_lp_fees)}
              </div>
            )}
            {lpSharesPreview !== null && amount && parseFloat(amount) > 0 && (
              <div className="text-aqua-pulse/80 font-medium pt-1 border-t border-white/5">
                You will receive: {formatUSDC(lpSharesPreview).replace("$", "")}{" "}
                LP shares
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleAdd}
          disabled={isAdding || !amount || parseFloat(amount) <= 0}
          className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-neon-iris hover:bg-neon-iris/90 text-white shadow-lg shadow-neon-iris/25"
        >
          {isAdding ? "Adding..." : "Add Liquidity"}
        </button>
        <p className="text-[10px] text-moon-grey-dark">
          Earn fees from trading activity. LP shares represent your share of the
          liquidity pool.
        </p>
        {!liquidityInfo?.is_resolved && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-xs text-amber-400/90 font-semibold mb-1">
                  Funds Will Be Locked
                </p>
                <p className="text-[10px] text-amber-400/80 leading-relaxed">
                  Your liquidity will be locked until the market is resolved.
                  After resolution, you can withdraw your proportional share of
                  available liquidity (total liquidity minus outstanding shares
                  redeemable).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
