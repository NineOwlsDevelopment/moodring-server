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
import {
  HeroBadge,
  GradientDivider,
  StepCard,
  FeatureCard,
  LMSRAnimationSimple,
  CreationDemo,
} from "@/components/brand";
import { InteractiveTutorial } from "@/components/InteractiveTutorial";

export const Home = () => {
  const { markets, setMarkets } = useMarketStore();
  const { user, isInitializing } = useUserStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Static gradient angle for background effects (no longer synced with ring)
  const gradientAngle = 0.5;

  // Redirect logged-in users to markets page
  useEffect(() => {
    if (!isInitializing && user) {
      navigate("/markets", { replace: true });
    }
  }, [user, isInitializing, navigate]);

  // Load all data in parallel for faster initial load
  const loadAllData = useCallback(async () => {
    setIsLoading(true);

    try {
      // Fetch all data in parallel - much faster than sequential
      const [marketsResult, statsResult] = await Promise.allSettled([
        fetchTrendingMarkets(12),
        fetchPlatformStats(),
      ]);

      // Handle markets
      if (marketsResult.status === "fulfilled") {
        setMarkets(marketsResult.value.markets);
      }

      // Handle stats
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

  const trendingMarkets = markets.slice(0, 12);

  return (
    <div className="overflow-hidden">
      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-ink-black">
        {/* Background effects */}
        <div className="absolute inset-0 bg-mesh opacity-50" />

        {/* Subtle gradient orbs */}
        <motion.div
          className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial-iris opacity-10 blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-radial-aqua opacity-10 blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-grid opacity-20" />

        {/* Main content container */}
        <div className="relative w-full section-container py-20 lg:py-32 z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left side - Text content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <HeroBadge>Live on Solana</HeroBadge>
              </motion.div>

              <motion.h1
                className="mt-8 lg:mt-12 text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-tight tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <span className="block text-white">Create</span>
                <span className="block bg-gradient-to-r from-neon-iris via-aqua-pulse to-neon-iris bg-clip-text text-transparent">
                  Prediction Markets
                </span>
                <span className="block text-white/60 text-2xl sm:text-3xl md:text-4xl lg:text-5xl mt-4 font-light">
                  No Code Required
                </span>
              </motion.h1>

              <motion.p
                className="mt-6 lg:mt-8 text-base sm:text-lg lg:text-xl text-moon-grey/80 leading-relaxed max-w-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                Anyone can create a prediction market on Moodring. No coding, no
                complexity—just ask a question, set the options, and launch in
                seconds. Turn any event into a market.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4 mt-8 lg:mt-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.6,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <Link
                  to={user ? "/create" : "/login"}
                  className="px-6 py-3.5 text-base font-semibold bg-neon-iris text-white rounded-xl hover:bg-neon-iris-light transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-neon-iris/30 hover:shadow-neon-iris/50"
                >
                  {user ? "Create Market" : "Get Started Free"}
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </Link>
                <Link
                  to="/markets"
                  className="px-6 py-3.5 text-base font-semibold bg-graphite-deep text-white border border-white/10 rounded-xl hover:bg-graphite-hover hover:border-white/20 transition-all inline-flex items-center justify-center gap-2"
                >
                  Browse Markets
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
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </Link>
              </motion.div>
            </motion.div>

            {/* Right side - Creation Demo */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="relative">
                <CreationDemo />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-5 h-8 border border-white/20 rounded-full flex items-start justify-center p-1.5 backdrop-blur-sm bg-white/5">
            <motion.div
              className="w-1.5 h-1.5 bg-white/60 rounded-full"
              animate={{ y: [0, 10, 0], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </section>

      <GradientDivider animated className="max-w-4xl mx-auto opacity-60" />

      {/* ===== BIG DISPLAY TEXT SECTION ===== */}
      <section className="hidden md:block relative py-12 lg:py-16 bg-ink-black overflow-hidden">
        <motion.div
          className="section-container relative"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-200px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-center">
            <motion.h2
              className="text-7xl sm:text-8xl md:text-9xl lg:text-[12rem] xl:text-[14rem] font-black text-white/[0.03] leading-none tracking-[-0.04em]"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              MOODRING
            </motion.h2>
          </div>
        </motion.div>
      </section>

      {/* ===== STATS SECTION ===== */}
      {/* Stats align to ring arc - radial positioning */}
      <section className="relative py-12 lg:py-16 bg-ink-black overflow-hidden">
        {/* Background decoration */}
        <motion.div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-iris/[0.03] to-transparent" />

        <div className="section-container relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            <AnimatedStatCard
              value={stats ? formatUSDCRoundedUp(stats.total_volume) : "$--"}
              label="Total Volume"
              icon="💰"
              delay={0}
            />
            <AnimatedStatCard
              value={
                stats ? formatNumberRoundedUp(stats.active_markets || 0) : "--"
              }
              label="Active Markets"
              icon="📊"
              delay={0.1}
            />
            <AnimatedStatCard
              value={stats ? formatNumberRoundedUp(stats.total_users) : "--"}
              label="Traders"
              icon="👥"
              delay={0.2}
            />
            <AnimatedStatCard
              value={stats ? formatNumberRoundedUp(stats.total_trades) : "--"}
              label="Total Trades"
              icon="⚡"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* ===== WHY IT'S SO EASY ===== */}
      <section className="section-padding bg-ink-black relative overflow-hidden py-20 lg:py-28">
        {/* Background effects */}
        <motion.div className="absolute top-1/4 left-0 w-96 h-96 bg-gradient-radial-iris opacity-[0.03] blur-3xl" />
        <motion.div className="absolute bottom-1/4 right-0 w-96 h-96 bg-gradient-radial-aqua opacity-[0.03] blur-3xl" />

        <div className="section-container relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left side - Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-neon-iris/10 border border-neon-iris/20 rounded-full text-neon-iris text-sm font-medium mb-6"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-iris opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-iris" />
                </span>
                No Technical Skills Required
              </motion.div>
              <motion.h2
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 1,
                  delay: 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                Anyone Can{" "}
                <motion.span
                  className="bg-gradient-to-r from-neon-iris to-aqua-pulse bg-clip-text text-transparent bg-[length:200%_100%]"
                  style={{
                    backgroundPosition: `${
                      (gradientAngle * 57.2958) % 360
                    }% 0%`,
                  }}
                >
                  Create Markets
                </motion.span>
              </motion.h2>
              <motion.p
                className="text-base sm:text-lg text-moon-grey/80 mb-8 leading-relaxed tracking-wide"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 1,
                  delay: 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                Traditional prediction markets require coding, smart contract
                deployment, and deep blockchain knowledge. Moodring removes all
                that complexity. Just fill out a simple form, and your market
                launches instantly on Solana.
              </motion.p>

              <div className="space-y-4 mt-8">
                <motion.div
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: 0.3,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-aqua-pulse/20 flex items-center justify-center mt-0.5">
                    <svg
                      className="w-4 h-4 text-aqua-pulse"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">
                      No Coding Required
                    </h4>
                    <p className="text-moon-grey/70 text-sm">
                      Our intuitive form handles everything. No need to write
                      smart contracts or understand blockchain.
                    </p>
                  </div>
                </motion.div>
                <motion.div
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-aqua-pulse/20 flex items-center justify-center mt-0.5">
                    <svg
                      className="w-4 h-4 text-aqua-pulse"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">
                      Instant Launch
                    </h4>
                    <p className="text-moon-grey/70 text-sm">
                      Your market goes live in seconds. No waiting for approvals
                      or complex deployment processes.
                    </p>
                  </div>
                </motion.div>
                <motion.div
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-aqua-pulse/20 flex items-center justify-center mt-0.5">
                    <svg
                      className="w-4 h-4 text-aqua-pulse"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">
                      Automatic Liquidity
                    </h4>
                    <p className="text-moon-grey/70 text-sm">
                      LMSR provides continuous liquidity for every market.
                      Traders can buy and sell instantly, no market makers
                      needed.
                    </p>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Right side - Visual Example */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative bg-graphite-deep rounded-3xl border border-white/10 p-8 lg:p-10 shadow-2xl">
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-radial-iris opacity-10 blur-3xl -z-10" />

                {/* Example market creation form preview */}
                <div className="space-y-6">
                  <div>
                    <div className="text-xs text-moon-grey/50 uppercase tracking-wider mb-2">
                      Step 1: Ask Your Question
                    </div>
                    <div className="bg-graphite-light rounded-xl p-4 border border-white/5">
                      <div className="text-white font-medium">
                        Will Bitcoin reach $100k by 2025?
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-moon-grey/50 uppercase tracking-wider mb-2">
                      Step 2: Set Options
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-neon-iris/20 to-neon-iris/10 rounded-xl p-4 border border-neon-iris/30">
                        <div className="text-white font-medium text-sm">
                          YES
                        </div>
                      </div>
                      <div className="bg-graphite-light rounded-xl p-4 border border-white/5">
                        <div className="text-white font-medium text-sm">NO</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-moon-grey/50 uppercase tracking-wider mb-2">
                      Step 3: Launch
                    </div>
                    <motion.div
                      className="bg-gradient-brand rounded-xl p-4 text-center cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="text-white font-semibold">
                        Create Market →
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* Floating success indicator */}
                <motion.div
                  className="absolute -top-4 -right-4 bg-aqua-pulse text-ink-black rounded-full w-16 h-16 flex items-center justify-center font-bold text-xl shadow-lg shadow-aqua-pulse/30"
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  ✓
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== INTERACTIVE TUTORIAL ===== */}
      <InteractiveTutorial />

      {/* ===== TRENDING MARKETS GRID ===== */}
      {/* Markets section - background gradients sync with ring */}
      <section className="section-padding bg-ink-black relative overflow-hidden py-20 lg:py-28">
        {/* Background effects */}
        <motion.div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial-iris opacity-[0.03] blur-3xl" />
        <motion.div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-radial-aqua opacity-[0.03] blur-3xl" />

        {/* Large background text */}
        <motion.div
          className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/4 pointer-events-none"
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[20rem] font-black text-white/[0.02] leading-none tracking-[-0.04em] whitespace-nowrap">
            TRADING
          </h2>
        </motion.div>

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-between items-end mb-10 lg:mb-12"
          >
            <div>
              <motion.h2
                className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-3 lg:mb-4 tracking-tight"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              >
                Trending{" "}
                <motion.span
                  className="bg-gradient-to-r from-neon-iris to-aqua-pulse bg-clip-text text-transparent bg-[length:200%_100%]"
                  style={{
                    backgroundPosition: `${
                      (gradientAngle * 57.2958) % 360
                    }% 0%`,
                  }}
                >
                  Markets
                </motion.span>
              </motion.h2>
              <p className="text-base sm:text-lg text-moon-grey/80 font-light tracking-wide">
                High-volume markets where traders are making moves
              </p>
            </div>
            <Link
              to="/markets"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-neon-iris hover:text-neon-iris-light hover:bg-neon-iris/10 font-medium transition-all duration-300 group border border-transparent hover:border-neon-iris/20"
            >
              View All
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </motion.div>

          {!isLoading && trendingMarkets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
              {trendingMarkets.slice(0, 3).map((market) => (
                <div key={market.id}>
                  <MarketCard market={market} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="card animate-pulse h-64 rounded-2xl overflow-hidden"
                >
                  <div className="h-4 w-24 bg-graphite-hover rounded mb-4" />
                  <div className="h-6 w-3/4 bg-graphite-hover rounded mb-2" />
                  <div className="h-6 w-2/3 bg-graphite-light rounded" />
                </div>
              ))}
            </div>
          )}

          <motion.div
            className="mt-8 text-center sm:hidden"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <Link
              to="/markets"
              className="px-8 py-4 text-lg font-semibold bg-neon-iris text-white rounded-2xl hover:bg-neon-iris-light transition-all"
            >
              View All Markets
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== CREATE IN 3 SIMPLE STEPS ===== */}
      {/* Section aligns to ring arc - radial layout */}
      <section className="section-padding bg-graphite-deep relative overflow-hidden py-20 lg:py-28">
        {/* Enhanced background decoration */}
        <motion.div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial-iris opacity-[0.04] blur-3xl" />
        <motion.div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-radial-aqua opacity-[0.04] blur-3xl" />
        <motion.div className="absolute inset-0 bg-grid opacity-[0.02]" />

        {/* Large background text */}
        <motion.div
          className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 pointer-events-none"
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[20rem] font-black text-white/[0.02] leading-none tracking-[-0.04em] whitespace-nowrap">
            CREATE
          </h2>
        </motion.div>

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-10 lg:mb-12"
          >
            <motion.h2
              className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-3 lg:mb-4 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              Create Markets in{" "}
              <motion.span
                className="bg-gradient-to-r from-neon-iris to-aqua-pulse bg-clip-text text-transparent bg-[length:200%_100%]"
                style={{
                  backgroundPosition: `${(gradientAngle * 57.2958) % 360}% 0%`,
                }}
              >
                3 Simple Steps
              </motion.span>
            </motion.h2>
            <p className="text-base sm:text-lg lg:text-xl text-moon-grey/80 font-light max-w-2xl mx-auto tracking-wide">
              No coding required. No complex setup. Just ask a question and
              launch your market in seconds.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mt-8 lg:mt-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <StepCard
                step={1}
                title="Ask Your Question"
                description="Type your prediction question—anything from sports to politics to crypto. Add a description and choose when it expires."
                index={0}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <StepCard
                step={2}
                title="Set Options & Image"
                description="Choose YES/NO or add custom options. Upload a cover image to make your market stand out. That's it—no technical knowledge needed."
                index={1}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <StepCard
                step={3}
                title="Launch & Trade"
                description="Add initial liquidity and your market goes live instantly on Solana. Traders can start buying shares immediately—no waiting, no approval process."
                index={2}
              />
            </motion.div>
          </div>

          {/* CTA Button */}
          <motion.div
            className="mt-12 lg:mt-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to={user ? "/create" : "/login"}
              className="inline-flex items-center gap-3 px-10 py-5 text-lg font-semibold bg-gradient-brand text-white rounded-2xl hover:shadow-lg hover:shadow-neon-iris/30 transition-all"
            >
              <svg
                className="w-6 h-6"
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
              {user ? "Create Your Market Now" : "Get Started Free"}
            </Link>
          </motion.div>

          {/* Connecting line on desktop */}
          <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-[1px] bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent -z-10" />
        </div>
      </section>

      <GradientDivider animated className="max-w-4xl mx-auto opacity-60" />

      {/* ===== LMSR DEEP DIVE ===== */}
      {/* LMSR section - gradients sync with ring */}
      <section className="section-padding bg-ink-black relative overflow-hidden py-20 lg:py-28">
        {/* Background effects */}
        <motion.div className="absolute top-1/4 left-0 w-96 h-96 bg-gradient-radial-iris opacity-[0.03] blur-3xl" />
        <motion.div className="absolute bottom-1/4 right-0 w-96 h-96 bg-gradient-radial-aqua opacity-[0.03] blur-3xl" />

        <div className="section-container relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Animation side - use simpler version for better performance */}
            <motion.div
              className="order-2 lg:order-1"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative">
                <LMSRAnimationSimple />
                {/* Glow effect around animation */}
                <div className="absolute inset-0 bg-gradient-radial-iris opacity-20 blur-3xl -z-10" />
              </div>
            </motion.div>

            {/* Content side */}
            <motion.div
              className="order-1 lg:order-2"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-neon-iris/10 border border-neon-iris/20 rounded-full text-neon-iris text-sm font-medium mb-6"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-iris opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-iris" />
                </span>
                Technology
              </motion.div>
              <motion.h2
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 1,
                  delay: 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                Engineered with{" "}
                <motion.span
                  className="bg-gradient-to-r from-neon-iris to-aqua-pulse bg-clip-text text-transparent bg-[length:200%_100%]"
                  style={{
                    backgroundPosition: `${
                      (gradientAngle * 57.2958) % 360
                    }% 0%`,
                  }}
                >
                  LMSR
                </motion.span>{" "}
                Liquidity
              </motion.h2>
              <motion.p
                className="text-base sm:text-lg text-moon-grey/80 mb-6 lg:mb-8 leading-relaxed tracking-wide"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 1,
                  delay: 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                The Logarithmic Market Scoring Rule delivers perpetual
                liquidity, razor-thin spreads, and mathematically precise price
                discovery—no order books required.
              </motion.p>

              <div className="mt-8 lg:mt-10 space-y-3 lg:space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <FeaturePoint
                    title="Always-On Liquidity"
                    description="Trade instantly against our automated market maker—no counterparty matching, no slippage concerns"
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: 0.3,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <FeaturePoint
                    title="Probability-Based Pricing"
                    description="Market prices directly reflect collective probability estimates—pure information aggregation"
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <FeaturePoint
                    title="Infinite Depth"
                    description="Execute trades of any size, anytime—LMSR guarantees liquidity even in nascent markets"
                  />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== RESOLVER REPUTATION ===== */}

      {/* ===== FEATURES GRID ===== */}
      {/* Features section - radial layout synced with ring */}
      <section className="section-padding bg-graphite-deep relative overflow-hidden py-20 lg:py-28">
        {/* Background decoration */}
        <motion.div className="absolute inset-0 bg-grid opacity-[0.02]" />
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-neon-iris/20 to-transparent"
          style={{
            backgroundPosition: `${(gradientAngle * 57.2958) % 360}% 0%`,
          }}
        />

        {/* Large background text */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[18rem] font-black text-white/[0.02] leading-none tracking-[-0.04em] whitespace-nowrap">
            FUTURE
          </h2>
        </motion.div>

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-10 lg:mb-12"
          >
            <motion.h2
              className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-3 lg:mb-4 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              Why Create on{" "}
              <motion.span
                className="bg-gradient-to-r from-neon-iris to-aqua-pulse bg-clip-text text-transparent bg-[length:200%_100%]"
                style={{
                  backgroundPosition: `${(gradientAngle * 57.2958) % 360}% 0%`,
                }}
              >
                Moodring?
              </motion.span>
            </motion.h2>
            <p className="text-base sm:text-lg lg:text-xl text-moon-grey/80 font-light max-w-2xl mx-auto tracking-wide">
              The easiest way to launch prediction markets. Built for creators,
              not just traders.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 mt-8 lg:mt-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <FeatureCard
                icon="⚡"
                title="Instant Launch"
                description="Your market goes live in seconds on Solana. No waiting for approvals, no complex deployment—just create and launch."
                index={0}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <FeatureCard
                icon="🎯"
                title="Zero Technical Skills"
                description="No coding, no smart contracts, no blockchain knowledge required. Our simple form handles everything—you just fill it out."
                index={1}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <FeatureCard
                icon="💧"
                title="Built-In Liquidity"
                description="LMSR provides automatic liquidity for every market. No need to find market makers—traders can buy and sell instantly."
                index={2}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      {/* Final section - resolves visual system calmly, synced with ring */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        {/* Enhanced gradient background - syncs with ring rotation */}
        <motion.div
          className="absolute inset-0 bg-gradient-brand opacity-90"
          style={{
            background: `linear-gradient(${
              135 + gradientAngle * 57.2958
            }deg, #7c4dff 0%, #21f6d2 100%)`,
          }}
          animate={{
            opacity: [0.85, 0.95, 0.85],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0),rgba(0,0,0,0.4))]" />

        {/* Animated mesh pattern */}
        <motion.div
          className="absolute inset-0 bg-grid opacity-10"
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />

        {/* Floating orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, -40, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />

        <div className="relative section-container text-center z-10">
          <motion.h2
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-white mb-6 lg:mb-8 leading-[0.95] tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            Ready to Create
            <br />
            <span className="bg-gradient-to-r from-white via-white/95 to-white bg-clip-text text-transparent">
              Your First Market?
            </span>
          </motion.h2>
          <motion.p
            className="text-base sm:text-lg lg:text-xl xl:text-2xl text-white/80 mb-8 lg:mb-10 max-w-2xl mx-auto leading-relaxed font-light tracking-wide"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            Join thousands of creators launching prediction markets on Moodring.
            Turn any question into a market in seconds—no technical skills
            required.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to={user ? "/create" : "/login"}
              className="px-8 py-4 text-lg font-semibold bg-white text-neon-iris hover:bg-moon-grey-light rounded-2xl transition-all inline-flex items-center gap-2 shadow-lg"
            >
              Create Your Market
              <svg
                className="w-5 h-5 transition-transform group-hover:rotate-90"
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
            </Link>
            <Link
              to="/markets"
              className="px-8 py-4 text-lg font-semibold bg-graphite-deep text-white border border-white/10 rounded-2xl hover:bg-graphite-hover hover:border-white/20 transition-all inline-flex items-center gap-2"
            >
              Browse Markets
              <svg
                className="w-5 h-5 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

// ===== HELPER COMPONENTS =====
// Memoized to prevent unnecessary re-renders

const AnimatedStatCard = memo(
  ({
    value,
    label,
    icon,
    delay = 0,
  }: {
    value: string;
    label: string;
    icon?: string;
    delay?: number;
  }) => (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, scale: 1.02 }}
    >
      <div className="relative text-center p-6 sm:p-8 rounded-2xl bg-graphite-deep border border-white/[0.05] hover:border-neon-iris/30 transition-all duration-500 hover:shadow-card-hover backdrop-blur-sm">
        {/* Gradient top border on hover */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-neon-iris/0 to-transparent group-hover:via-neon-iris/50 transition-all duration-500 rounded-t-2xl" />

        {/* Subtle corner accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-neon-iris/0 group-hover:border-neon-iris/20 rounded-tl-2xl transition-all duration-500" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-neon-iris/0 group-hover:border-neon-iris/20 rounded-tr-2xl transition-all duration-500" />

        {icon && (
          <motion.div
            className="text-3xl mb-4 flex justify-center"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            {icon}
          </motion.div>
        )}
        <div className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white tabular-nums mb-3 leading-none">
          {value}
        </div>
        <div className="text-moon-grey/70 text-[10px] sm:text-xs uppercase tracking-[0.15em] font-semibold">
          {label}
        </div>

        {/* Enhanced glow effect on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-radial-iris opacity-0 group-hover:opacity-[0.12] blur-2xl transition-opacity duration-500 pointer-events-none -z-10" />

        {/* Subtle inner glow */}
        <div className="absolute inset-[1px] rounded-2xl bg-gradient-to-br from-neon-iris/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      </div>
    </motion.div>
  )
);
AnimatedStatCard.displayName = "AnimatedStatCard";

const FeaturePoint = memo(
  ({ title, description }: { title: string; description: string }) => (
    <div className="group relative overflow-hidden flex items-start gap-4 lg:gap-5 p-5 lg:p-6 rounded-xl bg-graphite-deep border border-white/[0.05] hover:border-neon-iris/30 transition-all duration-500 hover:shadow-lg hover:shadow-neon-iris/10">
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-neon-iris/0 group-hover:via-neon-iris/50 to-transparent transition-all duration-500 rounded-t-xl" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/0 group-hover:via-neon-iris/25 to-transparent transition-all duration-500 rounded-b-xl" />
      <motion.div
        className="w-2 h-2 rounded-full bg-aqua-pulse mt-2.5 flex-shrink-0 shadow-lg shadow-aqua-pulse/50"
        animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="flex-1">
        <h4 className="font-semibold text-white mb-2 group-hover:text-neon-iris-light transition-colors duration-500 text-base lg:text-lg">
          {title}
        </h4>
        <p className="text-moon-grey/80 text-sm leading-relaxed tracking-wide">
          {description}
        </p>
      </div>
      {/* Enhanced hover glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-radial-iris opacity-0 group-hover:opacity-[0.06] blur-2xl transition-opacity duration-500 pointer-events-none -z-10" />
      <div className="absolute inset-[1px] rounded-xl bg-gradient-to-br from-neon-iris/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  )
);
FeaturePoint.displayName = "FeaturePoint";
