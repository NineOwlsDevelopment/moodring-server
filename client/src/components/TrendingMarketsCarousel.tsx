import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Market } from "@/types/market";
import {
  formatUSDC,
  formatTimeRemaining,
  calculateYesPrice,
} from "@/utils/format";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UserAvatar } from "./UserAvatar";

interface TrendingMarketsCarouselProps {
  markets: Market[];
  autoPlayInterval?: number;
  className?: string;
}

/**
 * Trending Markets Carousel - Premier Aesthetic
 *
 * Refined hero carousel with:
 * - Clean, minimal design matching home page
 * - Elegant typography with extralight/light weights
 * - Subtle gradient accents
 * - Smooth animations
 */
export const TrendingMarketsCarousel = ({
  markets,
  autoPlayInterval = 5000,
  className = "",
}: TrendingMarketsCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const minSwipeDistance = 50;

  const goToNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % markets.length);
  }, [markets.length]);

  const goToPrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + markets.length) % markets.length);
  }, [markets.length]);

  const goToSlide = useCallback(
    (index: number) => {
      setDirection(index > currentIndex ? 1 : -1);
      setCurrentIndex(index);
    },
    [currentIndex]
  );

  // Auto-play with pause on hover
  useEffect(() => {
    if (!markets.length || markets.length <= 1 || isPaused) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    autoPlayTimerRef.current = setInterval(goToNext, autoPlayInterval);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [markets.length, isPaused, autoPlayInterval, goToNext]);

  // Touch handlers for mobile swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }
  };

  if (markets.length === 0) {
    return null;
  }

  const currentMarket = markets[currentIndex];

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
    }),
  };

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Section Label */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px w-8 bg-gradient-to-r from-aqua-pulse/60 to-transparent" />
        <span className="text-[10px] tracking-[0.25em] uppercase text-moon-grey/70 font-medium">
          Trending Now
        </span>
        <div className="flex-1 h-px bg-white/5" />
        {/* Dot indicators inline */}
        {markets.length > 1 && (
          <div className="flex gap-1.5">
            {markets.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "w-6 bg-white"
                    : "w-1 bg-white/20 hover:bg-white/30"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main carousel container */}
      <div className="relative overflow-hidden border border-white/5 group select-none">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-iris/0 via-neon-iris/30 to-neon-iris/0" />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentMarket.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <TrendingMarketSlide market={currentMarket} />
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        {markets.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 border border-white/10 bg-ink-black/80 backdrop-blur-sm text-white/60 items-center justify-center hover:bg-graphite-deep hover:text-white hover:border-white/20 transition-all z-20 opacity-0 group-hover:opacity-100 duration-300"
              aria-label="Previous market"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNext}
              className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 border border-white/10 bg-ink-black/80 backdrop-blur-sm text-white/60 items-center justify-center hover:bg-graphite-deep hover:text-white hover:border-white/20 transition-all z-20 opacity-0 group-hover:opacity-100 duration-300"
              aria-label="Next market"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Bottom gradient accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-aqua-pulse/0 via-aqua-pulse/20 to-aqua-pulse/0" />
      </div>
    </div>
  );
};

/**
 * Individual slide component
 */
const TrendingMarketSlide = ({ market }: { market: Market }) => {
  const liquidityParam =
    market.liquidity_parameter || market.base_liquidity_parameter || 0;
  const firstOption = market.options?.[0];
  const yesPrice = firstOption
    ? (firstOption as any).yes_price ??
      calculateYesPrice(
        firstOption.yes_quantity,
        firstOption.no_quantity,
        liquidityParam,
        market.is_resolved
      )
    : 0.5;

  const categoryName =
    market.category || market.categories?.[0]?.name || "General";

  const timeRemaining = formatTimeRemaining(market.expiration_timestamp);

  const backgroundImage = market.image_url
    ? `url(${market.image_url})`
    : "none";

  return (
    <Link to={`/market/${market.id}`} className="block group select-none">
      <div className="relative min-h-[320px] sm:min-h-[360px] md:min-h-[420px] flex flex-col justify-end overflow-hidden">
        {/* Background image with overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage }}
        >
          {/* Fallback gradient if no image */}
          {!market.image_url && (
            <div className="absolute inset-0 bg-gradient-to-br from-neon-iris/15 via-graphite-deep to-aqua-pulse/10" />
          )}
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-black via-ink-black/95 to-ink-black/60" />
        </div>

        {/* Content */}
        <div className="relative z-10 p-6 sm:p-8 md:p-10 lg:p-12">
          {/* Creator and Category row */}
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            {/* Creator info */}
            <div className="flex items-center gap-2">
              {(market.creator_display_name || market.creator_username) && (
                <>
                  <UserAvatar
                    name={
                      market.creator_display_name ||
                      market.creator_username ||
                      "User"
                    }
                    imageUrl={market.creator_avatar_url}
                    size="sm"
                  />
                  <span className="text-xs text-moon-grey/60 font-light">
                    {market.creator_display_name ||
                      (market.creator_username
                        ? `@${market.creator_username}`
                        : "User")}
                  </span>
                  {market.is_admin_creator && (
                    <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-neon-iris flex-shrink-0">
                      <svg
                        className="w-2 h-2 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Category badge */}
            <span className="text-[10px] tracking-[0.2em] uppercase text-neon-iris/80 font-medium">
              {categoryName}
            </span>
          </div>

          {/* Market title */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extralight tracking-[-0.02em] text-white leading-[1.1] mb-8 max-w-4xl">
            {market.question}
          </h2>

          {/* Stats row */}
          <div className="flex flex-wrap items-end justify-between gap-6">
            {/* Left stats */}
            <div className="flex flex-wrap items-center gap-6 sm:gap-10">
              {/* Probability */}
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 mb-1">
                  Probability
                </div>
                <div className="text-2xl sm:text-3xl font-extralight text-white tabular-nums">
                  {(yesPrice * 100).toFixed(1)}%
                </div>
              </div>

              <div className="w-px h-10 bg-white/10 hidden sm:block" />

              {/* Volume */}
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 mb-1">
                  Volume
                </div>
                <div className="text-xl sm:text-2xl font-extralight text-white tabular-nums">
                  {formatUSDC(market.total_volume)}
                </div>
              </div>

              <div className="w-px h-10 bg-white/10 hidden sm:block" />

              {/* Time remaining */}
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 mb-1">
                  Time Left
                </div>
                <div className="text-xl sm:text-2xl font-extralight text-white">
                  {timeRemaining}
                </div>
              </div>
            </div>

            {/* Trade button */}
            <div>
              <span className="inline-flex items-center gap-2 px-6 py-3 bg-white text-ink-black text-sm font-medium tracking-wide uppercase hover:bg-moon-grey-light transition-all group-hover:gap-3">
                Trade
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
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
