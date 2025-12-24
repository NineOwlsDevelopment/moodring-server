import { useState, useEffect } from "react";
import { useUserStore } from "@/stores/userStore";
import { removeLiquidity } from "@/api/api";
import { formatUSDC } from "@/utils/format";
import { toast } from "sonner";
import api from "@/config/axios";

interface RemoveLiquidityProps {
  marketId: string;
  onRemoved?: () => void;
}

interface LpPosition {
  shares: number;
  deposited_amount: number;
  current_value: number;
  claimable_value?: number;
}

export const RemoveLiquidity = ({
  marketId,
  onRemoved,
}: RemoveLiquidityProps) => {
  const { user } = useUserStore();
  const [isRemoving, setIsRemoving] = useState(false);
  const [shares, setShares] = useState("");
  const [position, setPosition] = useState<LpPosition | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);
  const [isMarketResolved, setIsMarketResolved] = useState(false);

  // Fetch LP position and market info for this market
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setIsLoadingPosition(true);
      try {
        // Fetch LP position
        const positionResponse = await api.get(
          `/liquidity/position/${marketId}`
        );
        const pos = positionResponse.data.position;

        // Fetch market to check if resolved
        const marketResponse = await api.get(`/market/${marketId}`);
        const market = marketResponse.data.market;
        setIsMarketResolved(market?.is_resolved || false);

        if (pos && Number(pos.shares) > 0) {
          setPosition({
            shares: Number(pos.shares),
            deposited_amount: Number(pos.deposited_amount),
            current_value: Number(pos.current_value),
            claimable_value: Number(pos.claimable_value || 0),
          });
        } else {
          setPosition(null);
        }
      } catch (error) {
        console.error("Failed to load LP position:", error);
        setPosition(null);
      } finally {
        setIsLoadingPosition(false);
      }
    };

    loadData();
  }, [user, marketId]);

  const handleRemove = async () => {
    if (!user || !position || !shares || parseFloat(shares) <= 0) return;

    const sharesToRemove = parseFloat(shares) * 1_000_000; // Convert to micro-USDC

    if (sharesToRemove > position.shares) {
      toast.error("Cannot remove more shares than you have");
      return;
    }

    setIsRemoving(true);
    try {
      const result = await removeLiquidity({
        market: marketId,
        shares: sharesToRemove,
      });

      toast.success(
        `Successfully removed liquidity! You received ${formatUSDC(
          result.usdc_returned
        )} and ${formatUSDC(result.fees_earned)} in fees.`
      );

      setShares("");
      await loadPosition();

      if (onRemoved) {
        onRemoved();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          "Failed to remove liquidity. Please try again."
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const loadPosition = async () => {
    if (!user) return;

    try {
      const positionResponse = await api.get(`/liquidity/position/${marketId}`);
      const pos = positionResponse.data.position;

      // Fetch market to check if resolved
      const marketResponse = await api.get(`/market/${marketId}`);
      const market = marketResponse.data.market;
      setIsMarketResolved(market?.is_resolved || false);

      if (pos && Number(pos.shares) > 0) {
        setPosition({
          shares: Number(pos.shares),
          deposited_amount: Number(pos.deposited_amount),
          current_value: Number(pos.current_value),
          claimable_value: Number(pos.claimable_value || 0),
        });
      } else {
        setPosition(null);
      }
    } catch (error) {
      console.error("Failed to load LP position:", error);
      setPosition(null);
    }
  };

  if (!user) {
    return null;
  }

  if (isLoadingPosition) {
    return (
      <div className="py-2 text-sm text-gray-400">Loading LP position...</div>
    );
  }

  if (!position || position.shares <= 0) {
    return (
      <div className="text-sm text-moon-grey-dark">
        You don't have any liquidity in this pool
      </div>
    );
  }

  const maxShares = position.shares / 1_000_000; // Convert to regular units
  // Use claimable_value if available, otherwise current_value
  const availableValue = position.claimable_value ?? position.current_value;
  const sharesValue = shares
    ? (parseFloat(shares) / maxShares) * availableValue
    : 0;

  // If market is not resolved, show locked message
  if (!isMarketResolved) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-5 h-5 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-amber-400">
              LP Shares Locked
            </h3>
          </div>
          <p className="text-xs text-amber-400/80">
            Your LP shares are locked until the market is resolved. Once the
            market resolves, you can withdraw your proportional share of
            available liquidity (total liquidity minus outstanding shares
            redeemable).
          </p>
        </div>
        <div className="text-xs text-moon-grey-dark space-y-1">
          <div>
            Your Position: {formatUSDC(position.current_value)} (
            {formatUSDC(position.shares).replace("$", "")} LP)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-moon-grey-dark mb-1.5">
          LP Shares to Remove
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={maxShares}
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 pr-16 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-lg font-medium tabular-nums placeholder-moon-grey-dark focus:border-neon-iris/50 focus:ring-1 focus:ring-neon-iris/25 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            disabled={isRemoving}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col border border-white/[0.08] rounded-md overflow-hidden bg-white/[0.03] backdrop-blur-sm">
            <button
              type="button"
              onClick={() => {
                const current = parseFloat(shares) || 0;
                const newValue = Math.min(
                  maxShares,
                  Math.max(0.01, current + 1.0)
                );
                setShares(String(newValue.toFixed(2)));
              }}
              disabled={isRemoving}
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
                const current = parseFloat(shares) || 0;
                const newValue = Math.max(0.01, current - 1.0);
                setShares(String(newValue.toFixed(2)));
              }}
              disabled={isRemoving}
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
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-moon-grey-dark">
            Max: {formatUSDC(position.shares)} LP
          </span>
          <button
            onClick={() => setShares(maxShares.toString())}
            className="text-xs text-neon-iris hover:text-neon-iris/80 transition-colors"
          >
            Max
          </button>
        </div>
      </div>

      {shares && parseFloat(shares) > 0 && (
        <div className="bg-white/5 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-moon-grey-dark">You'll Receive</span>
            <span className="text-white font-semibold tabular-nums">
              {formatUSDC(sharesValue)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-moon-grey-dark">
            <span>From Available Liquidity</span>
            <span className="text-moon-grey">
              {formatUSDC(availableValue)} available
            </span>
          </div>
        </div>
      )}

      <div className="text-xs text-moon-grey-dark space-y-1">
        <div>
          Your Position: {formatUSDC(position.current_value)} (
          {formatUSDC(position.shares)} LP)
        </div>
        {position.claimable_value !== undefined &&
          position.claimable_value < position.current_value && (
            <div className="text-amber-400">
              Note: Only {formatUSDC(availableValue)} is available for
              withdrawal. The remaining liquidity is reserved for outstanding
              shares redeemable.
            </div>
          )}
      </div>

      <button
        onClick={handleRemove}
        disabled={
          isRemoving ||
          !shares ||
          parseFloat(shares) <= 0 ||
          parseFloat(shares) > maxShares
        }
        className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/25"
      >
        {isRemoving ? "Removing..." : "Remove Liquidity"}
      </button>
    </div>
  );
};
