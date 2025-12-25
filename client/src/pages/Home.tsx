import { useEffect, useState, memo, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, useMotionValue } from "framer-motion";
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
  GradientProbabilityRing,
  GradientProbabilityRingRef,
} from "@/components/brand";

export const Home = () => {
  const { markets, setMarkets } = useMarketStore();
  const { user, isInitializing } = useUserStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const ringRef = useRef<GradientProbabilityRingRef>(null);
  const [gradientAngle, setGradientAngle] = useState(0);
  const rotationUpdateTimeoutRef = useRef<number | null>(null);

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

  // Cleanup rotation update timeout on unmount
  useEffect(() => {
    return () => {
      if (rotationUpdateTimeoutRef.current !== null) {
        cancelAnimationFrame(rotationUpdateTimeoutRef.current);
      }
    };
  }, []);

  const trendingMarkets = markets.slice(0, 12);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  // Ring rotation sync handler - throttled to reduce re-renders
  const handleRingRotationUpdate = useCallback(
    (_rotation: number, angle: number) => {
      // Throttle updates to ~30fps instead of 60fps to reduce re-renders
      if (rotationUpdateTimeoutRef.current === null) {
        rotationUpdateTimeoutRef.current = window.requestAnimationFrame(() => {
          setGradientAngle(angle);
          rotationUpdateTimeoutRef.current = null;
        });
      }
    },
    []
  );

  // Parallax effects for background elements - sync with ring rotation
  const orb1Y = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const orb2Y = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const orb3Y = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const gridY = useTransform(scrollYProgress, [0, 1], [0, -50]);

  // Background gradient rotation sync with ring - memoized to prevent unnecessary recalculations
  const backgroundRotationDegrees = useMemo(
    () => gradientAngle * 57.2958,
    [gradientAngle]
  );
  const backgroundRotation = useMotionValue(0);
  useEffect(() => {
    backgroundRotation.set(backgroundRotationDegrees);
  }, [backgroundRotationDegrees, backgroundRotation]);

  return (
    <div className="overflow-hidden">
      {/* ===== HERO SECTION ===== */}
      <section
        className="relative min-h-screen flex flex-col overflow-hidden"
        style={{
          contain: "layout style paint",
          transform: "translateZ(0)", // Force GPU acceleration
        }}
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-ink-black" />

        {/* Enhanced mesh gradient background */}
        <div className="absolute inset-0 bg-mesh" />

        {/* Gradient Probability Ring - Design system primitive */}
        <GradientProbabilityRing
          ref={ringRef}
          className="z-0"
          onRotationUpdate={handleRingRotationUpdate}
        />

        {/* Animated grid pattern overlay with parallax */}
        <motion.div
          className="absolute inset-0 bg-grid opacity-40"
          style={{
            y: gridY,
            willChange: "transform",
          }}
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "linear",
          }}
        />

        {/* Enhanced gradient orbs - rotate in harmony with ring */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-radial-iris opacity-25 blur-3xl"
          style={{
            y: orb1Y,
            rotate: backgroundRotation,
            transformOrigin: "center center",
            willChange: "transform, opacity",
          }}
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
          style={{
            y: orb2Y,
            rotate: backgroundRotation,
            transformOrigin: "center center",
            willChange: "transform, opacity",
          }}
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
          style={{
            y: orb3Y,
            rotate: backgroundRotation,
            transformOrigin: "center center",
            willChange: "transform",
          }}
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
              willChange: "transform, opacity",
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
        <motion.div
          style={{
            y: heroY,
            opacity: heroOpacity,
            willChange: "transform, opacity",
          }}
          className="relative flex-1 flex flex-col justify-center section-container py-20 lg:py-32 z-10"
        >
          <div className="max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <HeroBadge>Live on Solana</HeroBadge>
            </motion.div>

            {/* Massive Hero Title */}
            <motion.div
              className="mt-16 lg:mt-20"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ willChange: "transform, opacity" }}
            >
              <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[10rem] font-black leading-[0.92] tracking-[-0.02em]">
                <motion.span
                  className="block text-white mb-1"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{ willChange: "transform, opacity" }}
                >
                  PREDICT
                </motion.span>
                <motion.span
                  className="block bg-gradient-to-r from-neon-iris via-aqua-pulse to-neon-iris bg-clip-text text-transparent bg-[length:200%_100%]"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.35,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{
                    backgroundPosition: `${
                      backgroundRotationDegrees % 360
                    }% 0%`,
                    willChange: "transform, opacity, background-position",
                  }}
                >
                  THE FUTURE
                </motion.span>
                <motion.span
                  className="block text-white/70 text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl mt-6 font-light tracking-wide"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{ willChange: "transform, opacity" }}
                >
                  Own The Outcome
                </motion.span>
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.65,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="mt-10 lg:mt-14 max-w-2xl"
              style={{ willChange: "transform, opacity" }}
            >
              <p className="text-base sm:text-lg lg:text-xl xl:text-2xl text-moon-grey/90 leading-relaxed font-light tracking-wide">
                The premier Solana prediction market platform. Trade on
                real-world events with{" "}
                <span className="text-white font-medium">
                  institutional grade liquidity
                </span>
                ,{" "}
                <span className="text-white font-medium">
                  instant execution
                </span>
                , and{" "}
                <span className="text-white font-medium">
                  transparent outcomes.{" "}
                </span>
              </p>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 lg:gap-5 mt-12 lg:mt-14"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.8,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ willChange: "transform, opacity" }}
            >
              <Link
                to="/markets"
                className="btn btn-primary btn-lg group relative overflow-hidden px-8 py-4 text-base font-semibold tracking-wide hover:scale-105 active:scale-100 transition-transform"
              >
                <span className="relative z-10 flex items-center gap-2.5">
                  {user ? "Browse Markets" : "Start Trading"}
                  <motion.svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    whileHover={{ x: 4 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </motion.svg>
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-neon-iris-light to-aqua-pulse opacity-0 group-hover:opacity-100"
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              </Link>
              <Link
                to="/leaderboard"
                className="btn btn-secondary btn-lg group px-8 py-4 text-base font-semibold tracking-wide border-white/10 hover:border-neon-iris/40 hover:scale-105 active:scale-100 transition-all duration-300"
              >
                <span className="flex items-center gap-2.5">
                  View Leaderboard
                  <motion.svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    whileHover={{ x: 4 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </motion.svg>
                </span>
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10"
          style={{ willChange: "transform" }}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-5 h-8 border border-white/20 rounded-full flex items-start justify-center p-1.5 backdrop-blur-sm bg-white/5">
            <motion.div
              className="w-1.5 h-1.5 bg-white/60 rounded-full shadow-lg shadow-white/20"
              animate={{ y: [0, 10, 0], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </section>

      <GradientDivider animated className="max-w-4xl mx-auto opacity-60" />

      {/* ===== BIG DISPLAY TEXT SECTION ===== */}
      <section className="relative py-24 lg:py-32 bg-ink-black overflow-hidden">
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
            <motion.p
              className="text-lg sm:text-xl lg:text-2xl xl:text-3xl text-white/50 font-light mt-6 lg:mt-8 max-w-2xl mx-auto tracking-wide"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              Trade the truth.
            </motion.p>
          </div>
        </motion.div>
      </section>

      {/* ===== STATS SECTION ===== */}
      {/* Stats align to ring arc - radial positioning */}
      <section className="relative py-32 lg:py-40 bg-graphite-deep overflow-hidden">
        {/* Background decoration - sync with ring rotation */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-iris/[0.03] to-transparent"
          style={{
            rotate: backgroundRotation,
            transformOrigin: "center center",
          }}
        />
        <motion.div
          className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent"
          style={{
            backgroundPosition: `${(gradientAngle * 57.2958) % 360}% 0%`,
          }}
        />

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-20"
          >
            <motion.h2
              className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              Platform{" "}
              <motion.span
                className="bg-gradient-to-r from-neon-iris to-aqua-pulse bg-clip-text text-transparent bg-[length:200%_100%]"
                style={{
                  backgroundPosition: `${(gradientAngle * 57.2958) % 360}% 0%`,
                }}
              >
                Performance
              </motion.span>
            </motion.h2>
            <p className="text-lg sm:text-xl text-moon-grey/80 font-light tracking-wide max-w-2xl mx-auto">
              Live metrics powering the world's most advanced prediction markets
            </p>
          </motion.div>

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

      {/* ===== TRENDING MARKETS GRID ===== */}
      {/* Markets section - background gradients sync with ring */}
      <section className="section-padding bg-ink-black relative overflow-hidden py-32 lg:py-40">
        {/* Background effects - rotate with ring */}
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial-iris opacity-[0.03] blur-3xl"
          style={{
            rotate: backgroundRotation,
            transformOrigin: "center center",
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-radial-aqua opacity-[0.03] blur-3xl"
          style={{
            rotate: backgroundRotation,
            transformOrigin: "center center",
          }}
        />

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
            className="flex justify-between items-end mb-16 lg:mb-20"
          >
            <div>
              <motion.h2
                className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-4 lg:mb-6 tracking-tight"
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
              {trendingMarkets.slice(0, 6).map((market) => (
                <div key={market.id}>
                  <MarketCard market={market} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
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
            className="mt-12 text-center sm:hidden"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <Link to="/markets" className="btn btn-primary btn-lg">
              View All Markets
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      {/* Section aligns to ring arc - radial layout */}
      <section className="section-padding bg-graphite-deep relative overflow-hidden py-32 lg:py-40">
        {/* Enhanced background decoration - sync with ring */}
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial-iris opacity-[0.04] blur-3xl"
          style={{
            rotate: backgroundRotation,
            transformOrigin: "center center",
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-radial-aqua opacity-[0.04] blur-3xl"
          style={{
            rotate: backgroundRotation,
            transformOrigin: "center center",
          }}
        />
        <motion.div
          className="absolute inset-0 bg-grid opacity-[0.02]"
          style={{
            backgroundPosition: `${(gradientAngle * 57.2958) % 360}px ${
              (gradientAngle * 57.2958) % 360
            }px`,
          }}
        />

        {/* Large background text */}
        <motion.div
          className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 pointer-events-none"
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[20rem] font-black text-white/[0.02] leading-none tracking-[-0.04em] whitespace-nowrap">
            PREDICT
          </h2>
        </motion.div>

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16 lg:mb-20"
          >
            <motion.h2
              className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-4 lg:mb-6 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              How It{" "}
              <motion.span
                className="bg-gradient-to-r from-neon-iris to-aqua-pulse bg-clip-text text-transparent bg-[length:200%_100%]"
                style={{
                  backgroundPosition: `${(gradientAngle * 57.2958) % 360}% 0%`,
                }}
              >
                Works
              </motion.span>
            </motion.h2>
            <p className="text-base sm:text-lg lg:text-xl text-moon-grey/80 font-light max-w-2xl mx-auto tracking-wide">
              From market creation to payout—here's how prediction markets
              operate
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mt-12 lg:mt-16">
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
                title="Create Markets"
                description="Launch your own prediction market on any event. Set the question, add liquidity, and watch it go live on Solana in seconds."
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
                title="Trade Positions"
                description="Buy YES or NO shares to express your view. Our LMSR algorithm provides continuous liquidity and mathematically optimal pricing."
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
                title="Settle & Profit"
                description="When events resolve, verified outcomes trigger instant payouts. Winners collect their earnings immediately—no delays, no intermediaries."
                index={2}
              />
            </motion.div>
          </div>

          {/* Connecting line on desktop */}
          <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-[1px] bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent -z-10" />
        </div>
      </section>

      <GradientDivider animated className="max-w-4xl mx-auto opacity-60" />

      {/* ===== LMSR DEEP DIVE ===== */}
      {/* LMSR section - gradients sync with ring */}
      <section className="section-padding bg-ink-black relative overflow-hidden py-32 lg:py-40">
        {/* Background effects - rotate with ring */}
        <motion.div
          className="absolute top-1/4 left-0 w-96 h-96 bg-gradient-radial-iris opacity-[0.03] blur-3xl"
          style={{
            rotate: backgroundRotation,
            transformOrigin: "center center",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-0 w-96 h-96 bg-gradient-radial-aqua opacity-[0.03] blur-3xl"
          style={{
            rotate: backgroundRotation,
            transformOrigin: "center center",
          }}
        />

        <div className="section-container relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
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
                className="text-base sm:text-lg text-moon-grey/80 mb-10 lg:mb-12 leading-relaxed tracking-wide"
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
      <section className="section-padding bg-graphite-deep relative overflow-hidden py-32 lg:py-40">
        {/* Background decoration - sync with ring */}
        <motion.div
          className="absolute inset-0 bg-grid opacity-[0.02]"
          style={{
            backgroundPosition: `${(gradientAngle * 57.2958) % 360}px ${
              (gradientAngle * 57.2958) % 360
            }px`,
          }}
        />
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
            className="text-center mb-16 lg:mb-20"
          >
            <motion.h2
              className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-4 lg:mb-6 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              Why{" "}
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
              The platform where serious traders meet cutting-edge
              infrastructure
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-8 mt-12 lg:mt-16">
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
                title="Sub-Second Execution"
                description="Solana's high-performance blockchain delivers instant trades and near-zero fees. Experience the speed of on-chain prediction markets."
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
                icon="🔒"
                title="Enterprise Security"
                description="Trade seamlessly with our custodial infrastructure. Your assets are protected by institutional-grade security protocols."
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
                icon="📊"
                title="Institutional Liquidity"
                description="LMSR algorithms provide continuous liquidity with tight spreads. Trade any size, anytime, with optimal execution."
                index={2}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <FeatureCard
                icon="🎙️"
                title="Live Trading Rooms"
                description="Join real-time audio discussions with fellow traders. Share insights, debate outcomes, and build your network."
                index={3}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <FeatureCard
                icon="🏆"
                title="Competitive Rankings"
                description="Track your performance against the best traders. Climb leaderboards and establish your reputation in the prediction market community."
                index={4}
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

        {/* Floating orbs - subtle rotation sync with ring */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"
          style={{
            rotate: backgroundRotation,
            transformOrigin: "center center",
          }}
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
          style={{
            rotate: backgroundRotation,
            transformOrigin: "center center",
          }}
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
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-white mb-8 lg:mb-10 leading-[0.95] tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            Ready to Trade
            <br />
            <span className="bg-gradient-to-r from-white via-white/95 to-white bg-clip-text text-transparent">
              the Future?
            </span>
          </motion.h2>
          <motion.p
            className="text-base sm:text-lg lg:text-xl xl:text-2xl text-white/80 mb-12 lg:mb-16 max-w-2xl mx-auto leading-relaxed font-light tracking-wide"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            Join a growing community of traders who are turning predictions into
            profits. Experience the next generation of on-chain prediction
            markets—built for speed, security, and scale.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to="/markets"
              className="btn bg-white text-neon-iris hover:bg-moon-grey-light btn-lg font-semibold shadow-2xl group relative overflow-hidden transition-all hover:scale-105 active:scale-100"
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
              className="btn btn-outline-gradient btn-lg font-semibold group hover:scale-105 active:scale-100 transition-all"
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
