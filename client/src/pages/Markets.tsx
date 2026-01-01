import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useMarketStore } from "@/stores/marketStore";
import { MarketCard } from "@/components/MarketCard";
import { fetchCategories, MarketsApiResponse } from "@/api/api";
import { sortCategories } from "@/utils/categorySort";
import api from "@/config/axios";
import { TrendingMarketsCarousel } from "@/components/TrendingMarketsCarousel";
import { useTrendingMarkets } from "@/hooks/useTrendingMarkets";

type SortOption = "volume" | "newest" | "oldest";
type StatusOption = "active" | "resolved" | "all";
type CreatorTypeOption = "all" | "admin" | "user";

// Load exactly 5 markets per "Load More" click
const MARKETS_PER_PAGE = 9;

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

/**
 * Fetch markets directly from API, bypassing all caching mechanisms.
 * This ensures every request is fresh and no cached responses are used.
 */
const fetchMarketsDirect = async (params: {
  page: number;
  limit: number;
  category?: string;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  status?: string;
  creator_type?: "admin" | "user" | "all";
}): Promise<MarketsApiResponse> => {
  const response = await api.get<MarketsApiResponse>("/market", {
    params: {
      page: params.page,
      limit: params.limit,
      category:
        params.category && params.category !== "all"
          ? params.category
          : undefined,
      search: params.search,
      sort: params.sort,
      order: params.order,
      status: params.status,
      creator_type:
        params.creator_type && params.creator_type !== "all"
          ? params.creator_type
          : undefined,
    },
  });
  return response.data;
};

