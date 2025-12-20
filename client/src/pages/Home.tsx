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
import { formatNumber, formatUSDC } from "@/utils/format";
import {
  HeroTitle,
  HeroSubtitle,
  HeroBadge,
  GradientDivider,
  SectionHeader,
  StepCard,
  FeatureCard,
  LMSRAnimationSimple,
} from "@/components/brand";

export const Home = () => {
  const { markets, setMarkets } = useMarketStore();
  const { user, isInitializing } = useUserStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      <section className="relative min-h-[90vh] flex flex-col overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-ink-black" />

        {/* Enhanced mesh gradient background */}
        <div className="absolute inset-0 bg-mesh" />

        {/* Animated grid pattern overlay */}
        <motion.div
          className="absolute inset-0 bg-grid opacity-40"
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />

        {/* Enhanced gradient orbs with animation */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-radial-iris opacity-25 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-radial-aqua opacity-20 blur-3xl"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-radial-iris opacity-10 blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: ["-50%", "-45%", "-50%"],
            y: ["-50%", "-55%", "-50%"],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />

        {/* Floating particles */}
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-neon-iris/40"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 30}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          />
        ))}

        {/* Hero content */}
        <div className="relative flex-1 flex flex-col justify-center section-container py-20 lg:py-32 z-10">
          <div className="max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <HeroBadge>Live on Solana</HeroBadge>
            </motion.div>

            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <HeroTitle size="lg">
                <span className="text-white">The Future of</span>
                <br />
                <span className="text-gradient">
                  On-Chain Prediction Markets
                </span>
              </HeroTitle>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <HeroSubtitle className="mt-8 max-w-2xl" delay={0.3}>
                Moodring is Solana-native prediction infrastructure with calm
                precision. Trade on future events with deep LMSR liquidity and
                instant settlement.
              </HeroSubtitle>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 mt-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Link
                to="/markets"
                className="btn btn-primary btn-lg group relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {user ? "Browse Markets" : "Start Trading"}
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
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-neon-iris-light to-aqua-pulse opacity-0 group-hover:opacity-100"
                  transition={{ duration: 0.3 }}
                />
              </Link>
              <Link
                to="/leaderboard"
                className="btn btn-secondary btn-lg group hover:border-neon-iris/50 transition-all"
              >
                <span className="flex items-center gap-2">
                  View Leaderboard
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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </span>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
            <motion.div
              className="w-1.5 h-1.5 bg-white/60 rounded-full"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      <GradientDivider animated className="max-w-4xl mx-auto" />

      {/* ===== STATS SECTION ===== */}
      <section className="relative py-20 bg-graphite-deep overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-iris/5 to-transparent" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-3">
              Platform <span className="text-gradient">Statistics</span>
            </h2>
            <p className="text-moon-grey text-lg">
              Real-time metrics from the Moodring ecosystem
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            <AnimatedStatCard
              value={stats ? formatUSDC(stats.total_volume) : "$--"}
              label="Total Volume"
              icon="💰"
              delay={0}
            />
            <AnimatedStatCard
              value={stats ? formatNumber(stats.active_markets || 0) : "--"}
              label="Active Markets"
              icon="📊"
              delay={0.1}
            />
            <AnimatedStatCard
              value={stats ? formatNumber(stats.total_users) : "--"}
              label="Traders"
              icon="👥"
              delay={0.2}
            />
            <AnimatedStatCard
              value={stats ? formatNumber(stats.total_trades) : "--"}
              label="Total Trades"
              icon="⚡"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* ===== TRENDING MARKETS GRID ===== */}
      <section className="section-padding bg-ink-black relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial-iris opacity-5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-radial-aqua opacity-5 blur-3xl" />

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex justify-between items-end mb-12"
          >
            <div>
              <SectionHeader
                title="Trending Now"
                subtitle="Popular markets sorted by 24h volume"
                animated={false}
              />
            </div>
            <Link
              to="/markets"
              className="hidden sm:inline-flex items-center gap-2 text-neon-iris hover:text-neon-iris-light font-medium transition-all group"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingMarkets.slice(0, 6).map((market, index) => (
                <motion.div
                  key={market.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -8 }}
                  className="transition-all duration-300"
                >
                  <MarketCard market={market} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card animate-pulse h-64">
                  <div className="h-4 w-24 bg-graphite-hover rounded mb-4" />
                  <div className="h-6 w-3/4 bg-graphite-hover rounded mb-2" />
                  <div className="h-6 w-2/3 bg-graphite-light rounded" />
                </div>
              ))}
            </div>
          )}

          <motion.div
            className="mt-12 text-center sm:hidden"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <Link to="/markets" className="btn btn-primary">
              View All Markets
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="section-padding bg-graphite-deep relative overflow-hidden">
        {/* Enhanced background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial-iris opacity-10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-radial-aqua opacity-10 blur-3xl" />
        <div className="absolute inset-0 bg-grid opacity-5" />

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SectionHeader
              title="How Moodring Works"
              subtitle="Start trading on predictions in just a few simple steps"
              align="center"
              size="lg"
            />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16 mt-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <StepCard
                step={1}
                title="Create Markets"
                description="Define a question, set outcomes, and provide initial liquidity. Markets go live instantly on Solana."
                index={0}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <StepCard
                step={2}
                title="Trade Outcomes"
                description="Buy YES or NO shares based on your prediction. LMSR ensures fair pricing and deep liquidity."
                index={1}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <StepCard
                step={3}
                title="Resolve & Earn"
                description="When events conclude, bonded resolvers determine outcomes. Winners receive payouts instantly."
                index={2}
              />
            </motion.div>
          </div>

          {/* Connecting line on desktop */}
          <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent -z-10" />
        </div>
      </section>

      <GradientDivider animated className="max-w-4xl mx-auto" />

      {/* ===== LMSR DEEP DIVE ===== */}
      <section className="section-padding bg-ink-black relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-gradient-radial-iris opacity-5 blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-gradient-radial-aqua opacity-5 blur-3xl" />

        <div className="section-container relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
            {/* Animation side - use simpler version for better performance */}
            <motion.div
              className="order-2 lg:order-1"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
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
              transition={{ duration: 0.8 }}
            >
              <SectionHeader
                badge="Technology"
                title={
                  <>
                    Powered by <span className="text-gradient">LMSR</span>{" "}
                    Liquidity
                  </>
                }
                subtitle="Logarithmic Market Scoring Rule ensures infinite liquidity, tight spreads, and mathematically optimal price discovery."
                animated={true}
              />

              <div className="mt-10 space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <FeaturePoint
                    title="No Order Books"
                    description="Trade instantly against the AMM - no waiting for counterparties"
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <FeaturePoint
                    title="Fair Pricing"
                    description="Prices reflect true probability based on market activity"
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <FeaturePoint
                    title="Deep Liquidity"
                    description="Always execute trades, even in low-volume markets"
                  />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== RESOLVER REPUTATION ===== */}

      {/* ===== FEATURES GRID ===== */}
      <section className="section-padding bg-graphite-deep relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid opacity-5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SectionHeader
              title="Why Choose Moodring?"
              subtitle="Built for traders who want the best prediction market experience"
              align="center"
            />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mt-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <FeatureCard
                icon="⚡"
                title="Lightning Fast"
                description="Built on Solana for instant trades and minimal fees. No waiting for block confirmations."
                index={0}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <FeatureCard
                icon="🔒"
                title="Simple & Secure"
                description="Trade instantly without signing transactions. Your funds are secured in our custodial system."
                index={1}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <FeatureCard
                icon="📊"
                title="Deep Liquidity"
                description="LMSR-powered markets ensure tight spreads and efficient price discovery on every trade."
                index={2}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <FeatureCard
                icon="🎙️"
                title="Live Rooms"
                description="Join real-time audio discussions about markets and connect with other traders."
                index={3}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <FeatureCard
                icon="🏆"
                title="Leaderboards"
                description="Compete with top traders and climb the ranks. Show off your prediction skills."
                index={4}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="relative overflow-hidden py-32">
        {/* Enhanced gradient background */}
        <motion.div
          className="absolute inset-0 bg-gradient-brand opacity-90"
          animate={{
            background: [
              "linear-gradient(135deg, #7c4dff 0%, #21f6d2 100%)",
              "linear-gradient(135deg, #9c7aff 0%, #21f6d2 100%)",
              "linear-gradient(135deg, #7c4dff 0%, #21f6d2 100%)",
            ],
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
            className="text-4xl lg:text-6xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Ready to Start <span className="text-white/90">Trading?</span>
          </motion.h2>
          <motion.p
            className="text-xl text-white/90 mb-12 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Join thousands of traders making predictions on real-world events.
            Experience the future of decentralized prediction markets.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Link
              to="/markets"
              className="btn bg-white text-neon-iris hover:bg-moon-grey-light btn-lg font-semibold shadow-2xl group relative overflow-hidden transition-all hover:scale-105"
            >
              <span className="relative z-10 flex items-center gap-2">
                Explore Markets
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
              </span>
            </Link>
            <Link
              to="/create"
              className="btn btn-outline-gradient btn-lg font-semibold group hover:scale-105 transition-all"
            >
              <span className="flex items-center gap-2">
                Create Market
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
              </span>
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
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -5 }}
    >
      <div className="relative text-center p-6 rounded-2xl bg-graphite-deep border border-white/5 hover:border-neon-iris/30 transition-all duration-300 hover:shadow-lg hover:shadow-neon-iris/20">
        {/* Gradient top border on hover */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/0 to-transparent group-hover:via-neon-iris/50 transition-all duration-300" />

        {icon && (
          <div className="text-3xl mb-3 flex justify-center">{icon}</div>
        )}
        <div className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white tabular-nums mb-2 truncate">
          {value}
        </div>
        <div className="text-moon-grey text-xs sm:text-sm uppercase tracking-wider truncate">
          {label}
        </div>

        {/* Glow effect on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-radial-iris opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-300 pointer-events-none" />
      </div>
    </motion.div>
  )
);
AnimatedStatCard.displayName = "AnimatedStatCard";

const FeaturePoint = memo(
  ({ title, description }: { title: string; description: string }) => (
    <div className="group relative overflow-hidden flex items-start gap-4 p-5 rounded-xl bg-graphite-deep border border-white/5 hover:border-neon-iris/30 transition-all duration-300">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/0 group-hover:via-neon-iris/50 to-transparent transition-all duration-300" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/0 group-hover:via-neon-iris/30 to-transparent transition-all duration-300" />
      <motion.div
        className="w-2 h-2 rounded-full bg-aqua-pulse mt-2 flex-shrink-0"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="flex-1">
        <h4 className="font-semibold text-white mb-1 group-hover:text-neon-iris-light transition-colors">
          {title}
        </h4>
        <p className="text-moon-grey text-sm leading-relaxed">{description}</p>
      </div>
      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-radial-iris opacity-0 group-hover:opacity-5 blur-xl transition-opacity duration-300 pointer-events-none" />
    </div>
  )
);
FeaturePoint.displayName = "FeaturePoint";
