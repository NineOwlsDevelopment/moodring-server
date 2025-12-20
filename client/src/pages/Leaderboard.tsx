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

const podiumHeights = ["h-48", "h-40", "h-44"];
const podiumGradients = [
  "from-amber-500/20 via-amber-400/10 to-transparent",
  "from-gray-400/20 via-gray-300/10 to-transparent",
  "from-amber-700/20 via-amber-600/10 to-transparent",
];
const avatarGradients = [
  "from-amber-400 via-amber-500 to-amber-600",
  "from-gray-300 via-gray-400 to-gray-500",
  "from-amber-600 via-amber-700 to-amber-800",
];
const avatarRings = [
  "ring-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.4)]",
  "ring-gray-400/50 shadow-[0_0_20px_rgba(156,163,175,0.3)]",
  "ring-amber-700/50 shadow-[0_0_20px_rgba(180,83,9,0.3)]",
];

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

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <span className="text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    return (
      <span className="text-sm font-bold text-gray-400 tabular-nums">
        #{rank}
      </span>
    );
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1)
      return "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-2 border-amber-500/50";
    if (rank === 2)
      return "bg-gradient-to-r from-gray-400/10 via-gray-400/5 to-transparent border-l-2 border-gray-400/50";
    if (rank === 3)
      return "bg-gradient-to-r from-amber-700/10 via-amber-700/5 to-transparent border-l-2 border-amber-700/50";
    return "";
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

  const renderPodiumCard = (entry: LeaderboardEntry, index: number) => {
    const isFirst = index === 0;
    const order = index === 1 ? 0 : index === 0 ? 1 : 2; // 2nd, 1st, 3rd for visual

    return (
      <div
        key={entry.user_id}
        className={`relative flex flex-col items-center transition-all duration-500 ${
          isFirst
            ? "md:order-2 z-10"
            : index === 1
            ? "md:order-1"
            : "md:order-3"
        }`}
        style={{
          animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
        }}
      >
        {/* Podium Base */}
        <div
          onClick={() => navigate(`/profile/${entry.user_id}`)}
          className={`relative w-full ${
            podiumHeights[order]
          } rounded-t-2xl bg-gradient-to-b ${
            podiumGradients[order]
          } border border-white/5 backdrop-blur-sm overflow-hidden group hover:border-white/10 transition-all duration-300 cursor-pointer ${
            isFirst ? "shadow-2xl shadow-amber-500/20" : "shadow-lg"
          }`}
        >
          {/* Animated background glow */}
          <div
            className={`absolute inset-0 bg-gradient-to-t ${
              isFirst
                ? "from-amber-500/10 via-transparent to-transparent"
                : order === 0
                ? "from-gray-400/10 via-transparent to-transparent"
                : "from-amber-700/10 via-transparent to-transparent"
            } opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
          />

          {/* Content */}
          <div className="relative h-full flex flex-col items-center justify-end pb-6 px-4">
            {/* Avatar */}
            <div
              className={`relative mb-4 transition-transform duration-300 group-hover:scale-110 ${
                isFirst ? "scale-110" : ""
              }`}
            >
              <div
                className={`w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br ${avatarGradients[order]} flex items-center justify-center text-3xl md:text-4xl font-black text-white shadow-xl ${avatarRings[order]} ring-4 ring-offset-4 ring-offset-dark-900 transition-all duration-300`}
              >
                {entry.display_name?.charAt(0).toUpperCase() || "U"}
              </div>
              {/* Crown for first place */}
              {isFirst && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-3xl animate-bounce">
                  👑
                </div>
              )}
            </div>

            {/* Medal */}
            <div className="text-4xl md:text-5xl mb-2 drop-shadow-lg">
              {["🥈", "🥇", "🥉"][order]}
            </div>

            {/* Name */}
            <h3 className="font-bold text-white text-lg md:text-xl mb-2 truncate max-w-full px-2">
              {entry.display_name || entry.username}
            </h3>

            {/* Value */}
            <div
              className={`text-2xl md:text-3xl font-black mb-2 ${
                metric === "profit"
                  ? entry.total_pnl >= 0
                    ? "text-success-400"
                    : "text-danger-400"
                  : "text-primary-200"
              }`}
            >
              {formatMetricValue(
                metric === "profit" ? entry.total_pnl : entry.total_volume ?? 0
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs md:text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <span className="text-success-400">✓</span>
                {entry.win_rate?.toFixed(0)}%
              </span>
              <span className="text-gray-600">•</span>
              <span>{formatNumber(entry.total_trades)} trades</span>
            </div>
          </div>
        </div>

        {/* Rank badge */}
        <div
          className={`absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradients[order]} flex items-center justify-center text-white font-black text-lg shadow-lg border-4 border-dark-900`}
        >
          {order + 1}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .shimmer {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.05) 50%,
            rgba(255,255,255,0) 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Hero Section */}
        <section className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-aqua-500/5 rounded-3xl blur-3xl" />
          <div className="relative bg-gradient-to-br from-dark-800/80 via-dark-800/60 to-dark-900/80 backdrop-blur-xl rounded-3xl border border-primary-500/20 p-8 md:p-12 shadow-2xl">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(124,77,255,0.3),transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(33,246,210,0.3),transparent_50%)]" />
            </div>

            <div className="relative z-10 space-y-8">
              {/* Header */}
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20">
                  <span className="text-primary-200 text-xs font-semibold uppercase tracking-wider">
                    🏆 Community Rankings
                  </span>
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-primary-200 to-aqua-200 leading-tight">
                  Leaderboard
                </h1>
                <p className="text-lg text-gray-300 max-w-2xl leading-relaxed">
                  Compete with the best traders on MoodRing. Track your
                  performance and climb the ranks to become a top trader.
                </p>
              </div>

              {/* Metric Toggle */}
              <div className="flex flex-wrap items-center gap-4">
                {(Object.keys(metricCopy) as Metric[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`group relative flex items-center gap-4 rounded-2xl border-2 px-6 py-4 text-left transition-all duration-300 overflow-hidden ${
                      metric === m
                        ? "border-primary-500 bg-primary-500/20 shadow-xl shadow-primary-500/30 scale-105"
                        : "border-dark-700 bg-dark-800/50 hover:border-primary-500/50 hover:bg-dark-800/80 hover:scale-102"
                    }`}
                  >
                    {metric === m && (
                      <div className="absolute inset-0 shimmer opacity-30" />
                    )}
                    <div
                      className={`h-14 w-14 rounded-xl bg-gradient-to-br from-primary-500 to-aqua-500 flex items-center justify-center text-2xl transition-transform duration-300 ${
                        metric === m
                          ? "scale-110 shadow-lg shadow-primary-500/50"
                          : "opacity-70 group-hover:opacity-100"
                      }`}
                    >
                      {metricCopy[m].icon}
                    </div>
                    <div>
                      <p
                        className={`text-base font-bold transition-colors ${
                          metric === m ? "text-white" : "text-gray-300"
                        }`}
                      >
                        {metricCopy[m].label} Leaders
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {metricCopy[m].description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Current User Badge */}
              {currentUserEntry && (
                <div className="relative overflow-hidden rounded-2xl border-2 border-primary-500/40 bg-gradient-to-r from-primary-500/20 via-primary-500/10 to-transparent p-5 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-transparent opacity-50" />
                  <div className="relative flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-aqua-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary-500/50 ring-2 ring-primary-500/50">
                        {currentUserEntry.display_name
                          ?.charAt(0)
                          .toUpperCase() || "U"}
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-xs font-black text-white border-2 border-dark-900">
                        {currentUserEntry.rank}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-lg mb-1">
                        You&apos;re ranked #{currentUserEntry.rank}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <span className="font-semibold">
                          {formatMetricValue(
                            metric === "profit"
                              ? currentUserEntry.total_pnl
                              : currentUserEntry.total_volume ?? 0
                          )}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span>
                          {currentUserEntry.win_rate?.toFixed(0)}% win rate
                        </span>
                        <span className="text-gray-600">•</span>
                        <span>
                          {formatNumber(currentUserEntry.total_trades)} trades
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Error State */}
        {error && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-danger-500/40 bg-gradient-to-r from-danger-900/40 via-danger-900/20 to-transparent p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <p className="font-bold text-danger-100 text-lg mb-1">
                  Failed to load leaderboard
                </p>
                <p className="text-sm text-danger-200/80">{error}</p>
              </div>
              <button
                onClick={loadLeaderboard}
                className="px-6 py-3 rounded-xl bg-danger-500 text-white font-bold hover:bg-danger-400 transition-all duration-200 shadow-lg shadow-danger-500/30 hover:shadow-xl hover:shadow-danger-500/40 hover:scale-105 active:scale-95"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Podium Section */}
        {topEntries.length > 0 && !isLoading && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-bold mb-2">
                  Top Performers
                </p>
                <h2 className="text-3xl md:text-4xl font-black text-white">
                  Podium Winners
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {topEntries.map((entry, index) => renderPodiumCard(entry, index))}
            </div>
          </section>
        )}

        {/* Loading Podium Skeletons */}
        {isLoading && topEntries.length === 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-bold mb-2">
                  Top Performers
                </p>
                <h2 className="text-3xl md:text-4xl font-black text-white">
                  Podium Winners
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className={`relative ${podiumHeights[idx]} rounded-t-2xl bg-dark-800/60 border border-dark-700 animate-pulse`}
                >
                  <div className="absolute inset-0 shimmer" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Full Leaderboard Table */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-bold mb-2">
                Complete Rankings
              </p>
              <h2 className="text-2xl md:text-3xl font-black text-white">
                All Traders
              </h2>
            </div>
            <div className="text-sm text-gray-400 font-medium">
              {leaderboard.length ? (
                <span className="text-primary-200 font-bold">
                  {leaderboard.length}
                </span>
              ) : (
                ""
              )}{" "}
              {leaderboard.length === 1 ? "trader" : "traders"} ranked
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-800/40 backdrop-blur-xl">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 animate-pulse"
                  >
                    <div className="w-12 h-12 bg-dark-700 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 bg-dark-700 rounded" />
                      <div className="h-3 w-32 bg-dark-700 rounded" />
                    </div>
                    <div className="h-4 w-24 bg-dark-700 rounded" />
                  </div>
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-6xl mb-4">🏁</div>
                <p className="text-xl font-semibold text-gray-300 mb-2">
                  No traders yet
                </p>
                <p className="text-gray-500">
                  Be the first to appear on the leaderboard!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-dark-700/50">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-dark-900/50 border-b border-dark-700/50">
                  <div className="col-span-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Rank
                  </div>
                  <div className="col-span-5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Trader
                  </div>
                  <div className="col-span-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {metricCopy[metric].valueLabel}
                  </div>
                  <div className="col-span-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Win Rate
                  </div>
                  <div className="col-span-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Trades
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-dark-700/30">
                  {leaderboard.map((entry, idx) => {
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
                        className={`group grid grid-cols-12 gap-4 px-6 py-4 items-center transition-all duration-200 cursor-pointer ${
                          isCurrentUser
                            ? "bg-gradient-to-r from-primary-500/20 via-primary-500/10 to-transparent border-l-4 border-primary-500"
                            : getRankStyle(entry.rank)
                        } ${
                          !isCurrentUser && !isTopThree
                            ? "hover:bg-dark-800/60 hover:border-l-2 hover:border-primary-500/30"
                            : ""
                        }`}
                        style={{
                          animation: `fadeInUp 0.4s ease-out ${Math.min(
                            idx * 0.02,
                            1
                          )}s both`,
                        }}
                      >
                        {/* Rank */}
                        <div className="col-span-1 flex items-center">
                          {getRankDisplay(entry.rank)}
                        </div>

                        {/* Trader Info */}
                        <div className="col-span-5 flex items-center gap-3 min-w-0">
                          <div
                            className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${
                              isTopThree
                                ? avatarGradients[entry.rank - 1]
                                : "from-primary-500 to-aqua-500"
                            } flex items-center justify-center text-white font-black text-lg shadow-lg flex-shrink-0 ring-2 ${
                              isTopThree
                                ? avatarRings[entry.rank - 1]
                                : "ring-primary-500/30"
                            } transition-transform duration-200 group-hover:scale-110`}
                          >
                            {entry.display_name?.charAt(0).toUpperCase() || "U"}
                            {isCurrentUser && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary-500 border-2 border-dark-900 flex items-center justify-center">
                                <span className="text-[10px]">✓</span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white truncate text-base">
                              {entry.display_name || entry.username}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-primary-300">
                                  (You)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              @{entry.username}
                            </p>
                          </div>
                        </div>

                        {/* Metric Value */}
                        <div className="col-span-2 text-right">
                          <span
                            className={`text-lg font-black ${
                              metric === "profit"
                                ? metricValue >= 0
                                  ? "text-success-400"
                                  : "text-danger-400"
                                : "text-primary-200"
                            }`}
                          >
                            {metric === "profit" && metricValue >= 0 ? "+" : ""}
                            {formatUSDC(metricValue)}
                          </span>
                        </div>

                        {/* Win Rate */}
                        <div className="col-span-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-gray-300 font-semibold">
                              {entry.win_rate?.toFixed(0)}%
                            </span>
                            <div className="w-16 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-success-400 to-success-500 rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(
                                    entry.win_rate || 0,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Trades */}
                        <div className="col-span-2 text-right">
                          <span className="text-gray-400 font-semibold">
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
        </section>
      </div>
    </div>
  );
};
