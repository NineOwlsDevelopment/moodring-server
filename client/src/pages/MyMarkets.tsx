import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import {
  fetchMyMarkets,
  MyMarketsResponse,
  MyMarketStatus,
  withdrawCreatorFee,
} from "@/api/api";
import { formatUSDC, capitalizeWords } from "@/utils/format";
import { toast } from "sonner";

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
  options: any[];
  categories: { id: string; name: string }[];
  created_at: string;
}

const STATUS_CONFIG: Record<
  MyMarketStatus,
  { label: string; color: string; bgColor: string }
> = {
  all: { label: "All", color: "text-gray-300", bgColor: "bg-dark-700" },
  pending: {
    label: "Pending Setup",
    color: "text-warning-400",
    bgColor: "bg-warning-500/20",
  },
  active: {
    label: "Active",
    color: "text-success-400",
    bgColor: "bg-success-500/20",
  },
  resolved: {
    label: "Resolved",
    color: "text-primary-400",
    bgColor: "bg-primary-500/20",
  },
  expired: {
    label: "Expired",
    color: "text-danger-400",
    bgColor: "bg-danger-500/20",
  },
};

export const MyMarkets = () => {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [status, setStatus] = useState<MyMarketStatus>("all");
  const [data, setData] = useState<MyMarketsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [withdrawingFees, setWithdrawingFees] = useState<string | null>(null);

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

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="text-6xl mb-4">📊</div>
        <h1 className="text-3xl font-bold text-white mb-4">My Markets</h1>
        <p className="text-gray-400">
          Connect your wallet to view your created markets
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white">My Markets</h1>
          <p className="text-gray-400 mt-1">
            Manage and monitor the markets you've created
          </p>
        </div>
        <Link to="/create" className="btn btn-primary">
          <svg
            className="w-5 h-5 mr-2"
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {(["all", "pending", "active", "resolved", "expired"] as const).map(
            (statusKey) => {
              const config = STATUS_CONFIG[statusKey];
              const count =
                statusKey === "all"
                  ? data.statusCounts.total
                  : data.statusCounts[statusKey];

              return (
                <button
                  key={statusKey}
                  onClick={() => setStatus(statusKey)}
                  className={`card transition-all ${
                    status === statusKey
                      ? "ring-2 ring-primary-500 bg-primary-500/10"
                      : "hover:bg-dark-800"
                  }`}
                >
                  <div className={`text-sm ${config.color} font-medium mb-1`}>
                    {config.label}
                  </div>
                  <div className="text-3xl font-bold text-white">{count}</div>
                </button>
              );
            }
          )}
        </div>
      )}

      {/* Markets List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-32 animate-pulse bg-dark-800" />
          ))}
        </div>
      ) : !data || data.markets.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {status === "all"
              ? "No markets yet"
              : `No ${STATUS_CONFIG[status].label.toLowerCase()} markets`}
          </h2>
          <p className="text-gray-400 mb-6">
            {status === "all"
              ? "Create your first prediction market to get started"
              : `You don't have any markets with this status`}
          </p>
          {status === "all" && (
            <Link to="/create" className="btn btn-primary">
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
                className="card border border-dark-700 hover:border-dark-600 transition-all"
              >
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Market Image */}
                  <div className="flex-shrink-0">
                    <img
                      src={market.image_url || "/placeholder-market.png"}
                      alt={capitalizeWords(market.question)}
                      width={128}
                      height={128}
                      loading="lazy"
                      className="w-full lg:w-32 h-32 object-cover rounded-lg bg-dark-800 max-w-full max-h-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://placehold.co/128x128/1a1a2e/6366f1?text=?";
                      }}
                    />
                  </div>

                  {/* Market Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                      {market.categories?.map((cat) => (
                        <span
                          key={cat.id}
                          className="px-2 py-1 bg-dark-700 text-gray-400 rounded-full text-xs"
                        >
                          {cat.name}
                        </span>
                      ))}
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                      {capitalizeWords(market.question)}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
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
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {formatExpiration(market.expiration_timestamp)}
                      </span>
                      <span>{market.total_options} options</span>
                      {market.is_initialized && (
                        <>
                          <span>Volume: {formatUSDC(market.total_volume)}</span>
                          <span>
                            Liquidity:{" "}
                            {formatUSDC(market.shared_pool_liquidity)}
                          </span>
                          {market.creator_fees_collected > 0 && (
                            <span className="text-success-400">
                              Fees: {formatUSDC(market.creator_fees_collected)}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Pending Market Actions */}
                    {isPending && (
                      <div className="mt-4 p-4 bg-warning-500/10 border border-warning-500/30 rounded-lg">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="flex-1">
                            <p className="text-warning-300 text-sm font-medium mb-1">
                              Setup Required
                            </p>
                            <p className="text-gray-400 text-sm">
                              {market.total_options === 0
                                ? "Add options to your market, then add liquidity to start trading."
                                : market.total_options < 2
                                ? "Add at least 2 options, then add liquidity to start trading."
                                : "Add initial liquidity to activate trading on this market."}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              navigate(`/create?market=${market.id}`)
                            }
                            className="btn btn-primary whitespace-nowrap"
                          >
                            <svg
                              className="w-4 h-4 mr-2"
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
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex lg:flex-col gap-2 flex-shrink-0">
                    <Link
                      to={`/market/${market.id}`}
                      className="btn btn-secondary flex-1 lg:flex-none"
                    >
                      <svg
                        className="w-4 h-4 mr-1"
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
                      View
                    </Link>
                    {marketStatus === "expired" && !market.is_resolved && (
                      <button
                        onClick={() => navigate(`/market/${market.id}`)}
                        className="btn bg-primary-600 hover:bg-primary-700 text-white flex-1 lg:flex-none"
                      >
                        <svg
                          className="w-4 h-4 mr-1"
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
                        Resolve
                      </button>
                    )}
                    {market.creator_fees_collected > 0 && (
                      <button
                        onClick={() => handleWithdrawFees(market.id)}
                        disabled={withdrawingFees === market.id}
                        className="btn bg-success-600 hover:bg-success-700 text-white flex-1 lg:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg
                          className="w-4 h-4 mr-1"
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
                        {withdrawingFees === market.id
                          ? "Withdrawing..."
                          : "Withdraw Fees"}
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
          {Array.from({ length: data.pagination.totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => {
                // Would need to add page state and reload
              }}
              className={`w-10 h-10 rounded-lg font-medium ${
                data.pagination.page === i + 1
                  ? "bg-primary-600 text-white"
                  : "bg-dark-800 text-gray-400 hover:text-white"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
