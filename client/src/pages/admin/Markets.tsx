import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatUSDC } from "@/utils/format";
import { Market } from "@/types/market";
import {
  fetchMarkets,
  submitResolution,
  toggleMarketFeatured,
  toggleMarketVerified,
} from "@/api/api";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type StatusFilter = "all" | "active" | "resolved" | "expired";

export const AdminMarkets = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [resolvingMarketId, setResolvingMarketId] = useState<string | null>(
    null
  );
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [winningSide, setWinningSide] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [expandedMarketId, setExpandedMarketId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadMarkets();
  }, [page, statusFilter, debouncedSearch]);

  const loadMarkets = async () => {
    try {
      setLoading(true);
      const response = await fetchMarkets({
        page,
        limit: 25,
        sort: "created_at",
        order: "desc",
        status: statusFilter === "all" ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      });
      setMarkets(response.markets || []);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
        setTotalCount(response.pagination.total);
      }
    } catch (error: any) {
      console.error("Failed to load markets:", error);
      toast.error(error.response?.data?.error || "Failed to load markets");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedMarket || !selectedOption) return;

    try {
      setResolvingMarketId(selectedMarket.id);
      await submitResolution({
        marketId: selectedMarket.id,
        optionId: selectedOption.id,
        outcome: selectedOption.option_label,
        winningSide,
        evidence: reason.trim() ? { notes: reason.trim() } : undefined,
      });
      toast.success("Market option resolved successfully");
      setShowResolveModal(false);
      setReason("");
      setSelectedMarket(null);
      setSelectedOption(null);
      loadMarkets();
    } catch (error: any) {
      console.error("Failed to resolve market:", error);
      toast.error(
        error.response?.data?.error || "Failed to resolve market option"
      );
    } finally {
      setResolvingMarketId(null);
    }
  };

  const handleToggleFeatured = async (market: Market) => {
    try {
      await toggleMarketFeatured(market.id, {
        is_featured: !(market as any).is_featured,
      });
      toast.success(
        (market as any).is_featured
          ? "Market unfeatured"
          : "Market featured successfully"
      );
      loadMarkets();
    } catch (error: any) {
      console.error("Failed to toggle featured:", error);
      toast.error(error.response?.data?.error || "Failed to update market");
    }
  };

  const handleToggleVerified = async (market: Market) => {
    try {
      await toggleMarketVerified(market.id, {
        is_verified: !(market as any).is_verified,
      });
      toast.success(
        (market as any).is_verified
          ? "Market unverified"
          : "Market verified successfully"
      );
      loadMarkets();
    } catch (error: any) {
      console.error("Failed to toggle verified:", error);
      toast.error(error.response?.data?.error || "Failed to update market");
    }
  };

  const openResolveModal = (market: Market, option: any) => {
    setSelectedMarket(market);
    setSelectedOption(option);
    setWinningSide(1);
    setReason("");
    setShowResolveModal(true);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getMarketStatus = (market: Market) => {
    if (market.is_resolved) return "resolved";
    if (!market.is_initialized) return "pending";
    if (market.expiration_timestamp <= Date.now() / 1000) return "expired";
    return "active";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";
      case "resolved":
        return "text-aqua-pulse border-aqua-pulse/30 bg-aqua-pulse/10";
      case "expired":
        return "text-amber-400 border-amber-400/30 bg-amber-400/10";
      case "pending":
        return "text-moon-grey border-moon-grey/30 bg-moon-grey/10";
      default:
        return "text-moon-grey/60 border-white/10";
    }
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All Markets" },
    { key: "active", label: "Active" },
    { key: "resolved", label: "Resolved" },
    { key: "expired", label: "Expired" },
  ];

  if (loading && markets.length === 0) {
    return (
      <div className="min-h-screen bg-ink-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-neon-iris rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-black">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.08),transparent_60%)]" />
      </div>

      <div className="relative p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
        >
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-3">
              Administration
            </div>
            <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white">
              Manage Markets
            </h1>
            <p className="text-sm text-moon-grey/50 mt-2">
              {totalCount} total markets
            </p>
          </div>
          <button
            onClick={loadMarkets}
            disabled={loading}
            className="px-4 py-2.5 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </motion.div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 space-y-4"
        >
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search markets by question or description..."
              className="w-full bg-graphite-deep/50 border border-white/10 px-4 py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-moon-grey/40 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => {
                  setStatusFilter(filter.key);
                  setPage(1);
                }}
                className={`px-4 py-2 text-xs tracking-wide uppercase font-medium border transition-all duration-300 ${
                  statusFilter === filter.key
                    ? "bg-gradient-to-r from-neon-iris to-aqua-pulse text-white border-transparent"
                    : "bg-white/5 text-moon-grey/70 border-white/10 hover:border-white/20 hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Markets List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <AnimatePresence mode="popLayout">
            {markets.length > 0 ? (
              markets.map((market, index) => {
                const status = getMarketStatus(market);
                const isExpanded = expandedMarketId === market.id;

                return (
                  <motion.div
                    key={market.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-graphite-deep/30 border border-white/5 hover:border-white/10 transition-all duration-300"
                  >
                    {/* Main Row */}
                    <div
                      className="p-5 cursor-pointer"
                      onClick={() =>
                        setExpandedMarketId(isExpanded ? null : market.id)
                      }
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        {/* Market Image & Info */}
                        <div className="flex gap-4 flex-1 min-w-0">
                          {market.image_url && (
                            <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-white/10">
                              <img
                                src={market.image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-light text-white text-sm leading-snug line-clamp-2">
                              {market.question}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              <span className="text-[10px] text-moon-grey/40 font-mono">
                                {market.id.slice(0, 8)}...
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] tracking-[0.1em] uppercase font-medium border ${getStatusColor(
                                  status
                                )}`}
                              >
                                {status}
                              </span>
                              {(market as any).is_featured && (
                                <span className="px-2 py-0.5 text-[10px] tracking-[0.1em] uppercase font-medium text-amber-400 border border-amber-400/30 bg-amber-400/10">
                                  Featured
                                </span>
                              )}
                              {(market as any).is_verified && (
                                <span className="px-2 py-0.5 text-[10px] tracking-[0.1em] uppercase font-medium text-neon-iris border border-neon-iris/30 bg-neon-iris/10">
                                  Verified
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex flex-wrap gap-6 lg:gap-8 text-sm">
                          <div>
                            <div className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/40 mb-1">
                              Volume
                            </div>
                            <div className="text-white font-light tabular-nums">
                              {formatUSDC(market.total_volume || 0)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/40 mb-1">
                              Options
                            </div>
                            <div className="text-white font-light">
                              {market.options?.length ||
                                market.total_options ||
                                0}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/40 mb-1">
                              Created
                            </div>
                            <div className="text-white font-light">
                              {formatDate(market.created_at)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/40 mb-1">
                              Expires
                            </div>
                            <div className="text-white font-light">
                              {formatDate(market.expiration_timestamp)}
                            </div>
                          </div>
                        </div>

                        {/* Expand Icon */}
                        <div className="hidden lg:flex items-center">
                          <span
                            className={`text-moon-grey/40 transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          >
                            ▼
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-0 border-t border-white/5">
                            {/* Creator & Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
                              {/* Creator */}
                              <div className="space-y-3">
                                <h4 className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                                  Creator
                                </h4>
                                <div className="flex items-center gap-3">
                                  {market.creator_avatar_url ? (
                                    <img
                                      src={market.creator_avatar_url}
                                      alt=""
                                      className="w-8 h-8 rounded-full border border-white/10"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-iris/50 to-aqua-pulse/50 border border-white/10" />
                                  )}
                                  <div>
                                    <div className="text-sm text-white font-light">
                                      {market.creator_display_name ||
                                        market.creator_username ||
                                        "Anonymous"}
                                    </div>
                                    {market.creator_username && (
                                      <div className="text-xs text-moon-grey/40">
                                        @{market.creator_username}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-[10px] text-moon-grey/40 font-mono">
                                  ID: {market.creator_id.slice(0, 12)}...
                                </div>
                              </div>

                              {/* Market Stats */}
                              <div className="space-y-3">
                                <h4 className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                                  Market Stats
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-moon-grey/60">
                                      Liquidity
                                    </span>
                                    <span className="text-white font-light tabular-nums">
                                      {market.liquidity_parameter?.toLocaleString() ||
                                        "N/A"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-moon-grey/60">
                                      Creator Fees
                                    </span>
                                    <span className="text-white font-light tabular-nums">
                                      {formatUSDC(
                                        market.creator_fees_collected || 0
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-moon-grey/60">
                                      Protocol Fees
                                    </span>
                                    <span className="text-white font-light tabular-nums">
                                      {formatUSDC(
                                        market.protocol_fees_collected || 0
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-moon-grey/60">
                                      Binary
                                    </span>
                                    <span className="text-white font-light">
                                      {market.is_binary ? "Yes" : "No"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Categories */}
                              <div className="space-y-3">
                                <h4 className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                                  Categories
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {market.categories &&
                                  market.categories.length > 0 ? (
                                    market.categories.map((cat) => (
                                      <span
                                        key={cat.id}
                                        className="px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase text-moon-grey/70 bg-white/5 border border-white/10"
                                      >
                                        {cat.name}
                                      </span>
                                    ))
                                  ) : market.category ? (
                                    <span className="px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase text-moon-grey/70 bg-white/5 border border-white/10">
                                      {market.category}
                                    </span>
                                  ) : (
                                    <span className="text-moon-grey/40 text-sm">
                                      No categories
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Description */}
                            {market.market_description && (
                              <div className="py-4 border-t border-white/5">
                                <h4 className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium mb-2">
                                  Description
                                </h4>
                                <p className="text-sm text-moon-grey/70 leading-relaxed line-clamp-3">
                                  {market.market_description}
                                </p>
                              </div>
                            )}

                            {/* Options */}
                            <div className="py-4 border-t border-white/5">
                              <h4 className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium mb-3">
                                Options ({market.options?.length || 0})
                              </h4>
                              <div className="space-y-2">
                                {market.options?.map((option: any) => (
                                  <div
                                    key={option.id}
                                    className="flex items-center justify-between p-3 bg-ink-black/50 border border-white/5 rounded"
                                  >
                                    <div className="flex items-center gap-3">
                                      {option.option_image_url && (
                                        <img
                                          src={option.option_image_url}
                                          alt=""
                                          className="w-8 h-8 rounded object-cover"
                                        />
                                      )}
                                      <div>
                                        <span className="text-sm text-white font-light">
                                          {option.option_label ||
                                            option.text ||
                                            option.label ||
                                            "Option"}
                                        </span>
                                        {option.option_sub_label && (
                                          <span className="text-xs text-moon-grey/40 ml-2">
                                            {option.option_sub_label}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <div className="text-[10px] text-moon-grey/40 uppercase">
                                          Volume
                                        </div>
                                        <div className="text-xs text-white font-light tabular-nums">
                                          {formatUSDC(option.total_volume || 0)}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-[10px] text-moon-grey/40 uppercase">
                                          Yes/No
                                        </div>
                                        <div className="text-xs text-white font-light tabular-nums">
                                          {(
                                            (option.yes_price || 0.5) * 100
                                          ).toFixed(0)}
                                          % /{" "}
                                          {(
                                            (option.no_price || 0.5) * 100
                                          ).toFixed(0)}
                                          %
                                        </div>
                                      </div>
                                      {option.is_resolved ? (
                                        <span className="px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase text-aqua-pulse border border-aqua-pulse/30 bg-aqua-pulse/10">
                                          {option.winning_side === 1
                                            ? "YES Won"
                                            : option.winning_side === 2
                                            ? "NO Won"
                                            : "Resolved"}
                                        </span>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openResolveModal(market, option);
                                          }}
                                          disabled={
                                            resolvingMarketId === market.id
                                          }
                                          className="px-3 py-1.5 text-[10px] tracking-[0.1em] uppercase font-medium text-neon-iris border border-neon-iris/30 hover:bg-neon-iris/10 disabled:opacity-50 transition-all"
                                        >
                                          Resolve
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-3 pt-4 border-t border-white/5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFeatured(market);
                                }}
                                className={`px-4 py-2 text-xs tracking-wide uppercase font-medium border transition-all duration-300 ${
                                  (market as any).is_featured
                                    ? "text-amber-400 border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20"
                                    : "text-moon-grey/60 border-white/10 hover:border-amber-400/30 hover:text-amber-400"
                                }`}
                              >
                                {(market as any).is_featured
                                  ? "★ Featured"
                                  : "☆ Feature"}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleVerified(market);
                                }}
                                className={`px-4 py-2 text-xs tracking-wide uppercase font-medium border transition-all duration-300 ${
                                  (market as any).is_verified
                                    ? "text-neon-iris border-neon-iris/30 bg-neon-iris/10 hover:bg-neon-iris/20"
                                    : "text-moon-grey/60 border-white/10 hover:border-neon-iris/30 hover:text-neon-iris"
                                }`}
                              >
                                {(market as any).is_verified
                                  ? "✓ Verified"
                                  : "○ Verify"}
                              </button>
                              <Link
                                to={`/market/${market.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="px-4 py-2 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300"
                              >
                                View Market →
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-graphite-deep/30 border border-white/5 py-16 text-center"
              >
                <div className="text-moon-grey/40 text-sm mb-2">
                  No markets found
                </div>
                <div className="text-moon-grey/30 text-xs">
                  Try adjusting your filters or search query
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-between items-center mt-6 p-4 bg-graphite-deep/20 border border-white/5"
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-4 py-2 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300 disabled:opacity-30"
            >
              ← Previous
            </button>
            <div className="flex items-center gap-2">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={i}
                    onClick={() => setPage(pageNum)}
                    disabled={loading}
                    className={`w-8 h-8 text-xs font-medium transition-all duration-300 ${
                      page === pageNum
                        ? "bg-gradient-to-r from-neon-iris to-aqua-pulse text-white"
                        : "text-moon-grey/50 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && page < totalPages - 2 && (
                <>
                  <span className="text-moon-grey/30">...</span>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={loading}
                    className="w-8 h-8 text-xs font-medium text-moon-grey/50 hover:text-white hover:bg-white/5 transition-all duration-300"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="px-4 py-2 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300 disabled:opacity-30"
            >
              Next →
            </button>
          </motion.div>
        )}

        {/* Resolve Modal */}
        {showResolveModal && selectedMarket && selectedOption && (
          <div
            className="fixed inset-0 bg-ink-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowResolveModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-graphite-deep border border-white/5 max-w-md w-full p-6"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />

              <h2 className="text-xl font-light text-white mb-6">
                Resolve Market Option
              </h2>
              <div className="mb-6 space-y-3">
                <div>
                  <span className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/40">
                    Market
                  </span>
                  <p className="text-sm text-white font-light mt-1 line-clamp-2">
                    {selectedMarket.question}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/40">
                    Option
                  </span>
                  <p className="text-sm text-white font-light mt-1">
                    {selectedOption.option_label ||
                      selectedOption.text ||
                      selectedOption.label ||
                      "Option"}
                  </p>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-3">
                  Winning Side
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWinningSide(1)}
                    className={`flex-1 py-3 text-sm font-medium border transition-all duration-300 ${
                      winningSide === 1
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-white/5 text-moon-grey/60 border-white/10 hover:border-white/20"
                    }`}
                  >
                    YES
                  </button>
                  <button
                    onClick={() => setWinningSide(2)}
                    className={`flex-1 py-3 text-sm font-medium border transition-all duration-300 ${
                      winningSide === 2
                        ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                        : "bg-white/5 text-moon-grey/60 border-white/10 hover:border-white/20"
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-3">
                  Reason (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-ink-black border border-white/10 px-4 py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors resize-none"
                  rows={3}
                  placeholder="Reason for resolution..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowResolveModal(false);
                    setSelectedMarket(null);
                    setSelectedOption(null);
                    setReason("");
                  }}
                  className="flex-1 py-3 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={resolvingMarketId === selectedMarket.id}
                  className="flex-1 py-3 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
                >
                  {resolvingMarketId === selectedMarket.id
                    ? "Resolving..."
                    : "Confirm Resolution"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
