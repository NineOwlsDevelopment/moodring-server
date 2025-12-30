import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import {
  fetchPortfolio,
  fetchPositions,
  fetchLiquidityPositions,
  fetchPnLSummary,
  PortfolioSummary,
  Position,
  LiquidityPosition,
  PnLSummary,
} from "@/api/api";
import { formatUSDC, formatProbability, formatShares } from "@/utils/format";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  DollarSign,
} from "lucide-react";

type Tab = "positions" | "liquidity";
type PositionFilter = "open" | "closed" | "all";

export const Portfolio = () => {
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState<Tab>("positions");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("open");
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [liquidityPositions, setLiquidityPositions] = useState<
    LiquidityPosition[]
  >([]);
  const [pnlSummary, setPnlSummary] = useState<PnLSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, positionFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [portfolioData, positionsData, liquidityData, pnlData] =
        await Promise.all([
          fetchPortfolio(),
          fetchPositions({ status: positionFilter }),
          fetchLiquidityPositions(),
          fetchPnLSummary(),
        ]);
      setPortfolio(portfolioData);
      setPositions(positionsData.positions);
      setLiquidityPositions(liquidityData.positions);
      setPnlSummary(pnlData);
    } catch (error) {
      console.error("Failed to load portfolio:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: "positions" as const, label: "Positions", count: positions.length },
    {
      id: "liquidity" as const,
      label: "Liquidity",
      count: liquidityPositions.length,
    },
  ];

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-graphite-light border border-white/10 mb-6">
            <Wallet className="w-8 h-8 text-moon-grey" />
          </div>
          <h1 className="text-3xl font-semibold text-white mb-3">Portfolio</h1>
          <p className="text-moon-grey">
            Connect your wallet to view your portfolio
          </p>
        </div>
      </div>
    );
  }

  const totalPnl = portfolio?.total_pnl || 0;
  const totalPnlPercent = portfolio?.total_pnl_percent || 0;
  const isPositive = totalPnl >= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white mb-2">Portfolio</h1>
        <p className="text-moon-grey text-sm">
          Comprehensive view of your trading positions and performance
        </p>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Value */}
        <div className="bg-graphite-deep border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider">
              Total Value
            </div>
            <DollarSign className="w-4 h-4 text-moon-grey-dark" />
          </div>
          <div className="text-2xl font-semibold text-white mb-1 tabular-nums">
            {formatUSDC(portfolio?.total_value || 0)}
          </div>
          <div className="text-xs text-moon-grey-dark">
            Cash + Positions + Liquidity
          </div>
        </div>

        {/* Cash Balance */}
        <div className="bg-graphite-deep border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider">
              Cash Balance
            </div>
            <Wallet className="w-4 h-4 text-moon-grey-dark" />
          </div>
          <div className="text-2xl font-semibold text-white mb-1 tabular-nums">
            {formatUSDC(user?.wallet?.balance_usdc || 0)}
          </div>
          <div className="text-xs text-moon-grey-dark">Available to trade</div>
        </div>

        {/* Positions Value */}
        <div className="bg-graphite-deep border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider">
              Positions Value
            </div>
            <BarChart3 className="w-4 h-4 text-moon-grey-dark" />
          </div>
          <div className="text-2xl font-semibold text-white mb-1 tabular-nums">
            {formatUSDC(portfolio?.positions_value || 0)}
          </div>
          <div className="text-xs text-moon-grey-dark">
            {positions.length}{" "}
            {positions.length === 1 ? "position" : "positions"}
          </div>
        </div>

        {/* Total P&L */}
        <div className="bg-graphite-deep border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider">
              Total P&L
            </div>
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-aqua-pulse" />
            ) : (
              <TrendingDown className="w-4 h-4 text-danger-400" />
            )}
          </div>
          <div
            className={`text-2xl font-semibold mb-1 tabular-nums ${
              isPositive ? "text-aqua-pulse" : "text-danger-400"
            }`}
          >
            {isPositive ? "+" : ""}
            {formatUSDC(totalPnl)}
          </div>
          <div
            className={`text-xs font-medium ${
              isPositive ? "text-aqua-pulse" : "text-danger-400"
            }`}
          >
            {isPositive ? "+" : ""}
            {totalPnlPercent.toFixed(2)}% all time
          </div>
        </div>
      </div>

      {/* P&L Summary */}
      {pnlSummary && (
        <div className="bg-graphite-deep border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <PieChart className="w-5 h-5 text-moon-grey" />
            <h2 className="text-lg font-semibold text-white">
              Performance Summary
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-2">
                Realized P&L
              </div>
              <div
                className={`text-xl font-semibold tabular-nums ${
                  pnlSummary.realized_pnl >= 0
                    ? "text-aqua-pulse"
                    : "text-danger-400"
                }`}
              >
                {pnlSummary.realized_pnl >= 0 ? "+" : ""}
                {formatUSDC(pnlSummary.realized_pnl)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-2">
                Unrealized P&L
              </div>
              <div
                className={`text-xl font-semibold tabular-nums ${
                  pnlSummary.unrealized_pnl >= 0
                    ? "text-aqua-pulse"
                    : "text-danger-400"
                }`}
              >
                {pnlSummary.unrealized_pnl >= 0 ? "+" : ""}
                {formatUSDC(pnlSummary.unrealized_pnl)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-2">
                Best Trade
              </div>
              {pnlSummary.best_trade ? (
                <>
                  <div className="text-xl font-semibold text-aqua-pulse tabular-nums">
                    +{formatUSDC(pnlSummary.best_trade.pnl)}
                  </div>
                  <div className="text-xs text-moon-grey-dark truncate mt-1">
                    {pnlSummary.best_trade.market}
                  </div>
                </>
              ) : (
                <div className="text-xl font-semibold text-moon-grey-dark">
                  —
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-2">
                Worst Trade
              </div>
              {pnlSummary.worst_trade ? (
                <>
                  <div className="text-xl font-semibold text-danger-400 tabular-nums">
                    {formatUSDC(pnlSummary.worst_trade.pnl)}
                  </div>
                  <div className="text-xs text-moon-grey-dark truncate mt-1">
                    {pnlSummary.worst_trade.market}
                  </div>
                </>
              ) : (
                <div className="text-xl font-semibold text-moon-grey-dark">
                  —
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 font-medium text-sm transition-all relative ${
              activeTab === tab.id
                ? "text-white"
                : "text-moon-grey hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    activeTab === tab.id
                      ? "bg-neon-iris/20 text-neon-iris"
                      : "bg-graphite-light text-moon-grey-dark"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </div>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-iris" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "positions" && (
        <div className="bg-graphite-deep border border-white/10 rounded-xl">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Trading Positions
              </h2>
              <div className="flex gap-2">
                {(["open", "closed", "all"] as PositionFilter[]).map(
                  (filter) => (
                    <button
                      key={filter}
                      onClick={() => setPositionFilter(filter)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all uppercase tracking-wider ${
                        positionFilter === filter
                          ? "bg-neon-iris text-white"
                          : "bg-graphite-light text-moon-grey hover:text-white hover:bg-graphite-hover"
                      }`}
                    >
                      {filter}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 bg-graphite-light rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : positions.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-graphite-light border border-white/10 mb-4">
                  <BarChart3 className="w-8 h-8 text-moon-grey-dark" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {positionFilter === "open"
                    ? "No Open Positions"
                    : positionFilter === "closed"
                    ? "No Closed Positions"
                    : "No Positions"}
                </h3>
                <p className="text-moon-grey mb-6 max-w-sm mx-auto">
                  {positionFilter === "open"
                    ? "You don't have any active trading positions at the moment."
                    : positionFilter === "closed"
                    ? "You haven't closed any positions yet."
                    : "Start trading to build your portfolio."}
                </p>
                <Link
                  to="/markets"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-neon-iris text-white font-medium rounded-lg hover:bg-neon-iris-light transition-colors"
                >
                  Browse Markets
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map((position) => {
                  const isPositivePnl = position.pnl >= 0;
                  return (
                    <Link
                      key={position.id}
                      to={`/market/${position.market_id}`}
                      className="block bg-graphite-light border border-white/10 rounded-lg p-5 hover:border-white/20 hover:bg-graphite-hover transition-all group"
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-3">
                            <h3 className="font-semibold text-white group-hover:text-neon-iris transition-colors truncate">
                              {position.market_question}
                            </h3>
                            {position.is_resolved && (
                              <span className="px-2 py-1 bg-aqua-pulse/10 text-aqua-pulse rounded text-xs font-medium flex-shrink-0">
                                Resolved
                              </span>
                            )}
                          </div>
                          {position.option_label && (
                            <p className="text-sm text-neon-iris mb-3">
                              {position.option_label}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-1 rounded font-medium text-xs uppercase tracking-wider ${
                                  position.side === "yes"
                                    ? "bg-aqua-pulse/10 text-aqua-pulse"
                                    : "bg-danger-400/10 text-danger-400"
                                }`}
                              >
                                {position.side}
                              </span>
                            </div>
                            <div className="text-moon-grey">
                              <span className="font-medium text-white">
                                {formatShares(position.shares)}
                              </span>{" "}
                              shares @{" "}
                              <span className="font-medium text-white">
                                {formatProbability(position.avg_price)}
                              </span>
                            </div>
                            <div className="text-moon-grey">
                              Current:{" "}
                              <span className="font-medium text-white">
                                {formatProbability(position.current_price)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-semibold text-white mb-1 tabular-nums">
                            {formatUSDC(
                              position.shares * position.current_price
                            )}
                          </div>
                          <div
                            className={`text-sm font-semibold tabular-nums flex items-center justify-end gap-1 ${
                              isPositivePnl
                                ? "text-aqua-pulse"
                                : "text-danger-400"
                            }`}
                          >
                            {isPositivePnl ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                            {isPositivePnl ? "+" : ""}
                            {formatUSDC(position.pnl)}
                          </div>
                          <div
                            className={`text-xs font-medium mt-1 ${
                              isPositivePnl
                                ? "text-aqua-pulse"
                                : "text-danger-400"
                            }`}
                          >
                            {isPositivePnl ? "+" : ""}
                            {position.pnl_percent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "liquidity" && (
        <div className="bg-graphite-deep border border-white/10 rounded-xl">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">
              Liquidity Positions
            </h2>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 bg-graphite-light rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : liquidityPositions.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-graphite-light border border-white/10 mb-4">
                  <PieChart className="w-8 h-8 text-moon-grey-dark" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  No Liquidity Positions
                </h3>
                <p className="text-moon-grey mb-6 max-w-sm mx-auto">
                  You haven't provided liquidity to any markets yet. Earn fees
                  by adding liquidity to active markets.
                </p>
                <Link
                  to="/markets"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-neon-iris text-white font-medium rounded-lg hover:bg-neon-iris-light transition-colors"
                >
                  Explore Markets
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {liquidityPositions.map((position) => {
                  const isPositivePnl = position.pnl >= 0;
                  return (
                    <Link
                      key={position.id}
                      to={`/market/${position.market_id}`}
                      className="block bg-graphite-light border border-white/10 rounded-lg p-5 hover:border-white/20 hover:bg-graphite-hover transition-all group"
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white mb-3 group-hover:text-neon-iris transition-colors truncate">
                            {position.market_question}
                          </h3>
                          <div className="flex flex-wrap items-center gap-6 text-sm">
                            <div className="text-moon-grey">
                              Provided:{" "}
                              <span className="font-medium text-white">
                                {formatUSDC(position.liquidity_provided)}
                              </span>
                            </div>
                            <div className="text-moon-grey">
                              Fees earned:{" "}
                              <span className="font-medium text-aqua-pulse">
                                +{formatUSDC(position.fees_earned)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-semibold text-white mb-1 tabular-nums">
                            {formatUSDC(position.current_value)}
                          </div>
                          <div
                            className={`text-sm font-semibold tabular-nums flex items-center justify-end gap-1 ${
                              isPositivePnl
                                ? "text-aqua-pulse"
                                : "text-danger-400"
                            }`}
                          >
                            {isPositivePnl ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                            {isPositivePnl ? "+" : ""}
                            {formatUSDC(position.pnl)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
