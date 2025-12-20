import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMarketStore } from "@/stores/marketStore";
import { MarketCard } from "@/components/MarketCard";
import { fetchCategories, MarketsApiResponse } from "@/api/api";
import { sortCategories } from "@/utils/categorySort";
import api from "@/config/axios";

type SortOption = "volume" | "newest" | "oldest";
type StatusOption = "active" | "resolved" | "all";

// Load exactly 5 markets per "Load More" click
const MARKETS_PER_PAGE = 9;

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
    },
  });
  return response.data;
};

export const Markets = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedCategory, setSelectedCategory } = useMarketStore();

  // Markets state - append only, never replace existing items
  const [markets, setMarkets] = useState<any[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Loading states - separate for initial load vs "Load More"
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  // Refs to track current filter values for race condition prevention
  const loadingRequestIdRef = useRef(0);
  const categoryRef = useRef(selectedCategory);
  const searchRef = useRef(debouncedSearch);
  const sortRef = useRef<SortOption>("volume");
  const statusRef = useRef<StatusOption>("active");

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
    setMarkets([]);
    setCurrentPage(1);
    setHasMore(true);
    setError(null);
    setInitialLoaded(false);
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

  // Reset when search changes
  useEffect(() => {
    resetAndReload();
  }, [debouncedSearch, resetAndReload]);

  // Reset when sort or status changes
  useEffect(() => {
    resetAndReload();
  }, [sortBy, status, resetAndReload]);

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
        };

        const result = await fetchMarketsDirect(fetchParams);

        // Check if this request was cancelled or superseded
        if (isCancelled || loadingRequestIdRef.current !== requestId) {
          return;
        }

        const fetchedMarkets = result?.markets ?? [];
        const pagination = result?.pagination;

        // Atomically set markets (replace empty array)
        setMarkets(fetchedMarkets);

        setHasMore(
          typeof pagination?.hasMore === "boolean"
            ? pagination.hasMore
            : fetchedMarkets.length === MARKETS_PER_PAGE
        );
        setInitialLoaded(true);
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
   * Used only for the new batch being loaded (not initial load)
   */
  const renderSkeletonPlaceholders = (count: number = MARKETS_PER_PAGE) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`skeleton-loading-${index}`}
          className="card animate-pulse h-64 bg-graphite-deep"
        >
          <div className="h-4 w-24 bg-graphite-hover rounded mb-4" />
          <div className="h-6 w-3/4 bg-graphite-hover rounded mb-2" />
          <div className="h-6 w-2/3 bg-graphite-light rounded" />
        </div>
      ))}
    </div>
  );

  const showEmptyState =
    !isInitialLoading && initialLoaded && !markets.length && !error;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
          Markets
        </h1>
        <p className="text-moon-grey text-sm sm:text-base">
          Trade on your predictions about future events
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full sm:max-w-md text-base"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary flex items-center gap-2"
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
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            Filters
          </button>

          {showFilters && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowFilters(false)}
              />
              {/* Dropdown */}
              <div className="absolute right-0 mt-2 w-64 bg-graphite-deep border border-graphite-light rounded-xl shadow-xl z-20 p-4">
                <div className="space-y-4">
                  {/* Sort Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-moon-grey mb-2">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="w-full input bg-graphite-light text-white"
                    >
                      <option value="volume">Volume</option>
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                    </select>
                  </div>

                  {/* Status Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-moon-grey mb-2">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as StatusOption)
                      }
                      className="w-full input bg-graphite-light text-white"
                    >
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Filter - Horizontal scroll on mobile */}
      <div className="mb-6 sm:mb-8 -mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 sm:flex-wrap sm:gap-2 pb-2 sm:pb-0">
          {(showAllCategories ? categories : categories.slice(0, 8)).map(
            (category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                className={`px-3 sm:px-4 py-2 rounded-xl font-medium transition-all text-sm whitespace-nowrap flex-shrink-0 min-h-[40px] ${
                  selectedCategory === category.id
                    ? "bg-neon-iris text-white shadow-lg shadow-neon-iris/30"
                    : "bg-graphite-light text-moon-grey  hover:bg-graphite-hover "
                }`}
              >
                {category.label}
              </button>
            )
          )}
          {categories.length > 8 && (
            <button
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="px-3 sm:px-4 py-2 rounded-xl font-medium transition-all text-sm whitespace-nowrap flex-shrink-0 min-h-[40px] bg-graphite-deep text-moon-grey-dark  hover:bg-graphite-light hover:text-moon-grey"
            >
              {showAllCategories
                ? "Show less"
                : `+${categories.length - 8} more`}
            </button>
          )}
        </div>
      </div>

      {/* Markets Grid */}
      {error && !markets.length ? (
        <div className="text-center py-16">
          <p className="text-danger-400 text-lg mb-4">
            {error || "Something went wrong while loading markets."}
          </p>
          <button className="btn btn-primary" onClick={handleRetry}>
            Try Again
          </button>
        </div>
      ) : showEmptyState ? (
        <div className="text-center py-16 px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-graphite-light flex items-center justify-center">
            <svg
              className="w-8 h-8 text-moon-grey-dark"
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
          <p className="text-moon-grey text-base sm:text-lg">
            No markets found matching your criteria.
          </p>
          <p className="text-moon-grey-dark text-sm mt-2">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <>
          {/* Initial loading skeleton */}
          {isInitialLoading && !initialLoaded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: MARKETS_PER_PAGE }).map((_, index) => (
                <div
                  key={`skeleton-initial-${index}`}
                  className="card animate-pulse h-64 bg-graphite-deep"
                >
                  <div className="h-4 w-24 bg-graphite-hover rounded mb-4" />
                  <div className="h-6 w-3/4 bg-graphite-hover rounded mb-2" />
                  <div className="h-6 w-2/3 bg-graphite-light rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Markets grid - stable keys ensure no rerenders */}
          {markets.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          )}

          {/* Skeleton placeholders for new batch being loaded */}
          {isLoadingMore && renderSkeletonPlaceholders()}

          {/* Load More button - pinned to bottom */}
          {initialLoaded && (
            <div className="flex justify-center py-6 mt-4">
              {isLoadingMore ? (
                <div className="text-moon-grey flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-neon-iris border-t-transparent rounded-full animate-spin" />
                  Loading more markets...
                </div>
              ) : hasMore ? (
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="btn btn-primary px-8 py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load More
                </button>
              ) : markets.length > 0 ? (
                <div className="text-center py-2 text-moon-grey-dark">
                  You've reached the end of the list
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
};
