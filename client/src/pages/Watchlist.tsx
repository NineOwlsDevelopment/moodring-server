import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MarketCard } from "@/components/MarketCard";
import { fetchWatchlist } from "@/api/api";
import { useUserStore } from "@/stores/userStore";
import { Bookmark, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export const Watchlist = () => {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWatchlist = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWatchlist({ page, limit: 20 });
      setMarkets((prev) => {
        if (page === 1) {
          return response.markets;
        }
        return [...prev, ...response.markets];
      });
      setHasMore(response.pagination?.hasMore ?? false);
    } catch (err: any) {
      console.error("Failed to load watchlist:", err);
      setError(err.message || "Failed to load watchlist");
    } finally {
      setIsLoading(false);
    }
  }, [user, page]);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    loadWatchlist();
  }, [user, navigate, loadWatchlist]);

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-ink-black">
      <div className="section-container py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-moon-grey hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-neon-iris/10 border border-neon-iris/20">
              <Bookmark className="w-6 h-6 text-neon-iris fill-current" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                My Watchlist
              </h1>
              <p className="text-moon-grey-dark mt-1">
                Markets you're following
              </p>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-brand-danger/10 border border-brand-danger/20 text-brand-danger">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && markets.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-iris"></div>
          </div>
        ) : markets.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-graphite-deep border border-white/10 mb-4">
              <Bookmark className="w-8 h-8 text-moon-grey-dark" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              No markets in your watchlist
            </h2>
            <p className="text-moon-grey-dark mb-6">
              Start adding markets to your watchlist to track them easily
            </p>
            <Link
              to="/markets"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-iris/10 hover:bg-neon-iris/20 text-neon-iris border border-neon-iris/20 transition-colors"
            >
              Browse Markets
            </Link>
          </div>
        ) : (
          /* Markets Grid */
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-6 py-3 rounded-lg bg-graphite-deep hover:bg-graphite-hover border border-white/10 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

