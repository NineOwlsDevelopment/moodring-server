import { useState, useEffect } from "react";
import { useUserStore } from "@/stores/userStore";
import { claimLpRewards } from "@/api/api";
import { formatUSDC } from "@/utils/format";
import { toast } from "sonner";
import api from "@/config/axios";
import { Tooltip } from "./Tooltip";

interface ClaimLpRewardsProps {
  marketId: string;
  onClaimed?: () => void;
  compact?: boolean;
}

interface LpPosition {
  shares: number;
  deposited_amount: number;
  current_value: number;
  claimable_value?: number;
  pnl: number;
}

export const ClaimLpRewards = ({
  marketId,
  onClaimed,
  compact = false,
}: ClaimLpRewardsProps) => {
  const { user } = useUserStore();
  const [isClaiming, setIsClaiming] = useState(false);
  const [position, setPosition] = useState<LpPosition | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);

  // Fetch LP position for this market
  useEffect(() => {
    const loadPosition = async () => {
      if (!user) return;

      setIsLoadingPosition(true);
      try {
        const response = await api.get(`/liquidity/position/${marketId}`);
        const pos = response.data.position;

        // Only show if user has shares
        if (pos && Number(pos.shares) > 0) {
          setPosition({
            shares: Number(pos.shares),
            deposited_amount: Number(pos.deposited_amount),
            current_value: Number(pos.current_value),
            claimable_value: Number(pos.claimable_value || pos.current_value),
            pnl: Number(pos.pnl),
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

    loadPosition();
  }, [user, marketId]);

  const handleClaim = async () => {
    if (!user || !position || position.shares <= 0) return;

    setIsClaiming(true);
    try {
      const result = await claimLpRewards({
        market: marketId,
        // Claim all shares by default
      });

      const payoutAmount = result.payout; // In micro-USDC

      // Balance will be updated via websocket, no need to manually update
      // The websocket handler in Navbar will update the balance automatically

      toast.success(
        `Successfully claimed ${formatUSDC(payoutAmount)} in LP rewards!`
      );

      // Reload position
      const response = await api.get(`/liquidity/position/${marketId}`);
      const pos = response.data.position;
      if (pos && Number(pos.shares) > 0) {
        setPosition({
          shares: Number(pos.shares),
          deposited_amount: Number(pos.deposited_amount),
          current_value: Number(pos.current_value),
          claimable_value: Number(pos.claimable_value || pos.current_value),
          pnl: Number(pos.pnl),
        });
      } else {
        setPosition(null);
      }

      if (onClaimed) {
        onClaimed();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          "Failed to claim LP rewards. Please try again."
      );
    } finally {
      setIsClaiming(false);
    }
  };

  // Don't show if user is not logged in, no position, or no shares
  if (!user || !position || position.shares <= 0) {
    return null;
  }

  if (isLoadingPosition) {
    return (
      <div
        className={`${compact ? "py-2" : "px-4 py-2"} text-sm text-gray-400`}
      >
        Loading LP position...
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-moon-grey-dark mb-1.5">
              Your LP Position
            </div>
            <div className="text-lg font-bold text-white tabular-nums">
              {formatUSDC(position.current_value)}
            </div>
            {position.pnl !== 0 && (
              <div className="text-xs mt-0.5">
                <span
                  className={
                    position.pnl >= 0 ? "text-success-400" : "text-danger-400"
                  }
                >
                  {position.pnl >= 0 ? "+" : ""}
                  {formatUSDC(position.pnl)} P&L
                </span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleClaim}
          disabled={isClaiming}
          className="w-full btn bg-success-600 hover:bg-success-700 text-white text-sm font-semibold px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-success-600/25"
        >
          {isClaiming
            ? "Claiming..."
            : `Claim ${formatUSDC(
                position.claimable_value || position.current_value
              )}`}
        </button>
        <div className="text-[10px] text-moon-grey-dark">
          {formatUSDC(position.shares)} LP shares
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-primary-500/10 rounded-lg">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div>
          <Tooltip
            content="Liquidity Provider (LP) rewards are earned by providing liquidity to markets. You receive a portion of trading fees based on your LP share percentage."
            position="top"
          >
            <h4 className="text-sm font-medium text-white mb-1 cursor-help">
              Liquidity Provider Rewards
            </h4>
          </Tooltip>
          <div className="text-xs text-gray-400 space-y-1">
            <div>LP Shares: {formatUSDC(position.shares)}</div>
            <div>
              Current Value:{" "}
              <span className="text-success-400">
                {formatUSDC(position.current_value)}
              </span>
            </div>
            {position.claimable_value !== undefined &&
              position.claimable_value < position.current_value && (
                <div>
                  Claimable:{" "}
                  <span className="text-warning-400">
                    {formatUSDC(position.claimable_value)}
                  </span>
                  <span className="text-gray-500 ml-1">
                    (reserved for pending claims)
                  </span>
                </div>
              )}
            {position.pnl !== 0 && (
              <div>
                P&L:{" "}
                <span
                  className={
                    position.pnl >= 0 ? "text-success-400" : "text-danger-400"
                  }
                >
                  {position.pnl >= 0 ? "+" : ""}
                  {formatUSDC(position.pnl)}
                </span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleClaim}
          disabled={isClaiming}
          className="btn bg-success-600 hover:bg-success-700 text-white text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isClaiming
            ? "Claiming..."
            : `Claim ${formatUSDC(
                position.claimable_value || position.current_value
              )}`}
        </button>
      </div>
    </div>
  );
};
