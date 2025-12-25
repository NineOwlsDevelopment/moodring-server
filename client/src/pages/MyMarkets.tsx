import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import {
  fetchMyMarkets,
  MyMarketsResponse,
  MyMarketStatus,
  withdrawCreatorFee,
  deleteMarket,
} from "@/api/api";
import { formatUSDC } from "@/utils/format";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface MarketWithDetails {
  id: string;
  question: string;
  market_description: string;
  image_url: string;
  expiration_timestamp: number;
  is_initialized: boolean;
  is_resolved: boolean;
  total_volume: number;
  total_options: number;
  shared_pool_liquidity: number;
  creator_fees_collected: number;
  lifetime_creator_fees_generated?: number;
  options: any[];
  categories: { id: string; name: string }[];
  created_at: string;
}

const STATUS_CONFIG: Record<
  MyMarketStatus,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  all: {
    label: "All",
    color: "text-moon-grey",
    bgColor: "bg-graphite-deep",
    borderColor: "border-white/10",
  },
  pending: {
    label: "Pending Setup",
    color: "text-brand-warning",
    bgColor: "bg-brand-warning/15",
    borderColor: "border-brand-warning/25",
  },
  active: {
    label: "Active",
    color: "text-aqua-pulse",
    bgColor: "bg-aqua-pulse/15",
    borderColor: "border-aqua-pulse/25",
  },
  resolved: {
    label: "Resolved",
    color: "text-neon-iris-light",
    bgColor: "bg-neon-iris/15",
    borderColor: "border-neon-iris/25",
  },
  expired: {
    label: "Expired",
    color: "text-brand-danger",
    bgColor: "bg-brand-danger/15",
    borderColor: "border-brand-danger/25",
  },
};

