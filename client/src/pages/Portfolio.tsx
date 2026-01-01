import { useEffect, useState, memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
  Droplets,
} from "lucide-react";

type Tab = "positions" | "liquidity";
type PositionFilter = "open" | "closed" | "all";

// Animation variants matching Home page
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

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
      <div className="min-h-screen bg-ink-black overflow-hidden">
        {/* Atmospheric background */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.1),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(33,246,210,0.06),transparent_50%)]" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 border border-white/10 mb-8">
              <Wallet className="w-10 h-10 text-moon-grey/60" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white mb-4">
              Portfolio
            </h1>
            <p className="text-moon-grey/60 text-base sm:text-lg font-light">
              Connect your wallet to view your portfolio
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  const totalPnl = portfolio?.total_pnl || 0;
  const totalPnlPercent = portfolio?.total_pnl_percent || 0;
  const isPositive = totalPnl >= 0;

  return (
    <div className="min-h-screen bg-ink-black overflow-hidden">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(33,246,210,0.06),transparent_50%)]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02] hidden sm:block"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Gradient line accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/20 to-transparent" />

      <div className="relative z-10 section-container py-12 sm:py-16 lg:py-20">
        {/* Header */}
        <motion.div
          className="mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-neon-iris/80 font-medium mb-4">
            Your Portfolio
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-tight text-white mb-4">
            Performance
          </h1>
          <p className="text-moon-grey/60 text-base sm:text-lg font-light max-w-xl">
            Track your trading positions, liquidity provisions, and overall performance.
          </p>
        </motion.div>

        {/* Portfolio Summary Cards */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <StatCard
            label="Total Value"
            value={formatUSDC(portfolio?.total_value || 0)}
            sublabel="Cash + Positions + LP"
            icon={<DollarSign className="w-4 h-4" />}
            index={0}
          />
          <StatCard
            label="Cash Balance"
            value={formatUSDC(user?.wallet?.balance_usdc || 0)}
            sublabel="Available to trade"
            icon={<Wallet className="w-4 h-4" />}
            index={1}
          />
          <StatCard
            label="Positions Value"
            value={formatUSDC(portfolio?.positions_value || 0)}
            sublabel={`${positions.length} ${positions.length === 1 ? "position" : "positions"}`}
            icon={<BarChart3 className="w-4 h-4" />}
            index={2}
          />
          <StatCard
            label="Total P&L"
            value={`${isPositive ? "+" : ""}${formatUSDC(totalPnl)}`}
            sublabel={`${isPositive ? "+" : ""}${totalPnlPercent.toFixed(2)}% all time`}
            icon={isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            variant={isPositive ? "success" : "danger"}
            index={3}
          />
        </motion.div>

        {/* P&L Summary */}
        {pnlSummary && (
          <motion.div
            className="bg-graphite-deep/60 backdrop-blur-sm border border-white/5 p-6 sm:p-8 mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <PieChart className="w-5 h-5 text-neon-iris/60" />
              <h2 className="text-lg sm:text-xl font-light text-white">
                Performance Summary
              </h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              <div>
                <div className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-2">
                  Realized P&L
                </div>
                <div
                  className={`text-xl sm:text-2xl font-light tabular-nums ${
                    pnlSummary.realized_pnl >= 0 ? "text-aqua-pulse" : "text-danger-400"
                  }`}
                >
                  {pnlSummary.realized_pnl >= 0 ? "+" : ""}
                  {formatUSDC(pnlSummary.realized_pnl)}
                </div>
              </div>
              <div>
                <div className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-2">
                  Unrealized P&L
                </div>
                <div
                  className={`text-xl sm:text-2xl font-light tabular-nums ${
                    pnlSummary.unrealized_pnl >= 0 ? "text-aqua-pulse" : "text-danger-400"
                  }`}
                >
                  {pnlSummary.unrealized_pnl >= 0 ? "+" : ""}
                  {formatUSDC(pnlSummary.unrealized_pnl)}
                </div>
              </div>
              <div>
                <div className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-2">
                  Best Trade
                </div>
                {pnlSummary.best_trade ? (
                  <>
                    <div className="text-xl sm:text-2xl font-light text-aqua-pulse tabular-nums">
                      +{formatUSDC(pnlSummary.best_trade.pnl)}
                    </div>
                    <div className="text-xs text-moon-grey/50 truncate mt-1">
                      {pnlSummary.best_trade.market}
                    </div>
                  </>
                ) : (
                  <div className="text-xl sm:text-2xl font-light text-moon-grey/30">—</div>
                )}
              </div>
              <div>
                <div className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-2">
                  Worst Trade
                </div>
                {pnlSummary.worst_trade ? (
                  <>
                    <div className="text-xl sm:text-2xl font-light text-danger-400 tabular-nums">
                      {formatUSDC(pnlSummary.worst_trade.pnl)}
                    </div>
                    <div className="text-xs text-moon-grey/50 truncate mt-1">
                      {pnlSummary.worst_trade.market}
                    </div>
                  </>
                ) : (
                  <div className="text-xl sm:text-2xl font-light text-moon-grey/30">—</div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <motion.div
          className="flex items-center gap-1 mb-8 border-b border-white/5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 sm:px-6 py-3 sm:py-4 font-medium text-sm tracking-wide transition-all relative ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-moon-grey/60 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="uppercase text-xs sm:text-sm tracking-[0.1em]">{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 text-xs font-medium ${
                      activeTab === tab.id
                        ? "text-neon-iris"
                        : "text-moon-grey/40"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </div>
              {activeTab === tab.id && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-neon-iris to-aqua-pulse"
                  layoutId="tabIndicator"
                />
              )}
            </button>
          ))}
        </motion.div>

        {/* Tab Content */}
        {activeTab === "positions" && (
          <motion.div
            className="bg-graphite-deep/40 backdrop-blur-sm border border-white/5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="p-5 sm:p-6 border-b border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-light text-white">
                  Trading Positions
                </h2>
                <div className="flex gap-2">
                  {(["open", "closed", "all"] as PositionFilter[]).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setPositionFilter(filter)}
                      className={`px-4 py-2 text-xs font-medium transition-all uppercase tracking-[0.15em] ${
                        positionFilter === filter
                          ? "bg-white text-ink-black"
                          : "bg-transparent border border-white/10 text-moon-grey/60 hover:text-white hover:border-white/20"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 bg-white/[0.02] border border-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : positions.length === 0 ? (
                <div className="text-center py-16 sm:py-24">
                  <div className="inline-flex items-center justify-center w-16 h-16 border border-white/10 mb-6">
                    <BarChart3 className="w-8 h-8 text-moon-grey/40" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-light text-white mb-3">
                    {positionFilter === "open"
                      ? "No Open Positions"
                      : positionFilter === "closed"
                      ? "No Closed Positions"
                      : "No Positions"}
                  </h3>
                  <p className="text-moon-grey/60 mb-8 max-w-sm mx-auto font-light">
                    {positionFilter === "open"
                      ? "You don't have any active trading positions at the moment."
                      : positionFilter === "closed"
                      ? "You haven't closed any positions yet."
                      : "Start trading to build your portfolio."}
                  </p>
                  <Link
                    to="/markets"
                    className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-ink-black font-medium text-sm tracking-wide uppercase hover:bg-moon-grey-light transition-all"
                  >
                    <span>Browse Markets</span>
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>
              ) : (
                <motion.div
                  className="space-y-3"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {positions.map((position) => (
                    <PositionCard key={position.id} position={position} />
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "liquidity" && (
          <motion.div
            className="bg-graphite-deep/40 backdrop-blur-sm border border-white/5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="p-5 sm:p-6 border-b border-white/5">
              <h2 className="text-lg sm:text-xl font-light text-white">
                Liquidity Positions
              </h2>
            </div>

            <div className="p-5 sm:p-6">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 bg-white/[0.02] border border-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : liquidityPositions.length === 0 ? (
                <div className="text-center py-16 sm:py-24">
                  <div className="inline-flex items-center justify-center w-16 h-16 border border-white/10 mb-6">
                    <Droplets className="w-8 h-8 text-moon-grey/40" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-light text-white mb-3">
                    No Liquidity Positions
                  </h3>
                  <p className="text-moon-grey/60 mb-8 max-w-sm mx-auto font-light">
                    You haven't provided liquidity to any markets yet. Earn fees
                    by adding liquidity to active markets.
                  </p>
                  <Link
                    to="/markets"
                    className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-ink-black font-medium text-sm tracking-wide uppercase hover:bg-moon-grey-light transition-all"
                  >
                    <span>Explore Markets</span>
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>
              ) : (
                <motion.div
                  className="space-y-3"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {liquidityPositions.map((position) => (
                    <LiquidityCard key={position.id} position={position} />
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// ===== HELPER COMPONENTS =====

const StatCard = memo(
  ({
    label,
    value,
    sublabel,
    icon,
    variant = "default",
    index,
  }: {
    label: string;
    value: string;
    sublabel: string;
    icon: React.ReactNode;
    variant?: "default" | "success" | "danger";
    index: number;
  }) => {
    const valueColor =
      variant === "success"
        ? "text-aqua-pulse"
        : variant === "danger"
        ? "text-danger-400"
        : "text-white";

    return (
      <motion.div
        className="bg-graphite-deep/60 backdrop-blur-sm border border-white/5 p-5 sm:p-6 hover:border-white/10 transition-all duration-300"
        variants={fadeInUp}
        custom={index}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50">
            {label}
          </div>
          <div className="text-moon-grey/40">{icon}</div>
        </div>
        <div className={`text-xl sm:text-2xl font-light ${valueColor} mb-1 tabular-nums`}>
          {value}
        </div>
        <div className="text-[10px] sm:text-xs text-moon-grey/40">{sublabel}</div>
      </motion.div>
    );
  }
);
StatCard.displayName = "StatCard";

const PositionCard = memo(({ position }: { position: Position }) => {
  const isPositivePnl = position.pnl >= 0;

  return (
    <motion.div variants={fadeInUp}>
      <Link
        to={`/market/${position.market_id}`}
        className="block bg-white/[0.02] border border-white/5 p-5 sm:p-6 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300 group"
      >
        <div className="flex items-start justify-between gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-3">
              <h3 className="text-base sm:text-lg font-light text-white group-hover:text-neon-iris transition-colors line-clamp-2">
                {position.market_question}
              </h3>
              {position.is_resolved && (
                <span className="px-2 py-1 bg-aqua-pulse/10 text-aqua-pulse text-[10px] tracking-[0.1em] uppercase flex-shrink-0">
                  Resolved
                </span>
              )}
            </div>
            {position.option_label && (
              <p className="text-sm text-neon-iris/80 mb-3">{position.option_label}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span
                className={`px-2.5 py-1 text-[10px] tracking-[0.15em] uppercase font-medium ${
                  position.side === "yes"
                    ? "bg-aqua-pulse/10 text-aqua-pulse"
                    : "bg-danger-400/10 text-danger-400"
                }`}
              >
                {position.side}
              </span>
              <span className="text-moon-grey/60 font-light">
                <span className="text-white">{formatShares(position.shares)}</span>{" "}
                shares @ <span className="text-white">{formatProbability(position.avg_price)}</span>
              </span>
              <span className="text-moon-grey/60 font-light hidden sm:inline">
                Current: <span className="text-white">{formatProbability(position.current_price)}</span>
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg sm:text-xl font-light text-white mb-1 tabular-nums">
              {formatUSDC(position.shares * position.current_price)}
            </div>
            <div
              className={`text-sm font-medium tabular-nums flex items-center justify-end gap-1 ${
                isPositivePnl ? "text-aqua-pulse" : "text-danger-400"
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
              className={`text-xs mt-1 ${
                isPositivePnl ? "text-aqua-pulse/70" : "text-danger-400/70"
              }`}
            >
              {isPositivePnl ? "+" : ""}
              {position.pnl_percent.toFixed(2)}%
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
});
PositionCard.displayName = "PositionCard";

const LiquidityCard = memo(({ position }: { position: LiquidityPosition }) => {
  const isPositivePnl = position.pnl >= 0;

  return (
    <motion.div variants={fadeInUp}>
      <Link
        to={`/market/${position.market_id}`}
        className="block bg-white/[0.02] border border-white/5 p-5 sm:p-6 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300 group"
      >
        <div className="flex items-start justify-between gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-light text-white mb-3 group-hover:text-neon-iris transition-colors line-clamp-2">
              {position.market_question}
            </h3>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
              <span className="text-moon-grey/60 font-light">
                Provided:{" "}
                <span className="text-white">{formatUSDC(position.liquidity_provided)}</span>
              </span>
              <span className="text-moon-grey/60 font-light">
                Fees:{" "}
                <span className="text-aqua-pulse">+{formatUSDC(position.fees_earned)}</span>
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg sm:text-xl font-light text-white mb-1 tabular-nums">
              {formatUSDC(position.current_value)}
            </div>
            <div
              className={`text-sm font-medium tabular-nums flex items-center justify-end gap-1 ${
                isPositivePnl ? "text-aqua-pulse" : "text-danger-400"
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
    </motion.div>
  );
});
LiquidityCard.displayName = "LiquidityCard";
