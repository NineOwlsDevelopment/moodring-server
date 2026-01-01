import { useEffect, useState, memo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMarketStore } from "@/stores/marketStore";
import { MarketCard } from "@/components/MarketCard";
import { useUserStore } from "@/stores/userStore";
import {
  fetchPlatformStats,
  fetchTrendingMarkets,
  PlatformStats,
} from "@/api/api";
import { formatNumberRoundedUp, formatUSDCRoundedUp } from "@/utils/format";
import { GradientDivider } from "@/components/brand";

// Refined animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const Home = () => {
  const { markets, setMarkets } = useMarketStore();
  const { user, isInitializing } = useUserStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isInitializing && user) {
      navigate("/markets", { replace: true });
    }
  }, [user, isInitializing, navigate]);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [marketsResult, statsResult] = await Promise.allSettled([
        fetchTrendingMarkets(12),
        fetchPlatformStats(),
      ]);

      if (marketsResult.status === "fulfilled") {
        setMarkets(marketsResult.value.markets);
      }
      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      }
    } catch (error) {
      console.error("Failed to load home data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [setMarkets]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const trendingMarkets = markets.slice(0, 6);

  return (
    <div className="overflow-hidden bg-ink-black">
      {/* ===== HERO ===== */}
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
        {/* Refined atmospheric background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(33,246,210,0.08),transparent_50%)]" />
          {/* Subtle grid - hidden on mobile for performance */}
          <div
            className="absolute inset-0 opacity-[0.03] hidden sm:block"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
              backgroundSize: "80px 80px",
            }}
          />
        </div>

        {/* Gradient line accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />

        <div className="relative z-10 section-container text-center py-20 sm:py-28 lg:py-40">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
          >
            {/* Refined badge */}
            <motion.div
              className="inline-flex items-center gap-2 sm:gap-3 mb-8 sm:mb-12"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="h-px w-8 sm:w-12 bg-gradient-to-r from-transparent to-neon-iris/60" />
              <span className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] uppercase text-moon-grey/70 font-medium">
                Built on Solana
              </span>
              <div className="h-px w-8 sm:w-12 bg-gradient-to-l from-transparent to-neon-iris/60" />
            </motion.div>

            {/* Hero headline - refined typography with mobile sizes */}
            <motion.h1
              className="text-[2.75rem] sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-extralight tracking-[-0.02em] sm:tracking-[-0.03em] leading-[0.95] mb-6 sm:mb-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                delay: 0.3,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            >
              <span className="block text-white">The Future</span>
              <span className="block text-white/40">Has a Price</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              className="text-base sm:text-lg lg:text-xl text-moon-grey/60 max-w-xl sm:max-w-2xl mx-auto mb-10 sm:mb-16 font-light leading-relaxed px-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              The premier prediction market platform. Create markets, trade
              outcomes, capture alpha.
            </motion.p>

            {/* CTAs - refined, minimal */}
            <motion.div
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-16 sm:mb-24 px-4 sm:px-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
            >
              <Link
                to="/markets"
                className="group px-6 sm:px-8 py-3.5 sm:py-4 text-sm font-medium tracking-wide uppercase bg-white text-ink-black rounded-none hover:bg-moon-grey-light transition-all duration-300 inline-flex items-center justify-center gap-3"
              >
                <span>Enter Platform</span>
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
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
              <Link
                to={user ? "/create" : "/login"}
                className="group px-6 sm:px-8 py-3.5 sm:py-4 text-sm font-medium tracking-wide uppercase text-white border border-white/20 rounded-none hover:border-white/40 hover:bg-white/5 transition-all duration-300 inline-flex items-center justify-center gap-3"
              >
                <span>Create Market</span>
              </Link>
            </motion.div>

            {/* Stats - refined, responsive layout */}
            <motion.div
              className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-12 lg:gap-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.9 }}
            >
              <div className="flex items-center gap-8 sm:gap-12 lg:gap-20">
                <StatDisplay
                  value={stats ? formatUSDCRoundedUp(stats.total_volume) : "—"}
                  label="Volume"
                />
                <div className="w-px h-10 sm:h-12 bg-white/10" />
                <StatDisplay
                  value={
                    stats
                      ? formatNumberRoundedUp(stats.active_markets || 0)
                      : "—"
                  }
                  label="Markets"
                />
              </div>
              <div className="hidden sm:block w-px h-12 bg-white/10" />
              <StatDisplay
                value={stats ? formatNumberRoundedUp(stats.total_users) : "—"}
                label="Traders"
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator - minimal, hidden on mobile */}
        <motion.div
          className="absolute bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2 hidden sm:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            className="w-px h-12 sm:h-16 bg-gradient-to-b from-white/30 to-transparent"
            animate={{ scaleY: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </section>

      {/* ===== WHAT WE ARE ===== */}
      <section className="relative py-16 sm:py-24 lg:py-40 border-t border-white/5">
        <div className="section-container">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-32 items-center">
            {/* Left - Statement */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-6 sm:mb-8">
                The Platform
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extralight tracking-tight text-white leading-[1.15] mb-6 sm:mb-8">
                Prediction markets,
                <br />
                <span className="text-white/40">reimagined.</span>
              </h2>

              <div className="space-y-4 sm:space-y-6 text-moon-grey/70 text-base sm:text-lg leading-relaxed font-light">
                <p>
                  Moodring is where conviction meets capital. Trade on any
                  outcome, from asset prices to global events; with
                  institutional-grade liquidity and sub-second settlement.
                </p>
                <p>
                  No order books. No counterparty risk. Just pure, mathematical
                  price discovery powered by LMSR automated market making.
                </p>
              </div>

              <div className="mt-8 sm:mt-12 pt-8 sm:pt-12 border-t border-white/5">
                <div className="grid grid-cols-3 gap-4 sm:gap-8">
                  <div>
                    <div className="text-xl sm:text-2xl font-light text-white mb-1 sm:mb-2">
                      &lt;1s
                    </div>
                    <div className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase text-moon-grey/50">
                      Settlement
                    </div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-light text-white mb-1 sm:mb-2">
                      24/7
                    </div>
                    <div className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase text-moon-grey/50">
                      Liquidity
                    </div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-light text-white mb-1 sm:mb-2">
                      $0.01
                    </div>
                    <div className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase text-moon-grey/50">
                      Min Trade
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right - Visual */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative">
                {/* Refined market preview */}
                <div className="bg-graphite-deep/80 backdrop-blur-sm border border-white/5 p-5 sm:p-8 lg:p-10">
                  <div className="flex items-center justify-between mb-5 sm:mb-8">
                    <div className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase text-moon-grey/50">
                      Live Market
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-aqua-pulse animate-pulse" />
                      <span className="text-[10px] sm:text-xs text-aqua-pulse/80">
                        Active
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg sm:text-xl lg:text-2xl font-light text-white mb-5 sm:mb-8 leading-tight">
                    Will BTC exceed $150,000 by December 2025?
                  </h3>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-8">
                    <div className="border border-aqua-pulse/20 bg-aqua-pulse/5 p-4 sm:p-5">
                      <div className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase text-aqua-pulse/60 mb-1 sm:mb-2">
                        Yes
                      </div>
                      <div className="text-2xl sm:text-3xl font-light text-white">
                        $0.68
                      </div>
                    </div>
                    <div className="border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                      <div className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase text-moon-grey/50 mb-1 sm:mb-2">
                        No
                      </div>
                      <div className="text-2xl sm:text-3xl font-light text-white">
                        $0.32
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] sm:text-xs text-moon-grey/50">
                    <span>$2.4M Volume</span>
                    <span>11mo remaining</span>
                  </div>
                </div>

                {/* Decorative element - hidden on mobile */}
                <div className="hidden sm:block absolute -bottom-4 -right-4 w-24 lg:w-32 h-24 lg:h-32 border border-neon-iris/10 -z-10" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== CAPABILITIES ===== */}
      <section className="relative py-16 sm:py-24 lg:py-40 bg-graphite-deep/30 border-t border-white/5">
        <div className="section-container">
          <motion.div
            className="text-center mb-12 sm:mb-20"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-5 sm:mb-8">
              Capabilities
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-tight text-white">
              Built for precision
            </h2>
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 md:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {[
              {
                title: "Infinite Liquidity",
                description:
                  "LMSR automated market making ensures you can always trade, at any size. No waiting for counterparties.",
              },
              {
                title: "Instant Settlement",
                description:
                  "Trades settle in under one second on Solana. Your capital is never locked, always liquid.",
              },
              {
                title: "Market Creation",
                description:
                  "Launch markets in seconds. No technical expertise required. Earn fees from every trade.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                className="bg-ink-black p-6 sm:p-8 lg:p-12"
                variants={fadeInUp}
                custom={index}
              >
                <div className="text-4xl sm:text-5xl font-extralight text-white/10 mb-4 sm:mb-6">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="text-lg sm:text-xl font-light text-white mb-3 sm:mb-4">
                  {item.title}
                </h3>
                <p className="text-sm sm:text-base text-moon-grey/60 leading-relaxed font-light">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== MARKET DOMAINS ===== */}
      <section className="relative py-16 sm:py-24 lg:py-40 border-t border-white/5">
        <div className="section-container">
          <motion.div
            className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 sm:gap-8 mb-10 sm:mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div>
              <div className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-5 sm:mb-8">
                Market Coverage
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-tight text-white">
                Trade every outcome
              </h2>
            </div>
            <p className="text-sm sm:text-base text-moon-grey/60 max-w-md font-light">
              From cryptocurrency milestones to geopolitical events—if it has an
              outcome, it can be a market.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {[
              { name: "Crypto", count: "200+" },
              { name: "Politics", count: "150+" },
              { name: "Sports", count: "300+" },
              { name: "Technology", count: "80+" },
              { name: "Finance", count: "120+" },
              { name: "Culture", count: "60+" },
            ].map((category) => (
              <div
                key={category.name}
                className="bg-ink-black p-4 sm:p-6 lg:p-8 group hover:bg-graphite-deep/50 transition-colors duration-300"
              >
                <div className="text-xl sm:text-2xl font-light text-white mb-1 sm:mb-2 group-hover:text-neon-iris transition-colors duration-300">
                  {category.count}
                </div>
                <div className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase text-moon-grey/50">
                  {category.name}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <GradientDivider className="max-w-xs sm:max-w-xl mx-auto opacity-30" />

      {/* ===== TRENDING MARKETS ===== */}
      <section className="relative py-16 sm:py-24 lg:py-40">
        <div className="section-container">
          <motion.div
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-8 mb-10 sm:mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div>
              <div className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-5 sm:mb-8">
                Live Markets
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-tight text-white">
                Trending now
              </h2>
            </div>
            <Link
              to="/markets"
              className="group inline-flex items-center gap-2 sm:gap-3 text-xs sm:text-sm tracking-wide uppercase text-moon-grey/60 hover:text-white transition-colors"
            >
              <span>View All Markets</span>
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
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </motion.div>

          {!isLoading && trendingMarkets.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
            >
              {trendingMarkets.map((market, index) => (
                <motion.div key={market.id} variants={fadeInUp} custom={index}>
                  <MarketCard market={market} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 sm:h-64 bg-graphite-deep/50 border border-white/5 animate-pulse"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== TECHNOLOGY ===== */}
      <section className="relative py-16 sm:py-24 lg:py-40 bg-graphite-deep/30 border-t border-white/5">
        <div className="section-container">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-32 items-center">
            {/* Left - LMSR Visualization */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="relative order-2 lg:order-1"
            >
              <div className="aspect-square max-w-sm sm:max-w-md mx-auto lg:max-w-none relative">
                {/* Refined visualization */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Concentric circles */}
                  {[0.9, 0.7, 0.5, 0.3].map((scale, i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-full border border-white/5"
                      style={{
                        width: `${scale * 100}%`,
                        height: `${scale * 100}%`,
                      }}
                      animate={{
                        opacity: [0.3, 0.6, 0.3],
                        scale: [1, 1.02, 1],
                      }}
                      transition={{
                        duration: 4,
                        delay: i * 0.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  ))}

                  {/* Center element */}
                  <div className="relative z-10 text-center">
                    <div className="text-4xl sm:text-5xl lg:text-6xl font-extralight text-white mb-2 sm:mb-4">
                      LMSR
                    </div>
                    <div className="text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.3em] uppercase text-moon-grey/50">
                      Market Scoring Rule
                    </div>
                  </div>
                </div>

                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-10 sm:w-16 h-10 sm:h-16 border-t border-l border-neon-iris/20" />
                <div className="absolute bottom-0 right-0 w-10 sm:w-16 h-10 sm:h-16 border-b border-r border-neon-iris/20" />
              </div>
            </motion.div>

            {/* Right - Content */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2"
            >
              <div className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-5 sm:mb-8">
                Technology
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-tight text-white leading-[1.15] mb-6 sm:mb-8">
                Mathematically
                <br />
                <span className="text-white/40">guaranteed liquidity</span>
              </h2>

              <div className="space-y-4 sm:space-y-6 text-moon-grey/70 text-base sm:text-lg leading-relaxed font-light mb-8 sm:mb-12">
                <p>
                  The Logarithmic Market Scoring Rule is the gold standard for
                  automated market making. Originally developed at Microsoft
                  Research, it provides provably optimal price discovery.
                </p>
                <p className="hidden sm:block">
                  Every trade executes instantly against our bonding curve.
                  Prices update in real-time. No slippage on reasonable sizes.
                </p>
              </div>

              <div className="space-y-4 sm:space-y-6">
                {[
                  {
                    label: "Price Discovery",
                    value: "Mathematically optimal",
                  },
                  {
                    label: "Liquidity Model",
                    value: "Automated, infinite",
                  },
                  {
                    label: "Settlement",
                    value: "Instant, on-chain",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-3 sm:py-4 border-b border-white/5"
                  >
                    <span className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase text-moon-grey/50">
                      {item.label}
                    </span>
                    <span className="text-sm sm:text-base text-white font-light">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== PROCESS ===== */}
      <section className="relative py-16 sm:py-24 lg:py-40 border-t border-white/5">
        <div className="section-container">
          <motion.div
            className="text-center mb-12 sm:mb-20"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-5 sm:mb-8">
              For Creators
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-tight text-white mb-4 sm:mb-6">
              Launch a market in seconds
            </h2>
            <p className="text-sm sm:text-base text-moon-grey/60 max-w-xl sm:max-w-2xl mx-auto font-light px-2">
              No smart contracts to deploy. No technical knowledge required.
              Define your question, set parameters, and go live.
            </p>
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {[
              {
                step: "01",
                title: "Define",
                description:
                  "Write your prediction question. Set the resolution criteria and expiration date.",
              },
              {
                step: "02",
                title: "Configure",
                description:
                  "Choose YES/NO or multiple outcomes. Set initial liquidity depth and parameters.",
              },
              {
                step: "03",
                title: "Launch",
                description:
                  "Deploy instantly to Solana. Earn creator fees on every trade in your market.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                className="bg-ink-black p-6 sm:p-8 lg:p-12 text-center"
                variants={fadeInUp}
                custom={index}
              >
                <div className="inline-flex items-center justify-center w-12 sm:w-16 h-12 sm:h-16 border border-white/10 mb-5 sm:mb-8">
                  <span className="text-lg sm:text-xl font-extralight text-neon-iris/80">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-light text-white mb-3 sm:mb-4">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-moon-grey/60 leading-relaxed font-light">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="text-center mt-10 sm:mt-16 px-4 sm:px-0"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Link
              to={user ? "/create" : "/login"}
              className="group w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 text-sm font-medium tracking-wide uppercase bg-white text-ink-black rounded-none hover:bg-moon-grey-light transition-all duration-300 inline-flex items-center justify-center gap-3"
            >
              <span>Create Your First Market</span>
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
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== TRUST ===== */}
      <section className="relative py-12 sm:py-16 lg:py-20 border-t border-white/5 bg-graphite-deep/20">
        <div className="section-container">
          <motion.div
            className="flex flex-wrap justify-center items-center gap-6 sm:gap-8 lg:gap-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            {["Solana Secured", "USDC Settlement", "Open Protocol"].map(
              (item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 sm:gap-3 text-moon-grey/40"
                >
                  <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-neon-iris/40" />
                  <span className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium">
                    {item}
                  </span>
                </div>
              )
            )}
          </motion.div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="relative py-24 sm:py-32 lg:py-48 xl:py-56 overflow-hidden">
        {/* Refined gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-iris/20 via-ink-black to-aqua-pulse/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(124,77,255,0.15),transparent_70%)]" />

        {/* Grid overlay - hidden on mobile */}
        <div
          className="absolute inset-0 opacity-[0.03] hidden sm:block"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />

        <div className="relative z-10 section-container text-center px-6 sm:px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-extralight tracking-[-0.02em] sm:tracking-[-0.03em] text-white mb-6 sm:mb-8 leading-[1]">
              Trade the future.
              <br />
              <span className="text-white/40">Today.</span>
            </h2>

            <p className="text-base sm:text-lg text-moon-grey/60 max-w-md sm:max-w-xl mx-auto mb-10 sm:mb-16 font-light">
              Join the premier prediction market platform. No barriers, no
              complexity—just opportunity.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                to="/markets"
                className="group px-8 sm:px-12 py-4 sm:py-5 text-sm font-medium tracking-wide uppercase bg-white text-ink-black rounded-none hover:bg-moon-grey-light transition-all duration-300 inline-flex items-center justify-center gap-3"
              >
                <span>Start Trading</span>
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
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
              <Link
                to="/how-it-works"
                className="px-8 sm:px-12 py-4 sm:py-5 text-sm font-medium tracking-wide uppercase text-white/60 hover:text-white transition-colors duration-300 inline-flex items-center justify-center"
              >
                Learn More
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

// ===== HELPER COMPONENTS =====

const StatDisplay = memo(
  ({ value, label }: { value: string; label: string }) => (
    <div className="text-center">
      <div className="text-xl sm:text-2xl lg:text-3xl font-extralight text-white tabular-nums mb-1 sm:mb-2">
        {value}
      </div>
      <div className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase text-moon-grey/50">
        {label}
      </div>
    </div>
  )
);
StatDisplay.displayName = "StatDisplay";