export const MyMarkets = () => {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [status, setStatus] = useState<MyMarketStatus>("all");
  const [data, setData] = useState<MyMarketsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [withdrawingFees, setWithdrawingFees] = useState<string | null>(null);
  const [deletingMarket, setDeletingMarket] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [marketToDelete, setMarketToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadMarkets();
    }
  }, [user, status]);

  const loadMarkets = async () => {
    setIsLoading(true);
    try {
      const response = await fetchMyMarkets({ status });
      setData(response);
    } catch (error) {
      console.error("Failed to load markets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMarketStatus = (market: MarketWithDetails): MyMarketStatus => {
    if (!market.is_initialized) return "pending";
    if (market.is_resolved) return "resolved";
    if (market.expiration_timestamp <= Math.floor(Date.now() / 1000))
      return "expired";
    return "active";
  };

  const formatExpiration = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) {
      return `Expired ${Math.abs(
        Math.floor(diff / (1000 * 60 * 60 * 24))
      )}d ago`;
    }

    if (diff < 1000 * 60 * 60 * 24) {
      return `${Math.floor(diff / (1000 * 60 * 60))}h remaining`;
    }

    return `${Math.floor(diff / (1000 * 60 * 60 * 24))}d remaining`;
  };

  const handleWithdrawFees = async (marketId: string) => {
    if (withdrawingFees === marketId) return;

    setWithdrawingFees(marketId);
    try {
      const result = await withdrawCreatorFee(marketId);
      const amount = result.amount;

      // Balance will be updated via websocket (authoritative source)
      // The websocket handler in Navbar will update the balance automatically

      toast.success(
        `Successfully withdrew ${formatUSDC(amount)} in creator fees!`
      );

      // Reload markets to update the UI
      await loadMarkets();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          "Failed to withdraw fees. Please try again."
      );
    } finally {
      setWithdrawingFees(null);
    }
  };

  const handleDeleteClick = (marketId: string) => {
    setMarketToDelete(marketId);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!marketToDelete) return;

    setDeletingMarket(marketToDelete);
    setShowDeleteModal(false);
    try {
      await deleteMarket(marketToDelete);
      toast.success("Market deleted successfully");
      await loadMarkets();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          "Failed to delete market. Please try again."
      );
    } finally {
      setDeletingMarket(null);
      setMarketToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setMarketToDelete(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-ink-black">
        <div className="section-container py-20 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-graphite-deep border border-white/10 mb-6">
            <svg
              className="w-10 h-10 text-neon-iris"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">My Markets</h1>
          <p className="text-moon-grey">
            Connect your wallet to view your created markets
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-black">
      <div className="section-container py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                My Markets
              </h1>
              <p className="text-moon-grey-dark">
                Manage and monitor the markets you've created
              </p>
            </div>
            <Link
              to="/create"
              className="btn btn-secondary"
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
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Market
            </Link>
          </div>

          {/* Status Summary Cards */}
          {data?.statusCounts && (
            <div className="flex flex-wrap gap-3">
              {(["all", "pending", "active", "resolved", "expired"] as const).map(
                (statusKey) => {
                  const config = STATUS_CONFIG[statusKey];
                  const count =
                    statusKey === "all"
                      ? data.statusCounts.total
                      : data.statusCounts[statusKey];
                  const isActive = status === statusKey;

                  return (
                    <button
                      key={statusKey}
                      onClick={() => setStatus(statusKey)}
                      className={`px-4 py-2.5 rounded-xl transition-all duration-200 border ${
                        isActive
                          ? `${config.bgColor} ${config.borderColor} ${config.color}`
                          : "bg-graphite-deep border-white/10 text-moon-grey hover:border-white/20 hover:bg-graphite-hover"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-medium">
                          {config.label}
                        </span>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            isActive ? config.color : "text-white"
                          }`}
                        >
                          {count}
                        </span>
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* Markets List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="card h-40 animate-pulse bg-graphite-deep/50"
              />
            ))}
          </div>
        ) : !data || data.markets.length === 0 ? (
          <div className="card text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-graphite-deep border border-white/10 mb-4">
              <svg
                className="w-8 h-8 text-moon-grey-dark"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              {status === "all"
                ? "No markets yet"
                : `No ${STATUS_CONFIG[status].label.toLowerCase()} markets`}
            </h2>
            <p className="text-moon-grey-dark mb-6">
              {status === "all"
                ? "Create your first prediction market to get started"
                : `You don't have any markets with this status`}
            </p>
            {status === "all" && (
              <Link to="/create" className="btn btn-secondary">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Your First Market
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {data.markets.map((market: MarketWithDetails) => {
              const marketStatus = getMarketStatus(market);
              const statusConfig = STATUS_CONFIG[marketStatus];
              const isPending = marketStatus === "pending";

              return (
                <div
                  key={market.id}
                  className="group relative card-hover overflow-hidden"
                >
                  {/* Gradient accent on hover */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-brand opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none" />

                  <div className="relative flex flex-col lg:flex-row gap-5">
                    {/* Market Image */}
                    <Link
                      to={`/market/${market.id}`}
                      className="flex-shrink-0 group/image"
                    >
                      <div className="relative overflow-hidden rounded-xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-neon-iris/20 to-aqua-pulse/20 opacity-0 group-hover/image:opacity-60 transition-opacity duration-300 blur-sm" />
                        <img
                          src={market.image_url || "/placeholder-market.png"}
                          alt={market.question}
                          width={120}
                          height={120}
                          loading="lazy"
                          className="relative w-full lg:w-28 h-28 object-cover bg-graphite-deep border-2 border-white/10 group-hover/image:border-neon-iris/30 transition-all duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://placehold.co/120x120/1a1a2e/6366f1?text=?";
                          }}
                        />
                      </div>
                    </Link>

                    {/* Market Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span
                          className={`badge ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}
                        >
                          {statusConfig.label}
                        </span>
                        {market.categories?.map((cat) => (
                          <span
                            key={cat.id}
                            className="badge badge-neutral"
                          >
                            {cat.name}
                          </span>
                        ))}
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-3 line-clamp-2 group-hover:text-gradient transition-all">
                        {market.question}
                      </h3>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm mb-4">
                        <div className="flex items-center gap-2 text-moon-grey">
                          <svg
                            className="w-4 h-4 flex-shrink-0 text-moon-grey-dark"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="truncate text-white tabular-nums">
                            {formatExpiration(market.expiration_timestamp)}
                          </span>
                        </div>
                        <div className="text-moon-grey">
                          <span className="text-moon-grey-dark">Options:</span>{" "}
                          <span className="text-white font-medium tabular-nums">
                            {market.total_options}
                          </span>
                        </div>
                        {market.is_initialized && (
                          <>
                            <div className="text-moon-grey">
                              <span className="text-moon-grey-dark">Volume:</span>{" "}
                              <span className="text-white font-medium tabular-nums">
                                {formatUSDC(market.total_volume)}
                              </span>
                            </div>
                            <div className="text-moon-grey">
                              <span className="text-moon-grey-dark">Liquidity:</span>{" "}
                              <span className="text-white font-medium tabular-nums">
                                {formatUSDC(market.shared_pool_liquidity)}
                              </span>
                            </div>
                            {market.creator_fees_collected > 0 && (
                              <div className="text-aqua-pulse">
                                <span className="text-moon-grey-dark">Fees:</span>{" "}
                                <span className="font-semibold tabular-nums">
                                  {formatUSDC(market.creator_fees_collected)}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Pending Market Actions */}
                      {isPending && (
                        <div className="mt-4 p-4 bg-brand-warning/10 border border-brand-warning/25 rounded-xl">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-brand-warning text-sm font-semibold mb-1.5">
                                Setup Required
                              </p>
                              <p className="text-moon-grey text-sm leading-relaxed">
                                {market.total_options === 0
                                  ? "Add options to your market, then add liquidity to start trading."
                                  : market.total_options < 2
                                  ? "Add at least 2 options, then add liquidity to start trading."
                                  : "Add initial liquidity to activate trading on this market."}
                              </p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button
                                onClick={() =>
                                  navigate(`/create?market=${market.id}`)
                                }
                                className="btn btn-secondary flex-1 sm:flex-none"
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
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Continue Setup
                              </button>
                              <button
                                onClick={() => handleDeleteClick(market.id)}
                                disabled={deletingMarket === market.id}
                                className="btn btn-secondary flex-1 sm:flex-none border-brand-danger/20 text-brand-danger hover:bg-brand-danger/5 hover:border-brand-danger/30 disabled:opacity-50"
                              >
                                {deletingMarket === market.id ? (
                                  <>
                                    <svg
                                      className="animate-spin w-4 h-4"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                    >
                                      <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                      />
                                      <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                      />
                                    </svg>
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                    Delete
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-row lg:flex-col gap-2 flex-shrink-0 lg:w-32">
                      <Link
                        to={`/market/${market.id}`}
                        className="btn btn-secondary flex-1 lg:flex-none"
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
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        <span className="hidden sm:inline">View</span>
                      </Link>
                      {marketStatus === "expired" && !market.is_resolved && (
                        <button
                          onClick={() => navigate(`/market/${market.id}`)}
                          className="btn btn-primary flex-1 lg:flex-none"
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
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="hidden sm:inline">Resolve</span>
                        </button>
                      )}
                      {market.creator_fees_collected > 0 && (
                        <button
                          onClick={() => handleWithdrawFees(market.id)}
                          disabled={withdrawingFees === market.id}
                          className="btn btn-outline border-aqua-pulse/50 text-aqua-pulse hover:bg-aqua-pulse/10 hover:border-aqua-pulse flex-1 lg:flex-none disabled:opacity-50"
                        >
                          {withdrawingFees === market.id ? (
                            <>
                              <svg
                                className="animate-spin w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              <span className="hidden sm:inline">Withdrawing...</span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="hidden sm:inline">Withdraw</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: data.pagination.totalPages }).map((_, i) => {
              const isActive = data.pagination.page === i + 1;
              return (
                <button
                  key={i}
                  onClick={() => {
                    // Would need to add page state and reload
                  }}
                  className={`w-10 h-10 rounded-xl font-semibold text-sm transition-all ${
                    isActive
                      ? "bg-gradient-brand text-white shadow-button-primary hover:shadow-button-primary-hover"
                      : "bg-graphite-deep text-moon-grey border border-white/10 hover:border-white/20 hover:bg-graphite-hover hover:text-white"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          title="Delete Market"
          message="Are you sure you want to delete this market? This action cannot be undone. All options and data associated with this market will be permanently removed."
          confirmText="Delete Market"
          cancelText="Cancel"
          variant="danger"
          isLoading={deletingMarket !== null}
        />
      </div>
    </div>
  );
};
