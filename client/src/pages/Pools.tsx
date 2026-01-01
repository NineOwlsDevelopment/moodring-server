import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardVariant = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
};

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
    <div className="min-h-screen bg-ink-black relative overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_90%_100%,rgba(33,246,210,0.06),transparent_40%)]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02] hidden sm:block"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Gradient line accent at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/20 to-transparent z-10" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-24 lg:pb-12">
        {/* Header */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Title Row with Stats */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
            <div>
              <motion.div
                className="inline-flex items-center gap-3 mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-aqua-pulse/60" />
                <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/60 font-medium">
                  Liquidity Pools
                </span>
              </motion.div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extralight text-white tracking-tight">
                Pools
              </h1>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 lg:gap-10">
              <div className="text-center">
                <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-1">
                  Total Value Locked
                </div>
                <div className="text-xl sm:text-2xl font-light text-white tabular-nums">
                  {formatRegularUSDC(totalTVL)}
                </div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-1">
                  Fees Earned
                </div>
                <div className="text-xl sm:text-2xl font-light text-aqua-pulse tabular-nums">
                  {formatRegularUSDC(totalFees)}
                </div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-1">
                  Active Pools
                </div>
                <div className="text-xl sm:text-2xl font-light text-white tabular-nums">
                  {allPools.length}
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center border border-white/[0.08] bg-white/[0.02]">
              <button
                onClick={() => setView("all")}
                className={`px-4 py-2 text-[10px] tracking-[0.1em] uppercase font-medium transition-all ${
                  view === "all"
                    ? "bg-white/[0.08] text-white"
                    : "text-moon-grey/60 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                All Pools
              </button>
              {user && (
                <button
                  onClick={() => setView("my-pools")}
                  className={`px-4 py-2 text-[10px] tracking-[0.1em] uppercase font-medium transition-all ${
                    view === "my-pools"
                      ? "bg-white/[0.08] text-white"
                      : "text-moon-grey/60 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  My Pools ({myPositions.length})
                </button>
              )}
            </div>

            {/* Creator Type */}
            <div className="flex items-center border border-white/[0.08] bg-white/[0.02]">
              <button
                onClick={() => setCreatorType("admin")}
                className={`px-4 py-2 text-[10px] tracking-[0.1em] uppercase font-medium transition-all ${
                  creatorType === "admin"
                    ? "bg-neon-iris/20 text-neon-iris border-r border-neon-iris/30"
                    : "text-moon-grey/60 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                Official
              </button>
              <button
                onClick={() => setCreatorType("user")}
                className={`px-4 py-2 text-[10px] tracking-[0.1em] uppercase font-medium transition-all ${
                  creatorType === "user"
                    ? "bg-neon-iris/20 text-neon-iris border-r border-neon-iris/30"
                    : "text-moon-grey/60 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                Community
              </button>
              <button
                onClick={() => setCreatorType("all")}
                className={`px-4 py-2 text-[10px] tracking-[0.1em] uppercase font-medium transition-all ${
                  creatorType === "all"
                    ? "bg-neon-iris/20 text-neon-iris"
                    : "text-moon-grey/60 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                All
              </button>
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 text-[10px] tracking-[0.1em] uppercase font-medium bg-white/[0.02] text-moon-grey border border-white/[0.08] hover:bg-white/[0.04] transition-all focus:outline-none focus:border-neon-iris/30 cursor-pointer appearance-none pr-8"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: "right 0.5rem center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "1.5em 1.5em",
              }}
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
              className="px-4 py-2 text-[10px] tracking-[0.1em] uppercase font-medium bg-white/[0.02] text-moon-grey border border-white/[0.08] hover:bg-white/[0.04] transition-all focus:outline-none focus:border-neon-iris/30 cursor-pointer appearance-none pr-8"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: "right 0.5rem center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "1.5em 1.5em",
              }}
            >
              <option value="tvl">Sort: TVL</option>
              <option value="apr">Sort: APR</option>
              <option value="fees">Sort: Fees</option>
              <option value="volume">Sort: Volume</option>
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
            </select>
          </div>
        </motion.div>

        {/* Pools List */}
        {isLoading ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <motion.div
                key={i}
                variants={cardVariant}
                className="relative bg-graphite-deep/40 border border-white/[0.06] p-5"
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-white/[0.04] animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 bg-white/[0.04] animate-pulse mb-2 w-3/4" />
                    <div className="h-3 bg-white/[0.04] animate-pulse w-1/2" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 bg-white/[0.04] animate-pulse" />
                  <div className="h-3 bg-white/[0.04] animate-pulse w-2/3" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : displayedPools.length === 0 ? (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 border border-white/[0.08] bg-white/[0.02] mb-6">
              <svg
                className="w-8 h-8 text-moon-grey/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <p className="text-moon-grey/60 font-light">
              {view === "my-pools"
                ? "You haven't joined any pools yet"
                : "No active pools found"}
            </p>
          </motion.div>
        ) : (
          <>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {displayedPools.map((pool, idx) => {
                const myPosition = getMyPosition(pool.id);
                const apr = calculateAPR(pool);
                // Convert from micro-USDC to regular USDC
                const tvl =
                  (Number(pool.shared_pool_liquidity) || 0) / 1_000_000 +
                  (Number(pool.accumulated_lp_fees) || 0) / 1_000_000;
                const feesEarned =
                  (Number(pool.accumulated_lp_fees) || 0) / 1_000_000;

                return (
                  <motion.div
                    key={pool.id}
                    variants={cardVariant}
                    transition={{ delay: idx * 0.03 }}
                    className="group relative bg-graphite-deep/40 border border-white/[0.06] hover:border-neon-iris/20 transition-all duration-500"
                  >
                    {/* Gradient accent line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-neon-iris/30 transition-all duration-500" />

                    <div className="p-5">
                      {/* Pool Header */}
                      <div className="flex items-start gap-4 mb-5">
                        {pool.image_url ? (
                          <img
                            src={pool.image_url}
                            alt=""
                            className="w-12 h-12 object-cover flex-shrink-0 ring-1 ring-white/10"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-neon-iris/20 to-aqua-pulse/20 flex items-center justify-center flex-shrink-0 border border-white/[0.08]">
                            <span className="text-white/60 font-light text-lg">
                              {pool.question.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/market/${pool.id}`}
                            className="text-white font-light hover:text-neon-iris transition-colors line-clamp-2 text-sm leading-snug block"
                          >
                            {pool.question}
                          </Link>
                          <div className="text-[10px] tracking-wide text-moon-grey/50 mt-2 uppercase">
                            {pool.lp_count} Provider
                            {pool.lp_count !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>

                      {/* Pool Stats */}
                      <div className="space-y-3 mb-5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/50">
                            TVL
                          </span>
                          <span className="text-sm font-light text-white tabular-nums">
                            {formatRegularUSDC(tvl)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/50">
                            Fees
                          </span>
                          <span className="text-sm font-light text-aqua-pulse tabular-nums">
                            {formatRegularUSDC(feesEarned)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/50">
                            APR
                          </span>
                          <span className="text-sm font-light text-neon-iris tabular-nums">
                            {apr.toFixed(2)}%
                          </span>
                        </div>
                        {myPosition && (
                          <div className="pt-3 mt-3 border-t border-white/[0.06]">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/50">
                                Your Position
                              </span>
                              <span className="text-sm font-light text-white tabular-nums">
                                {formatUSDC(myPosition.current_value)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {user ? (
                          myPosition ? (
                            <>
                              <button
                                onClick={() => handleAddLiquidity(pool.id)}
                                className="flex-1 px-4 py-2.5 bg-neon-iris/10 hover:bg-neon-iris/20 text-neon-iris text-[10px] tracking-[0.1em] uppercase font-medium transition-all border border-neon-iris/20 hover:border-neon-iris/40"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => handleRemoveLiquidity(pool.id)}
                                className="flex-1 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white text-[10px] tracking-[0.1em] uppercase font-medium transition-all border border-white/[0.08] hover:border-white/[0.15]"
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleAddLiquidity(pool.id)}
                              className="w-full px-4 py-2.5 bg-neon-iris hover:bg-neon-iris/90 text-white text-[10px] tracking-[0.1em] uppercase font-medium transition-all"
                            >
                              Add Liquidity
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => navigate("/login")}
                            className="w-full px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-moon-grey hover:text-white text-[10px] tracking-[0.1em] uppercase font-medium transition-all border border-white/[0.08]"
                          >
                            Connect to Add Liquidity
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Load More Button */}
            {hasMore && (
              <motion.div
                className="flex justify-center mt-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="group px-8 py-3 text-[10px] tracking-[0.15em] uppercase font-medium text-moon-grey hover:text-white border border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.04] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-3"
                >
                  {isLoadingMore ? (
                    <>
                      <div className="w-3 h-3 border border-moon-grey/40 border-t-transparent rounded-full animate-spin" />
                      <span>Loading</span>
                    </>
                  ) : (
                    <>
                      <span>Load More</span>
                      <svg
                        className="w-3 h-3 transition-transform group-hover:translate-y-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </>
        )}

        {/* Add Liquidity Modal */}
        {showAddModal && selectedPool && user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-ink-black/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => {
                setShowAddModal(false);
                setSelectedPool(null);
              }}
            />
            <motion.div
              className="relative bg-graphite-deep border border-white/[0.08] p-6 max-w-md w-full shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/40 to-transparent" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-light text-white tracking-tight">
                  Add Liquidity
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedPool(null);
                  }}
                  className="text-moon-grey/60 hover:text-white transition-colors p-1"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <AddLiquidity
                marketId={selectedPool}
                onAdded={handleLiquidityAdded}
              />
            </motion.div>
          </div>
        )}

        {/* Remove Liquidity Modal */}
        {showRemoveModal && selectedPool && user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-ink-black/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => {
                setShowRemoveModal(false);
                setSelectedPool(null);
              }}
            />
            <motion.div
              className="relative bg-graphite-deep border border-white/[0.08] p-6 max-w-md w-full shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/40 to-transparent" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-light text-white tracking-tight">
                  Remove Liquidity
                </h2>
                <button
                  onClick={() => {
                    setShowRemoveModal(false);
                    setSelectedPool(null);
                  }}
                  className="text-moon-grey/60 hover:text-white transition-colors p-1"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <RemoveLiquidity
                marketId={selectedPool}
                onRemoved={handleLiquidityRemoved}
              />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
