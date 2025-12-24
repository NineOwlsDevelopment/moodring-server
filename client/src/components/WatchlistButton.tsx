import { useState, useEffect } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useUserStore } from "@/stores/userStore";
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlistStatus,
} from "@/api/api";
import { Tooltip } from "./Tooltip";

interface WatchlistButtonProps {
  marketId: string;
  className?: string;
}

export const WatchlistButton = ({
  marketId,
  className = "",
}: WatchlistButtonProps) => {
  const { user } = useUserStore();
  const [isWatched, setIsWatched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch watchlist status on mount (only if user is logged in)
  useEffect(() => {
    if (!user) return;

    const fetchStatus = async () => {
      try {
        const { is_watched } = await getWatchlistStatus(marketId);
        setIsWatched(is_watched);
      } catch (error) {
        console.error("Failed to fetch watchlist status:", error);
      }
    };

    fetchStatus();
  }, [marketId, user]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    setIsLoading(true);
    try {
      if (isWatched) {
        await removeFromWatchlist(marketId);
        setIsWatched(false);
      } else {
        await addToWatchlist(marketId);
        setIsWatched(true);
      }
    } catch (error) {
      console.error("Failed to toggle watchlist:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show button if user is logged in
  if (!user) {
    return null;
  }

  return (
    <Tooltip
      content={
        isWatched
          ? "Remove from watchlist"
          : "Add to watchlist to track this market"
      }
      position="top"
      delay={800}
    >
      <button
        onClick={handleToggle}
        className={`group relative p-1.5 rounded-lg transition-all duration-200 border ${
          isWatched
            ? "text-neon-iris bg-neon-iris/10 border-neon-iris/30 hover:bg-neon-iris/20 hover:border-neon-iris/50"
            : "text-moon-grey-dark bg-graphite-hover/50 border-white/10 hover:text-neon-iris hover:bg-neon-iris/5 hover:border-neon-iris/20"
        } ${className} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        disabled={isLoading}
      >
        {isWatched ? (
          <BookmarkCheck className="w-4 h-4 fill-current" />
        ) : (
          <Bookmark className="w-4 h-4" />
        )}
      </button>
    </Tooltip>
  );
};
