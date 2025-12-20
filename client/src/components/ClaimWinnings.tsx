import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Market, MarketOption } from "@/data/dummyData";
import { claimWinnings, fetchPositions, Position } from "@/api/api";
import { useUserStore } from "@/stores/userStore";
import { formatUSDC } from "@/utils/format";

interface ClaimWinningsProps {
  market: Market;
  option: MarketOption;
  onClaimed: () => void;
}

export const ClaimWinnings = ({
  market,
  option,
  onClaimed,
}: ClaimWinningsProps) => {
  const { user } = useUserStore();
  const [isClaiming, setIsClaiming] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);

  const optionIsResolved = option.is_resolved ?? false;
  const winningSide = option.winning_side ?? null;

  // Fetch user position to check if they have winning shares
  // Fetch all positions (not just "open") to include resolved options
  useEffect(() => {
    const loadPosition = async () => {
      if (!user || !optionIsResolved || !winningSide) return;

      setIsLoadingPosition(true);
      try {
        // Fetch all positions to include resolved options
        const { positions } = await fetchPositions();
        const userPosition = positions.find(
          (p: any) => p.option_id === option.id
        );
        setPosition(userPosition || null);
      } catch (error) {
        console.error("Failed to load position:", error);
        setPosition(null);
      } finally {
        setIsLoadingPosition(false);
      }
    };

    loadPosition();
  }, [user, option.id, optionIsResolved, winningSide]);

  // Check if user has winning shares
  const hasWinningShares = (() => {
    if (!position || !winningSide) return false;

    const yesShares = Number((position as any).yes_shares || 0);
    const noShares = Number((position as any).no_shares || 0);
    const isClaimed = (position as any).is_claimed ?? false;

    if (isClaimed) return false;

    // Check if user has shares for the winning side
    if (winningSide === 1) {
      return yesShares > 0;
    } else if (winningSide === 2) {
      return noShares > 0;
    }

    return false;
  })();

  // Calculate potential payout
  const potentialPayout = (() => {
    if (!position || !winningSide) return 0;

    const yesShares = Number((position as any).yes_shares || 0);
    const noShares = Number((position as any).no_shares || 0);

    if (winningSide === 1) {
      return yesShares; // In micro-USDC (1 share = 1 micro-USDC payout)
    } else if (winningSide === 2) {
      return noShares; // In micro-USDC
    }

    return 0;
  })();

  const handleClaim = async () => {
    if (!user || !hasWinningShares) return;

    setIsClaiming(true);
    try {
      const result = await claimWinnings(market.id, option.id);
      const payoutAmount = result.payout; // In micro-USDC

      // Balance will be updated via websocket, no need to manually update
      // The websocket handler in Navbar will update the balance automatically

      toast.success(
        `Successfully claimed ${formatUSDC(payoutAmount)} in winnings!`
      );
      onClaimed();
      // Reload position to update state (fetch all positions to include resolved)
      const { positions } = await fetchPositions();
      const updatedPosition = positions.find(
        (p: any) => p.option_id === option.id
      );
      setPosition(updatedPosition || null);
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          "Failed to claim winnings. Please try again."
      );
    } finally {
      setIsClaiming(false);
    }
  };

  // Don't show if option is not resolved, user is not logged in, or no winning shares
  if (!user || !optionIsResolved || !winningSide || !hasWinningShares) {
    return null;
  }

  if (isLoadingPosition) {
    return (
      <div className="px-4 py-2 bg-primary-500/10 rounded-lg text-sm text-gray-400">
        Checking position...
      </div>
    );
  }

  return (
    <button
      onClick={handleClaim}
      disabled={isClaiming}
      className="w-full px-4 py-3 bg-success-500 hover:bg-success-600 disabled:bg-success-500/50 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
    >
      {isClaiming ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Claiming...
        </>
      ) : (
        <>
          <span>💰</span>
          <span>Claim {formatUSDC(potentialPayout)}</span>
        </>
      )}
    </button>
  );
};