export const Markets = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedCategory, setSelectedCategory } = useMarketStore();

  // Fetch trending markets for hero carousel
  const { markets: trendingMarkets, isLoading: isLoadingTrending } =
    useTrendingMarkets(5);

  // Markets state - append only, never replace existing items
  const [markets, setMarkets] = useState<any[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Loading states - separate for initial load vs "Load More"
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  // Track if we've loaded the first page
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Filter/search state
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery.trim());
  const [categories, setCategories] = useState<{ id: string; label: string }[]>(
    [{ id: "all", label: "All Markets" }]
  );
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("volume");
  const [status, setStatus] = useState<StatusOption>("active");
  const [creatorType, setCreatorType] = useState<CreatorTypeOption>("all");

  // Refs to track current filter values for race condition prevention
  const loadingRequestIdRef = useRef(0);
  const categoryRef = useRef(selectedCategory);
  const searchRef = useRef(debouncedSearch);
  const sortRef = useRef<SortOption>("volume");
  const statusRef = useRef<StatusOption>("active");
  const creatorTypeRef = useRef<CreatorTypeOption>("all");
  const initialLoadedRef = useRef(false);
  const scrollPositionRef = useRef(0);

  // Reload trigger - increments when filters change to force effect re-run
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Load categories from database
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { categories: dbCategories } = await fetchCategories();
        const sortedCategories = sortCategories(dbCategories);
        setCategories([
          { id: "all", label: "All Markets" },
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

  const validCategoryFromUrl = categories.some(
    (category) => category.id === searchParams.get("category")
  )
    ? (searchParams.get("category") as string)
    : "all";

  // Reset markets list and pagination when filters change
  const resetAndReload = useCallback(() => {
    // Save scroll position before filtering
    if (initialLoadedRef.current) {
      scrollPositionRef.current =
        window.scrollY || document.documentElement.scrollTop;
      setIsFiltering(true);
    } else {
      setMarkets([]);
    }
    setCurrentPage(1);
    setHasMore(true);
    setError(null);
    setInitialLoaded(false);
    initialLoadedRef.current = false;
    loadingRequestIdRef.current += 1;
    setReloadTrigger((prev) => prev + 1); // Force effect to re-run
  }, []);

  // Sync category from URL
  useEffect(() => {
    if (selectedCategory !== validCategoryFromUrl) {
      setSelectedCategory(validCategoryFromUrl);
      resetAndReload();
    }
  }, [
    selectedCategory,
    setSelectedCategory,
    validCategoryFromUrl,
    resetAndReload,
  ]);

  // Debounce search input
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 400);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  // Update refs when state changes
  useEffect(() => {
    categoryRef.current = selectedCategory;
  }, [selectedCategory]);

  useEffect(() => {
    searchRef.current = debouncedSearch;
  }, [debouncedSearch]);

  useEffect(() => {
    sortRef.current = sortBy;
  }, [sortBy]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    creatorTypeRef.current = creatorType;
  }, [creatorType]);

  // Reset when search changes
  useEffect(() => {
    resetAndReload();
  }, [debouncedSearch, resetAndReload]);

  // Reset when sort, status, or creator type changes
  useEffect(() => {
    resetAndReload();
  }, [sortBy, status, creatorType, resetAndReload]);

  const handleCategoryChange = (category: string) => {
    if (category === selectedCategory) return;

    setSelectedCategory(category);
    const params = new URLSearchParams(searchParams);
    if (category === "all") {
      params.delete("category");
    } else {
      params.set("category", category);
    }
    setSearchParams(params, { replace: true });
    resetAndReload();
  };

  /**
   * Load initial markets (first page)
   * Runs when initialLoaded becomes false (after filter changes)
   */
  useEffect(() => {
    if (initialLoaded) return;

    let isCancelled = false;
    const requestId = loadingRequestIdRef.current;

    const loadInitialMarkets = async () => {
      try {
        setIsInitialLoading(true);
        setError(null);

        // Determine sort and order based on sortBy
        let sort: string;
        let order: "asc" | "desc";

        if (sortRef.current === "volume") {
          sort = "volume";
          order = "desc";
        } else if (sortRef.current === "newest") {
          sort = "created";
          order = "desc";
        } else {
          sort = "created";
          order = "asc";
        }

        const fetchParams = {
          page: 1,
          limit: MARKETS_PER_PAGE,
          category: categoryRef.current,
          search: searchRef.current || undefined,
          sort,
          order,
          status: statusRef.current === "all" ? "all" : statusRef.current,
          creator_type: creatorTypeRef.current,
        };

        const result = await fetchMarketsDirect(fetchParams);

        // Check if this request was cancelled or superseded
        if (isCancelled || loadingRequestIdRef.current !== requestId) {
          return;
        }

        const fetchedMarkets = result?.markets ?? [];
        const pagination = result?.pagination;

        // Atomically set markets (replace empty array or existing markets when filtering)
        setMarkets(fetchedMarkets);
        setIsFiltering(false);

        setHasMore(
          typeof pagination?.hasMore === "boolean"
            ? pagination.hasMore
            : fetchedMarkets.length === MARKETS_PER_PAGE
        );
        setInitialLoaded(true);
        initialLoadedRef.current = true;

        // Restore scroll position after filtering (if we saved one)
        if (scrollPositionRef.current > 0) {
          // Use double RAF to ensure DOM has updated
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.scrollTo(0, scrollPositionRef.current);
              scrollPositionRef.current = 0; // Reset after restoring
            });
          });
        }
      } catch (marketError) {
        if (isCancelled || loadingRequestIdRef.current !== requestId) {
          return;
        }
        console.error("Failed to load markets:", marketError);
        setError(
          marketError instanceof Error
            ? marketError.message
            : "Unable to load markets right now."
        );
        setIsFiltering(false);
      } finally {
        if (!isCancelled && loadingRequestIdRef.current === requestId) {
          setIsInitialLoading(false);
        }
      }
    };

    loadInitialMarkets();

    return () => {
      isCancelled = true;
    };
  }, [initialLoaded, reloadTrigger]);

  /**
   * Handle "Load More" button click
   * Loads exactly 5 additional markets and appends them atomically
   */
  const handleLoadMore = useCallback(async () => {
    // Prevent multiple concurrent requests
    if (isLoadingMore || !hasMore) return;

    const requestId = ++loadingRequestIdRef.current;
    let isCancelled = false;

    try {
      setIsLoadingMore(true);
      setError(null);

      // Determine sort and order
      let sort: string;
      let order: "asc" | "desc";

      if (sortRef.current === "volume") {
        sort = "volume";
        order = "desc";
      } else if (sortRef.current === "newest") {
        sort = "created";
        order = "desc";
      } else {
        sort = "created";
        order = "asc";
      }

      const nextPage = currentPage + 1;
      const fetchParams = {
        page: nextPage,
        limit: MARKETS_PER_PAGE,
        category: categoryRef.current,
        search: searchRef.current || undefined,
        sort,
        order,
        status: statusRef.current === "all" ? "all" : statusRef.current,
        creator_type: creatorTypeRef.current,
      };

      const result = await fetchMarketsDirect(fetchParams);

      // Check if this request was cancelled or superseded
      if (isCancelled || loadingRequestIdRef.current !== requestId) {
        return;
      }

      const fetchedMarkets = result?.markets ?? [];
      const pagination = result?.pagination;

      // Atomically append new markets - existing markets never rerender
      setMarkets((current) => {
        // Create a new array with existing markets + new markets
        // This ensures React sees it as a new reference but existing MarketCard
        // components remain stable due to stable keys (market.id)
        const existingIds = new Set(current.map((m) => m.id));
        const newMarkets = fetchedMarkets.filter((m) => !existingIds.has(m.id));
        return [...current, ...newMarkets];
      });

      setHasMore(
        typeof pagination?.hasMore === "boolean"
          ? pagination.hasMore
          : fetchedMarkets.length === MARKETS_PER_PAGE
      );
      setCurrentPage(nextPage);
    } catch (marketError) {
      if (isCancelled || loadingRequestIdRef.current !== requestId) {
        return;
      }
      console.error("Failed to load more markets:", marketError);
      setError(
        marketError instanceof Error
          ? marketError.message
          : "Unable to load more markets right now."
      );
    } finally {
      if (!isCancelled && loadingRequestIdRef.current === requestId) {
        setIsLoadingMore(false);
      }
    }
  }, [currentPage, hasMore, isLoadingMore]);

  const handleRetry = () => {
    resetAndReload();
  };

  /**
   * Render skeleton placeholders for loading state
   */
  const renderSkeletonPlaceholders = (count: number = MARKETS_PER_PAGE) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`skeleton-loading-${index}`}
          className="bg-ink-black p-6 sm:p-8 animate-pulse"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-graphite-hover" />
            <div className="h-3 w-20 bg-graphite-hover rounded" />
          </div>
          <div className="h-5 w-3/4 bg-graphite-hover rounded mb-2" />
          <div className="h-5 w-1/2 bg-graphite-light rounded mb-6" />
          <div className="h-1.5 w-full bg-graphite-hover rounded mb-6" />
          <div className="flex justify-between">
            <div className="h-4 w-16 bg-graphite-hover rounded" />
            <div className="h-4 w-20 bg-graphite-hover rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  const showEmptyState =
    !isInitialLoading && initialLoaded && !markets.length && !error;

  return (
    <div className="min-h-screen bg-ink-black">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(33,246,210,0.06),transparent_50%)]" />
      </div>

      {/* Gradient line accent at top */}
      <div className="fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent z-50" />

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative border-b border-white/5">
          <div className="section-container py-12 sm:py-16 lg:py-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Section Label */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px w-8 sm:w-12 bg-gradient-to-r from-transparent to-neon-iris/60" />
                <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-moon-grey/70 font-medium">
                  Prediction Markets
                </span>
              </div>

              {/* Title Row */}
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                <div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-[-0.02em] text-white mb-3">
                    Markets
                  </h1>
                  <p className="text-base sm:text-lg text-moon-grey/60 font-light max-w-xl">
                    Trade on outcomes you believe in. Create positions, capture alpha.
                  </p>
                </div>

                {/* Create Market CTA */}
                <Link
                  to="/create"
                  className="group px-6 py-3 text-sm font-medium tracking-wide uppercase bg-white text-ink-black rounded-none hover:bg-moon-grey-light transition-all duration-300 inline-flex items-center justify-center gap-3 whitespace-nowrap"
                >
                  <span>Create Market</span>
                  <svg
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </Link>
              </div>
            </motion.div>

            {/* Trending Markets Carousel */}
            {!isLoadingTrending && trendingMarkets.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <TrendingMarketsCarousel markets={trendingMarkets} />
              </motion.div>
            )}
          </div>
        </section>

        {/* Filters Section */}
        <section className="relative border-b border-white/5 bg-graphite-deep/30">
          <div className="section-container py-6">
            {/* Top Row: Search + Filters */}
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-moon-grey/50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-11 bg-ink-black border border-white/10 text-white text-sm placeholder-moon-grey/40 focus:border-neon-iris/50 focus:ring-1 focus:ring-neon-iris/20 transition-all rounded-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-moon-grey/50 hover:text-white transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
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
                )}
              </div>

              {/* Filter Controls */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Creator Type Tabs */}
                <div className="flex items-center border border-white/10">
                  {[
                    { value: "all", label: "All" },
                    { value: "user", label: "Community" },
                    { value: "admin", label: "Official" },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => {
                        setCreatorType(tab.value as CreatorTypeOption);
                        resetAndReload();
                      }}
                      className={`px-4 py-2 text-xs tracking-wide uppercase font-medium transition-all ${
                        creatorType === tab.value
                          ? "bg-white text-ink-black"
                          : "text-moon-grey/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Filter Dropdown Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-4 py-2 text-xs tracking-wide uppercase font-medium transition-all border flex items-center gap-2 ${
                      showFilters
                        ? "border-neon-iris/50 text-white bg-white/5"
                        : "border-white/10 text-moon-grey/60 hover:text-white hover:border-white/20"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      />
                    </svg>
                    Filters
                    {(sortBy !== "volume" || status !== "active") && (
                      <span className="w-1.5 h-1.5 rounded-full bg-neon-iris" />
                    )}
                  </button>

                  {showFilters && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowFilters(false)}
                      />
                      <div className="absolute right-0 mt-2 w-64 bg-graphite-deep border border-white/10 shadow-2xl z-20">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
                        <div className="p-5 space-y-5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 font-medium">
                              Filter Options
                            </span>
                            <button
                              onClick={() => setShowFilters(false)}
                              className="text-moon-grey/50 hover:text-white transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
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

                          <div>
                            <label className="block text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 font-medium mb-3">
                              Sort By
                            </label>
                            <div className="space-y-1">
                              {(["volume", "newest", "oldest"] as SortOption[]).map(
                                (option) => (
                                  <button
                                    key={option}
                                    onClick={() => setSortBy(option)}
                                    className={`w-full text-left px-3 py-2 text-sm transition-all ${
                                      sortBy === option
                                        ? "text-white bg-white/5 border-l-2 border-neon-iris"
                                        : "text-moon-grey/60 hover:text-white hover:bg-white/[0.02]"
                                    }`}
                                  >
                                    {option === "volume" && "Volume"}
                                    {option === "newest" && "Newest First"}
                                    {option === "oldest" && "Oldest First"}
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          <div className="h-px bg-white/5" />

                          <div>
                            <label className="block text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 font-medium mb-3">
                              Status
                            </label>
                            <div className="space-y-1">
                              {(["active", "resolved", "all"] as StatusOption[]).map(
                                (option) => (
                                  <button
                                    key={option}
                                    onClick={() => setStatus(option)}
                                    className={`w-full text-left px-3 py-2 text-sm transition-all ${
                                      status === option
                                        ? "text-white bg-white/5 border-l-2 border-neon-iris"
                                        : "text-moon-grey/60 hover:text-white hover:bg-white/[0.02]"
                                    }`}
                                  >
                                    {option === "active" && "Active Only"}
                                    {option === "resolved" && "Resolved Only"}
                                    {option === "all" && "All Statuses"}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="mt-5 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 min-w-max sm:flex-wrap sm:min-w-0">
                <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 font-medium mr-2 hidden sm:inline-block">
                  Category
                </span>
                {(showAllCategories ? categories : categories.slice(0, 8)).map(
                  (category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryChange(category.id)}
                      className={`px-3 py-1.5 text-xs tracking-wide transition-all whitespace-nowrap flex-shrink-0 border ${
                        selectedCategory === category.id
                          ? "bg-white text-ink-black border-white"
                          : "text-moon-grey/60 border-white/10 hover:text-white hover:border-white/20"
                      }`}
                    >
                      {category.label}
                    </button>
                  )
                )}
                {categories.length > 8 && (
                  <button
                    onClick={() => setShowAllCategories(!showAllCategories)}
                    className="px-3 py-1.5 text-xs tracking-wide transition-all whitespace-nowrap flex-shrink-0 text-neon-iris/80 hover:text-neon-iris border border-neon-iris/30 hover:border-neon-iris/50 flex items-center gap-1"
                  >
                    {showAllCategories ? (
                      <>
                        <span>Less</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </>
                    ) : (
                      <>
                        <span>+{categories.length - 8}</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Markets Grid Section */}
        <section className="relative py-8 sm:py-12 lg:py-16">
          <div className="section-container">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="h-px w-8 bg-gradient-to-r from-neon-iris/60 to-transparent" />
                <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-moon-grey/70 font-medium">
                  {selectedCategory === "all" ? "All Markets" : categories.find(c => c.id === selectedCategory)?.label || "Markets"}
                </span>
              </div>
              {isFiltering && (
                <div className="flex items-center gap-2 text-moon-grey/50">
                  <div className="w-3 h-3 border border-neon-iris/50 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Updating...</span>
                </div>
              )}
            </div>

            {/* Error State */}
            {error && !markets.length ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 border border-white/10 mb-6">
                  <svg className="w-8 h-8 text-moon-grey/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-moon-grey/60 text-lg font-light mb-6">
                  {error || "Something went wrong while loading markets."}
                </p>
                <button
                  onClick={handleRetry}
                  className="px-6 py-3 text-sm font-medium tracking-wide uppercase text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all"
                >
                  Try Again
                </button>
              </div>
            ) : showEmptyState ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 border border-white/10 mb-6">
                  <svg className="w-8 h-8 text-moon-grey/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-moon-grey/60 text-lg font-light mb-2">
                  No markets found matching your criteria.
                </p>
                <p className="text-moon-grey/40 text-sm font-light">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <>
                {/* Initial loading skeleton */}
                {isInitialLoading && !initialLoaded && markets.length === 0 &&
                  renderSkeletonPlaceholders()
                }

                {/* Markets grid */}
                {markets.length > 0 && (
                  <motion.div
                    className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${
                      isFiltering ? "opacity-60" : ""
                    }`}
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                  >
                    {markets.map((market, index) => (
                      <motion.div
                        key={market.id}
                        variants={fadeInUp}
                        custom={index}
                      >
                        <MarketCard market={market} />
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {/* Skeleton placeholders for loading more */}
                {isLoadingMore && renderSkeletonPlaceholders()}

                {/* Load More / End of list */}
                {initialLoaded && (
                  <div className="flex justify-center pt-12">
                    {isLoadingMore ? (
                      <div className="flex items-center gap-3 text-moon-grey/50">
                        <div className="w-4 h-4 border border-neon-iris/50 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-light">Loading...</span>
                      </div>
                    ) : hasMore ? (
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="group px-8 py-3 text-sm font-medium tracking-wide uppercase text-moon-grey/60 border border-white/10 hover:text-white hover:border-white/20 transition-all inline-flex items-center gap-3"
                      >
                        <span>Load More</span>
                        <svg
                          className="w-4 h-4 transition-transform group-hover:translate-y-0.5"
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
                      </button>
                    ) : markets.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/10" />
                        <span className="text-xs tracking-[0.2em] uppercase text-moon-grey/40">
                          End of list
                        </span>
                        <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/10" />
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
