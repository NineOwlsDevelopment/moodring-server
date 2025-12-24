import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLeaderboard, LeaderboardEntry } from "@/api/api";
import { formatNumber, formatUSDC } from "@/utils/format";
import { useUserStore } from "@/stores/userStore";

type Metric = "profit" | "volume";

const metricCopy: Record<
  Metric,
  { label: string; description: string; valueLabel: string; icon: string }
> = {
  profit: {
    label: "P&L",
    description: "Top traders by realized profit & loss",
    valueLabel: "P&L",
    icon: "💰",
  },
  volume: {
    label: "Volume",
    description: "Most active traders by total volume",
    valueLabel: "Volume",
    icon: "📊",
  },
};

export const Leaderboard = () => {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>("profit");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [metric]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { leaderboard: data } = await fetchLeaderboard({
        metric,
        limit: 100,
      });
      setLeaderboard(data);
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
      setError("Unable to load the leaderboard right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const topEntries = leaderboard.slice(0, 3);
  const currentUserEntry = leaderboard.find(
    (entry) => entry.user_id === user?.id
  );

  const formatMetricValue = (value: number) => {
    if (metric === "profit") {
      return `${value >= 0 ? "+" : ""}${formatUSDC(value)}`;
    }
    return formatUSDC(value);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-8">
      {/* Header - Minimal */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">
          Leaderboard
        </h1>

        {/* Metric Toggle - Clean tabs */}
        <div className="flex items-center gap-2 bg-graphite-deep rounded-xl p-1 border border-graphite-light inline-flex mb-4">
          {(Object.keys(metricCopy) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all ${
                metric === m
                  ? "bg-neon-iris text-white shadow-md shadow-neon-iris/20"
                  : "text-moon-grey hover:text-white hover:bg-graphite-light/50"
              }`}
            >
              {metricCopy[m].label}
            </button>
          ))}
        </div>

        {/* Current User Badge - Compact */}
        {currentUserEntry && (
          <div className="bg-graphite-light rounded-lg p-3 border border-graphite-light mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {currentUserEntry.display_name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">
                  Rank #{currentUserEntry.rank}
                </p>
                <div className="flex items-center gap-2 text-xs text-moon-grey">
                  <span>
                    {formatMetricValue(
                      metric === "profit"
                        ? currentUserEntry.total_pnl
                        : currentUserEntry.total_volume ?? 0
                    )}
                  </span>
                  <span>•</span>
                  <span>{currentUserEntry.win_rate?.toFixed(0)}% win</span>
                  <span>•</span>
                  <span>
                    {formatNumber(currentUserEntry.total_trades)} trades
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-graphite-light rounded-lg p-4 border border-graphite-light mb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="font-semibold text-danger-400 text-sm mb-1">
                Failed to load leaderboard
              </p>
              <p className="text-xs text-moon-grey">{error}</p>
            </div>
            <button
              onClick={loadLeaderboard}
              className="px-4 py-2 rounded-lg bg-danger-500 text-white font-medium text-sm hover:bg-danger-400 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Top 3 - Simplified */}
      {topEntries.length > 0 && !isLoading && (
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white mb-3">Top 3</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topEntries.map((entry, index) => {
              const order = index === 1 ? 0 : index === 0 ? 1 : 2;
              const metricValue =
                metric === "profit" ? entry.total_pnl : entry.total_volume ?? 0;
              return (
                <div
                  key={entry.user_id}
                  onClick={() => navigate(`/profile/${entry.user_id}`)}
                  className="bg-graphite-light rounded-lg p-4 border border-graphite-light hover:border-neon-iris/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {entry.display_name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">
                        {entry.display_name || entry.username}
                      </p>
                      <p className="text-xs text-moon-grey-dark">
                        Rank #{entry.rank}
                      </p>
                    </div>
                    <div className="text-2xl">{["🥈", "🥇", "🥉"][order]}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-moon-grey-dark">
                        {metricCopy[metric].valueLabel}
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          metric === "profit"
                            ? metricValue >= 0
                              ? "text-emerald-400"
                              : "text-danger-400"
                            : "text-neon-iris"
                        }`}
                      >
                        {formatMetricValue(metricValue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-moon-grey-dark">
                        Win Rate
                      </span>
                      <span className="text-xs text-moon-grey">
                        {entry.win_rate?.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && topEntries.length === 0 && (
        <div className="mb-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="bg-graphite-light rounded-lg p-4 border border-graphite-light animate-pulse"
              >
                <div className="h-12 bg-graphite-hover rounded mb-3" />
                <div className="h-4 bg-graphite-hover rounded mb-2" />
                <div className="h-3 bg-graphite-hover rounded w-2/3" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Leaderboard */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">All Traders</h2>

        <div className="bg-graphite-light rounded-lg border border-graphite-light overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 bg-graphite-hover rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-graphite-hover rounded" />
                    <div className="h-2 w-24 bg-graphite-hover rounded" />
                  </div>
                  <div className="h-3 w-20 bg-graphite-hover rounded" />
                </div>
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-moon-grey">No traders yet</p>
            </div>
          ) : (
            <div className="divide-y divide-graphite-hover">
              {/* Header */}
              <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-graphite-deep border-b border-graphite-hover">
                <div className="col-span-1 text-xs font-medium text-moon-grey-dark">
                  Rank
                </div>
                <div className="col-span-5 text-xs font-medium text-moon-grey-dark">
                  Trader
                </div>
                <div className="col-span-2 text-right text-xs font-medium text-moon-grey-dark">
                  {metricCopy[metric].valueLabel}
                </div>
                <div className="col-span-2 text-right text-xs font-medium text-moon-grey-dark">
                  Win Rate
                </div>
                <div className="col-span-2 text-right text-xs font-medium text-moon-grey-dark">
                  Trades
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-graphite-hover">
                {leaderboard.map((entry) => {
                  const metricValue =
                    metric === "profit"
                      ? entry.total_pnl
                      : entry.total_volume ?? 0;
                  const isCurrentUser = user?.id === entry.user_id;
                  const isTopThree = entry.rank <= 3;

                  return (
                    <div
                      key={entry.user_id}
                      onClick={() => navigate(`/profile/${entry.user_id}`)}
                      className={`group grid grid-cols-12 gap-3 px-4 py-3 items-center transition-all cursor-pointer ${
                        isCurrentUser
                          ? "bg-neon-iris/10 border-l-2 border-neon-iris"
                          : "hover:bg-graphite-hover/50"
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-1 flex items-center">
                        {isTopThree ? (
                          <span className="text-sm">
                            {["🥈", "🥇", "🥉"][entry.rank - 1]}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-moon-grey tabular-nums">
                            #{entry.rank}
                          </span>
                        )}
                      </div>

                      {/* Trader Info */}
                      <div className="col-span-5 flex items-center gap-2 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {entry.display_name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white text-sm truncate">
                            {entry.display_name || entry.username}
                            {isCurrentUser && (
                              <span className="ml-1.5 text-xs text-neon-iris">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-moon-grey-dark truncate">
                            @{entry.username}
                          </p>
                        </div>
                      </div>

                      {/* Metric Value */}
                      <div className="col-span-2 text-right">
                        <span
                          className={`text-sm font-bold ${
                            metric === "profit"
                              ? metricValue >= 0
                                ? "text-emerald-400"
                                : "text-danger-400"
                              : "text-neon-iris"
                          }`}
                        >
                          {metric === "profit" && metricValue >= 0 ? "+" : ""}
                          {formatUSDC(metricValue)}
                        </span>
                      </div>

                      {/* Win Rate */}
                      <div className="col-span-2 text-right">
                        <span className="text-sm text-moon-grey font-medium">
                          {entry.win_rate?.toFixed(0)}%
                        </span>
                      </div>

                      {/* Trades */}
                      <div className="col-span-2 text-right">
                        <span className="text-sm text-moon-grey font-medium">
                          {formatNumber(entry.total_trades)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
