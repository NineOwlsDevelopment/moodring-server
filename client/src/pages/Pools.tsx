import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import { AddLiquidity } from "@/components/AddLiquidity";
import { RemoveLiquidity } from "@/components/RemoveLiquidity";
import {
  fetchLiquidityPositions,
  LiquidityPosition,
  fetchCategories,
} from "@/api/api";
import { formatUSDC } from "@/utils/format";
import { toast } from "sonner";
import api from "@/config/axios";
import { MarketUpdate } from "@/services/socket";
import { socketService } from "@/services/socket";
import { sortCategories } from "@/utils/categorySort";

interface Pool {
  id: string;
  question: string;
  image_url: string | null;
  shared_pool_liquidity: number;
  accumulated_lp_fees: number;
  total_shared_lp_shares: number;
  is_resolved: boolean;
  is_initialized: boolean;
  total_volume: number;
  lp_count: number;
  created_at: string;
  categories?: Array<{ id: string; name: string }>;
}

type View = "all" | "my-pools";
type CreatorTypeOption = "all" | "admin" | "user";
type SortOption = "tvl" | "apr" | "fees" | "newest" | "oldest" | "volume";

const POOLS_PER_PAGE = 12;

export const Pools = () => {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("all");
  const [creatorType, setCreatorType] = useState<CreatorTypeOption>("admin");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("tvl");
  const [allPools, setAllPools] = useState<Pool[]>([]);
  const [displayedPools, setDisplayedPools] = useState<Pool[]>([]);
  const [myPositions, setMyPositions] = useState<LiquidityPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>(
    [{ id: "all", label: "All Categories" }]
  );

  // Track which market is being edited to update only that one via socket
  const editingMarketIdRef = useRef<string | null>(null);

  // Helper functions
  const calculateAPR = useCallback((pool: Pool): number => {
    const liquidity = (Number(pool.shared_pool_liquidity) || 0) / 1_000_000;
    if (!liquidity || liquidity === 0) return 0;

    const fees = (Number(pool.accumulated_lp_fees) || 0) / 1_000_000;
    const daysSinceCreation =
      (Date.now() - Number(pool.created_at) * 1000) / (1000 * 60 * 60 * 24);
    const daysSinceCreationOrOne = Math.max(1, daysSinceCreation);

    const feeRate = fees / liquidity;
    const annualized = (feeRate * 365) / daysSinceCreationOrOne;
    return annualized * 100;
  }, []);

  const getMyPosition = useCallback(
    (poolId: string): LiquidityPosition | undefined => {
      return myPositions.find((p) => p.market_id === poolId);
    },
    [myPositions]
  );

  // Filter pools based on current filters
  const filterPools = useCallback(
    (pools: Pool[]): Pool[] => {
      let filtered = [...pools];

      if (view === "my-pools") {
        filtered = filtered.filter((p) => getMyPosition(p.id));
      }

      if (selectedCategory !== "all") {
        filtered = filtered.filter((p) => {
          return (
            p.categories?.some(
              (cat) => cat.name.toLowerCase() === selectedCategory
            ) || false
          );
        });
      }

      return filtered;
    },
    [view, selectedCategory, getMyPosition]
  );

  // Sort pools based on current sort option
  const sortPools = useCallback(
    (pools: Pool[]): Pool[] => {
      const sorted = [...pools];
      sorted.sort((a, b) => {
        switch (sortBy) {
          case "tvl": {
            const tvlA =
              (Number(a.shared_pool_liquidity) || 0) / 1_000_000 +
              (Number(a.accumulated_lp_fees) || 0) / 1_000_000;
            const tvlB =
              (Number(b.shared_pool_liquidity) || 0) / 1_000_000 +
              (Number(b.accumulated_lp_fees) || 0) / 1_000_000;
            return tvlB - tvlA;
          }
          case "apr":
            return calculateAPR(b) - calculateAPR(a);
          case "fees": {
            const feesA = (Number(a.accumulated_lp_fees) || 0) / 1_000_000;
            const feesB = (Number(b.accumulated_lp_fees) || 0) / 1_000_000;
            return feesB - feesA;
          }
          case "newest":
            return Number(b.created_at) - Number(a.created_at);
          case "oldest":
            return Number(a.created_at) - Number(b.created_at);
          case "volume":
            return Number(b.total_volume || 0) - Number(a.total_volume || 0);
          default:
            return 0;
        }
      });
      return sorted;
    },
    [sortBy, calculateAPR]
  );

  // Update a specific pool in the list
  const updatePool = useCallback((poolId: string, updates: Partial<Pool>) => {
    setAllPools((prevPools) =>
      prevPools.map((pool) =>
        pool.id === poolId ? { ...pool, ...updates } : pool
      )
    );
  }, []);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { categories: dbCategories } = await fetchCategories();
        const sortedCategories = sortCategories(dbCategories);
        setCategories([
          { id: "all", label: "All Categories" },
          ...sortedCategories.map((c) => ({
            id: c.name.toLowerCase(),
            label: c.name,
          })),
        ]);
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    };
    loadCategories();
  }, []);

  // Listen for market updates - only update the specific market being edited
  useEffect(() => {
    socketService.connect();

    const handleMarketUpdate = (update: MarketUpdate) => {
      if (
        update.event === "updated" &&
        update.data &&
        editingMarketIdRef.current === update.market_id
      ) {
        updatePool(update.market_id, {
          shared_pool_liquidity: Number(update.data.shared_pool_liquidity || 0),
          total_shared_lp_shares: Number(
            update.data.total_shared_lp_shares || 0
          ),
          accumulated_lp_fees: Number(update.data.accumulated_lp_fees || 0),
        });

        if (user) {
          loadMyPositions();
        }

        editingMarketIdRef.current = null;
      }
    };

    const unsubscribe = socketService.onMarket(handleMarketUpdate);
    return () => unsubscribe();
  }, [user, updatePool]);

  // Filter and sort pools whenever filters change
  useEffect(() => {
    const filtered = filterPools(allPools);
    const sorted = sortPools(filtered);

    setCurrentPage(1);
    setDisplayedPools(sorted.slice(0, POOLS_PER_PAGE));
    setHasMore(sorted.length > POOLS_PER_PAGE);
  }, [allPools, filterPools, sortPools]);

  const loadPools = async (reset = true) => {
    if (reset) {
      setIsLoading(true);
      setCurrentPage(1);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // Get all markets with liquidity
      const response = await api.get("/market", {
        params: {
          status: "active",
          limit: 1000, // Get more to filter client-side
          creator_type: creatorType,
          category: selectedCategory !== "all" ? selectedCategory : undefined,
        },
      });

      const markets = response.data.markets || [];
      const poolsWithLiquidity = markets.filter(
        (m: any) =>
          m.is_initialized &&
          Number(m.shared_pool_liquidity || 0) > 0 &&
          !m.is_resolved
      );

      // Get LP counts for each pool
      const poolsWithCounts = await Promise.all(
        poolsWithLiquidity.map(async (market: any) => {
          try {
            const lpResponse = await api.get(
              `/liquidity/share-value/${market.id}`
            );
            return {
              ...market,
              lp_count: lpResponse.data.lp_count || 0,
            };
          } catch {
            return {
              ...market,
              lp_count: 0,
            };
          }
        })
      );

      setAllPools(poolsWithCounts);
    } catch (error) {
      console.error("Failed to load pools:", error);
      toast.error("Failed to load pools");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadPools();
    if (user) {
      loadMyPositions();
    } else {
      // Reset to "all" view if user logs out while on "my-pools"
      if (view === "my-pools") {
        setView("all");
      }
    }
  }, [user, creatorType, selectedCategory, view]);

  const loadMyPositions = async () => {
    try {
      const data = await fetchLiquidityPositions();
      setMyPositions(data.positions);
    } catch (error) {
      console.error("Failed to load positions:", error);
    }
  };

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setTimeout(() => {
      const filtered = filterPools(allPools);
      const sorted = sortPools(filtered);
      const nextPage = currentPage + 1;
      const newPools = sorted.slice(0, nextPage * POOLS_PER_PAGE);

      setDisplayedPools(newPools);
      setCurrentPage(nextPage);
      setHasMore(newPools.length < sorted.length);
      setIsLoadingMore(false);
    }, 100);
  }, [allPools, currentPage, isLoadingMore, hasMore, filterPools, sortPools]);

  const handleAddLiquidity = (poolId: string) => {
    editingMarketIdRef.current = poolId;
    setSelectedPool(poolId);
    setShowAddModal(true);
  };

  const handleRemoveLiquidity = (poolId: string) => {
    editingMarketIdRef.current = poolId;
    setSelectedPool(poolId);
    setShowRemoveModal(true);
  };

  const reloadPool = useCallback(
    async (poolId: string) => {
      try {
        const response = await api.get(`/market/${poolId}`);
        const market = response.data.market;
        updatePool(poolId, {
          shared_pool_liquidity: Number(market.shared_pool_liquidity || 0),
          total_shared_lp_shares: Number(market.total_shared_lp_shares || 0),
          accumulated_lp_fees: Number(market.accumulated_lp_fees || 0),
        });
      } catch (error) {
        console.error("Failed to reload pool:", error);
      }
    },
    [updatePool]
  );

  const handleLiquidityAdded = async () => {
    loadMyPositions();
    if (selectedPool) {
      await reloadPool(selectedPool);
    }
    setShowAddModal(false);
    setSelectedPool(null);
  };

  const handleLiquidityRemoved = async () => {
    loadMyPositions();
    if (selectedPool) {
      await reloadPool(selectedPool);
    }
    setShowRemoveModal(false);
    setSelectedPool(null);
  };

  // Convert from micro-USDC to regular USDC before summing to avoid precision issues
  const totalTVL = allPools.reduce(
    (sum, p) =>
      sum +
      (Number(p.shared_pool_liquidity) || 0) / 1_000_000 +
      (Number(p.accumulated_lp_fees) || 0) / 1_000_000,
    0
  );
  const totalFees = allPools.reduce(
    (sum, p) => sum + (Number(p.accumulated_lp_fees) || 0) / 1_000_000,
    0
  );

  // Format regular USDC values (not micro-USDC)
  const formatRegularUSDC = (amount: number): string => {
    if (amount >= 1_000_000) {
      const millions = amount / 1_000_000;
      const rounded = Math.round(millions * 100) / 100;
      return `$${rounded.toFixed(rounded % 1 === 0 ? 0 : 2)}M`;
    }
    if (amount >= 1000) {
      const thousands = amount / 1000;
      const rounded = Math.round(thousands * 100) / 100;
      return `$${rounded.toFixed(rounded % 1 === 0 ? 0 : 2)}k`;
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-8">
      {/* Header - Clean & Compact */}
      <div className="mb-6">
        {/* Title Row with Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Pools</h1>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-moon-grey-dark">
              <span className="text-moon-grey">TVL: </span>
              <span className="text-white font-semibold tabular-nums">
                {formatRegularUSDC(totalTVL)}
              </span>
            </div>
            <div className="text-moon-grey-dark">
              <span className="text-moon-grey">Fees: </span>
              <span className="text-aqua-pulse font-semibold tabular-nums">
                {formatRegularUSDC(totalFees)}
              </span>
            </div>
            <div className="text-moon-grey-dark">
              <span className="text-moon-grey">{allPools.length} pools</span>
            </div>
          </div>
        </div>

        {/* Main Filter Bar - Single Row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* View Toggle - Only show "My Pools" if user is logged in */}
          <div className="flex items-center gap-1 bg-graphite-deep rounded-lg p-1 border border-graphite-light">
            <button
              onClick={() => setView("all")}
              className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                view === "all"
                  ? "bg-graphite-light text-white"
                  : "text-moon-grey hover:text-white"
              }`}
            >
              All
            </button>
            {user && (
              <button
                onClick={() => setView("my-pools")}
                className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                  view === "my-pools"
                    ? "bg-graphite-light text-white"
                    : "text-moon-grey hover:text-white"
                }`}
              >
                My Pools ({myPositions.length})
              </button>
            )}
          </div>

          {/* Creator Type */}
          <div className="flex items-center gap-1 bg-graphite-deep rounded-lg p-1 border border-graphite-light">
            <button
              onClick={() => setCreatorType("admin")}
              className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                creatorType === "admin"
                  ? "bg-neon-iris text-white shadow-md shadow-neon-iris/20"
                  : "text-moon-grey hover:text-white"
              }`}
            >
              Official
            </button>
            <button
              onClick={() => setCreatorType("user")}
              className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                creatorType === "user"
                  ? "bg-neon-iris text-white shadow-md shadow-neon-iris/20"
                  : "text-moon-grey hover:text-white"
              }`}
            >
              Community
            </button>
            <button
              onClick={() => setCreatorType("all")}
              className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                creatorType === "all"
                  ? "bg-neon-iris text-white shadow-md shadow-neon-iris/20"
                  : "text-moon-grey hover:text-white"
              }`}
            >
              All
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1 rounded-lg font-medium text-xs bg-graphite-light text-white border border-graphite-light hover:bg-graphite-hover transition-all focus:outline-none focus:ring-1 focus:ring-neon-iris/50"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1 rounded-lg font-medium text-xs bg-graphite-light text-white border border-graphite-light hover:bg-graphite-hover transition-all focus:outline-none focus:ring-1 focus:ring-neon-iris/50"
          >
            <option value="tvl">Sort: TVL ↓</option>
            <option value="apr">Sort: APR ↓</option>
            <option value="fees">Sort: Fees ↓</option>
            <option value="volume">Sort: Volume ↓</option>
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
          </select>

          {/* Expandable Categories Button (for mobile/if needed) */}
          {categories.length > 8 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-1 rounded-lg font-medium text-xs bg-graphite-light text-moon-grey hover:text-white border border-graphite-light hover:bg-graphite-hover transition-all"
            >
              {showFilters ? "Hide" : "More"} Filters
            </button>
          )}
        </div>

        {/* Expandable Category Chips (Optional) */}
        {showFilters && (
          <div className="mb-3 -mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5">
              {categories.slice(1).map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setShowFilters(false);
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium text-xs whitespace-nowrap flex-shrink-0 transition-all ${
                    selectedCategory === category.id
                      ? "bg-neon-iris text-white shadow-md shadow-neon-iris/20"
                      : "bg-graphite-light text-moon-grey hover:bg-graphite-hover hover:text-white"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pools List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              className="bg-graphite-light rounded-xl p-4 border border-graphite-light animate-pulse"
            >
              <div className="h-4 bg-graphite-hover rounded mb-3" />
              <div className="h-6 bg-graphite-hover rounded mb-2" />
              <div className="h-3 bg-graphite-hover rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : displayedPools.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-moon-grey">
            {view === "my-pools"
              ? "You haven't joined any pools yet"
              : "No active pools found"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedPools.map((pool) => {
              const myPosition = getMyPosition(pool.id);
              const apr = calculateAPR(pool);
              // Convert from micro-USDC to regular USDC
              const tvl =
                (Number(pool.shared_pool_liquidity) || 0) / 1_000_000 +
                (Number(pool.accumulated_lp_fees) || 0) / 1_000_000;
              const feesEarned =
                (Number(pool.accumulated_lp_fees) || 0) / 1_000_000;

              return (
                <div
                  key={pool.id}
                  className="bg-graphite-light rounded-xl p-5 border border-graphite-light hover:border-neon-iris/30 transition-all"
                >
                  {/* Pool Header */}
                  <div className="flex items-start gap-4 mb-4">
                    {pool.image_url ? (
                      <img
                        src={pool.image_url}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-neon-iris to-aqua-pulse flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-base">
                          {pool.question.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/market/${pool.id}`}
                        className="text-white font-semibold hover:text-neon-iris transition-colors line-clamp-2 text-base block h-12"
                      >
                        {pool.question}
                      </Link>
                      <div className="text-sm text-moon-grey-dark mt-1">
                        {pool.lp_count} LP{pool.lp_count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  {/* Pool Stats - Compact */}
                  <div className="space-y-2.5 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-moon-grey-dark">TVL</span>
                      <span className="text-base font-semibold text-white tabular-nums">
                        {formatRegularUSDC(tvl)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-moon-grey-dark">Fees</span>
                      <span className="text-base font-semibold text-aqua-pulse tabular-nums">
                        {formatRegularUSDC(feesEarned)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-moon-grey-dark">APR</span>
                      <span className="text-base font-semibold text-neon-iris tabular-nums">
                        {apr.toFixed(2)}%
                      </span>
                    </div>
                    {myPosition && (
                      <div className="pt-2.5 mt-2.5 border-t border-graphite-hover">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-moon-grey-dark">
                            Your Position
                          </span>
                          <span className="text-sm font-semibold text-white tabular-nums">
                            {formatUSDC(myPosition.current_value)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2.5">
                    {user ? (
                      myPosition ? (
                        <>
                          <button
                            onClick={() => handleAddLiquidity(pool.id)}
                            className="flex-1 px-4 py-2 bg-neon-iris/20 hover:bg-neon-iris/30 text-neon-iris rounded-lg font-medium text-sm transition-all"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => handleRemoveLiquidity(pool.id)}
                            className="flex-1 px-4 py-2 bg-graphite-hover hover:bg-graphite-deep text-white rounded-lg font-medium text-sm transition-all"
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAddLiquidity(pool.id)}
                          className="w-full px-4 py-2 bg-neon-iris hover:bg-neon-iris/90 text-white rounded-lg font-medium text-sm transition-all"
                        >
                          Add Liquidity
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => navigate("/login")}
                        className="w-full px-4 py-2 bg-neon-iris hover:bg-neon-iris/90 text-white rounded-lg font-medium text-sm transition-all"
                      >
                        Connect to Add Liquidity
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="px-6 py-3 bg-graphite-light hover:bg-graphite-hover text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-graphite-light"
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Add Liquidity Modal */}
      {showAddModal && selectedPool && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setShowAddModal(false);
              setSelectedPool(null);
            }}
          />
          <div
            className="relative bg-graphite-light rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Add Liquidity</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedPool(null);
                }}
                className="text-moon-grey hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <AddLiquidity
              marketId={selectedPool}
              onAdded={handleLiquidityAdded}
            />
          </div>
        </div>
      )}

      {/* Remove Liquidity Modal */}
      {showRemoveModal && selectedPool && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setShowRemoveModal(false);
              setSelectedPool(null);
            }}
          />
          <div
            className="relative bg-graphite-light rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Remove Liquidity</h2>
              <button
                onClick={() => {
                  setShowRemoveModal(false);
                  setSelectedPool(null);
                }}
                className="text-moon-grey hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <RemoveLiquidity
              marketId={selectedPool}
              onRemoved={handleLiquidityRemoved}
            />
          </div>
        </div>
      )}
    </div>
  );
};
