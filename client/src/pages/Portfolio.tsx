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
import {
  formatUSDC,
  formatProbability,
  formatShares,
} from "@/utils/format";

type Tab = "positions" | "liquidity" | "history";
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
    { id: "history" as const, label: "Trade History" },
  ];

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="text-6xl mb-4">💼</div>
        <h1 className="text-3xl font-bold text-white mb-4">Portfolio</h1>
        <p className="text-gray-400">
          Connect your wallet to view your portfolio
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl font-bold text-white mb-8">Portfolio</h1>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card bg-gradient-to-br from-dark-900 to-dark-800">
          <div className="text-sm text-gray-400 mb-1">Total Value</div>
          <div className="text-3xl font-bold text-white">
            {formatUSDC(portfolio?.total_value || 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Cash + Positions + Liquidity
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Cash Balance</div>
          <div className="text-3xl font-bold text-white">
            {formatUSDC(user?.wallet?.balance_usdc || 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Available to trade</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Positions Value</div>
          <div className="text-3xl font-bold text-white">
            {formatUSDC(portfolio?.positions_value || 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {positions.length} active positions
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Total P&L</div>
          <div
            className={`text-3xl font-bold ${
              (portfolio?.total_pnl || 0) >= 0
                ? "text-success-400"
                : "text-danger-400"
            }`}
          >
            {(portfolio?.total_pnl || 0) >= 0 ? "+" : ""}
            {formatUSDC(portfolio?.total_pnl || 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {(portfolio?.total_pnl_percent || 0) >= 0 ? "+" : ""}
            {(portfolio?.total_pnl_percent || 0).toFixed(1)}% all time
          </div>
        </div>
      </div>

      {/* P&L Summary */}
      {pnlSummary && (
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Performance Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-400 mb-1">Realized P&L</div>
              <div
                className={`text-xl font-bold ${
                  pnlSummary.realized_pnl >= 0
                    ? "text-success-400"
                    : "text-danger-400"
                }`}
              >
                {pnlSummary.realized_pnl >= 0 ? "+" : ""}
                {formatUSDC(pnlSummary.realized_pnl)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Unrealized P&L</div>
              <div
                className={`text-xl font-bold ${
                  pnlSummary.unrealized_pnl >= 0
                    ? "text-success-400"
                    : "text-danger-400"
                }`}
              >
                {pnlSummary.unrealized_pnl >= 0 ? "+" : ""}
                {formatUSDC(pnlSummary.unrealized_pnl)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Best Trade</div>
              {pnlSummary.best_trade ? (
                <>
                  <div className="text-xl font-bold text-success-400">
                    +{formatUSDC(pnlSummary.best_trade.pnl)}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {pnlSummary.best_trade.market}
                  </div>
                </>
              ) : (
                <div className="text-xl font-bold text-gray-500">-</div>
              )}
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Worst Trade</div>
              {pnlSummary.worst_trade ? (
                <>
                  <div className="text-xl font-bold text-danger-400">
                    {formatUSDC(pnlSummary.worst_trade.pnl)}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {pnlSummary.worst_trade.market}
                  </div>
                </>
              ) : (
                <div className="text-xl font-bold text-gray-500">-</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-dark-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium text-sm transition-colors relative ${
              activeTab === tab.id
                ? "text-primary-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-2 px-2 py-0.5 bg-dark-700 rounded-full text-xs">
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "positions" && (
        <div className="card">
          {/* Position Filters */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Your Positions</h2>
            <div className="flex gap-2">
              {(["open", "closed", "all"] as PositionFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPositionFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    positionFilter === filter
                      ? "bg-primary-600 text-white"
                      : "bg-dark-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-dark-800 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-gray-400 mb-4">
                {positionFilter === "open"
                  ? "You don't have any open positions"
                  : positionFilter === "closed"
                  ? "No closed positions yet"
                  : "No positions yet. Start trading!"}
              </p>
              <Link to="/markets" className="btn btn-primary">
                Browse Markets
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {positions.map((position) => (
                <Link
                  key={position.id}
                  to={`/market/${position.market_id}`}
                  className="block  rounded-lg p-4 bg-dark-800 hover:bg-dark-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white mb-1 truncate">
                        {position.market_question}
                      </h3>
                      {position.option_label && (
                        <p className="text-sm text-primary-400 mb-2">
                          {position.option_label}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span
                          className={`font-medium ${
                            position.side === "yes"
                              ? "text-success-400"
                              : "text-danger-400"
                          }`}
                        >
                          {position.side.toUpperCase()}
                        </span>
                        <span className="text-gray-400">
                          {formatShares(position.shares)} shares @{" "}
                          {formatProbability(position.avg_price)}
                        </span>
                        {position.is_resolved && (
                          <span className="px-2 py-0.5 bg-success-500/20 text-success-300 rounded-full text-xs ">
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-white">
                        {formatUSDC(position.shares * position.current_price)}
                      </div>
                      <div
                        className={`text-sm font-medium ${
                          position.pnl >= 0
                            ? "text-success-400"
                            : "text-danger-400"
                        }`}
                      >
                        {position.pnl >= 0 ? "+" : ""}
                        {formatUSDC(position.pnl)} (
                        {position.pnl_percent >= 0 ? "+" : ""}
                        {position.pnl_percent.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "liquidity" && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-6">
            Liquidity Positions
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-dark-800 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : liquidityPositions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">💧</div>
              <p className="text-gray-400 mb-4">
                You haven't provided liquidity to any markets yet
              </p>
              <Link to="/markets" className="btn btn-primary">
                Explore Markets
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {liquidityPositions.map((position) => (
                <Link
                  key={position.id}
                  to={`/market/${position.market_id}`}
                  className="block  rounded-lg p-4 bg-dark-800 hover:bg-dark-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white mb-1 truncate">
                        {position.market_question}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                        <span>
                          Provided: {formatUSDC(position.liquidity_provided)}
                        </span>
                        <span>
                          Fees earned:{" "}
                          <span className="text-success-400">
                            +{formatUSDC(position.fees_earned)}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-white">
                        {formatUSDC(position.current_value)}
                      </div>
                      <div
                        className={`text-sm font-medium ${
                          position.pnl >= 0
                            ? "text-success-400"
                            : "text-danger-400"
                        }`}
                      >
                        {position.pnl >= 0 ? "+" : ""}
                        {formatUSDC(position.pnl)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-6">
            Trade History
          </h2>
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📜</div>
            <p className="text-gray-400 mb-4">
              View your complete trade history
            </p>
            <Link to="/activity" className="btn btn-primary">
              View Activity
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
