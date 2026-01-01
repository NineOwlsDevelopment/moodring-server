import { useState, useEffect } from "react";
import { fetchTrendingMarkets } from "@/api/api";
import { Market } from "@/types/market";

interface UseTrendingMarketsResult {
  markets: Market[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch trending markets for the hero carousel.
 * Fetches markets marked as trending or highest volume/conviction.
 */
export const useTrendingMarkets = (
  limit: number = 5
): UseTrendingMarketsResult => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrendingMarkets = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchTrendingMarkets(limit);
        const fetchedMarkets = response?.markets ?? [];
        // Filter to only active markets
        const activeMarkets = fetchedMarkets.filter(
          (market) => !market.is_resolved
        );
        setMarkets(activeMarkets);
      } catch (err) {
        console.error("Failed to load trending markets:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load trending markets"
        );
        setMarkets([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrendingMarkets();
  }, [limit]);

  return { markets, isLoading, error };
};

