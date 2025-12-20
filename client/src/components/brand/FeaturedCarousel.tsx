import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Market } from '@/data/dummyData';
import { formatUSDC, calculateYesPrice, capitalizeWords } from '@/utils/format';
import { ProbabilityBar } from './ProbabilityBar';

interface FeaturedCarouselProps {
  markets: Market[];
  autoPlay?: boolean;
  interval?: number;
  className?: string;
}

/**
 * Featured markets carousel with auto-rotation and swipe support.
 * Displays one market at a time with large, immersive cards.
 */
export const FeaturedCarousel = ({
  markets,
  autoPlay = true,
  interval = 6000,
  className = '',
}: FeaturedCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const goToNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % markets.length);
  }, [markets.length]);

  const goToPrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + markets.length) % markets.length);
  }, [markets.length]);

  const goToSlide = useCallback((index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay || markets.length <= 1) return;
    
    const timer = setInterval(goToNext, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, goToNext, markets.length]);

  if (markets.length === 0) {
    return null;
  }

  const currentMarket = markets[currentIndex];

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main carousel container */}
      <div className="relative overflow-hidden rounded-3xl bg-graphite-deep border border-white/5">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentMarket.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <FeaturedCard market={currentMarket} />
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        {markets.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-graphite-hover/80 backdrop-blur-sm border border-white/10 text-white flex items-center justify-center hover:bg-graphite-light transition-colors z-10"
              aria-label="Previous market"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-graphite-hover/80 backdrop-blur-sm border border-white/10 text-white flex items-center justify-center hover:bg-graphite-light transition-colors z-10"
              aria-label="Next market"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Dot indicators */}
      {markets.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {markets.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'w-6 bg-gradient-brand-horizontal'
                  : 'w-2 bg-graphite-hover hover:bg-moon-grey-dark'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FeaturedCard = ({ market }: { market: Market }) => {
  const liquidityParam = market.liquidity_parameter || market.base_liquidity_parameter || 0;
  const firstOption = market.options?.[0];
  const yesPrice = firstOption
    ? (firstOption.yes_price ?? calculateYesPrice(
        firstOption.yes_quantity,
        firstOption.no_quantity,
        liquidityParam,
        market.is_resolved
      ))
    : 0.5;

  const categoryName = market.category || market.categories?.[0]?.name || 'General';

  return (
    <Link to={`/market/${market.id}`} className="block group">
      <div className="relative p-8 lg:p-10 min-h-[320px] flex flex-col justify-between">
        {/* Background gradient orb */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial-iris opacity-30 blur-3xl pointer-events-none" />
        
        {/* Category badge */}
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-neon-iris/10 border border-neon-iris/20 rounded-full text-neon-iris text-sm font-medium">
            {categoryName}
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 mt-6">
          <h3 className="text-2xl lg:text-3xl font-bold text-white leading-tight group-hover:text-gradient transition-all max-w-2xl">
            {capitalizeWords(market.question)}
          </h3>
          
          <div className="mt-6 max-w-md">
            <ProbabilityBar value={yesPrice} size="lg" showLabels />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-8">
          <div>
            <span className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider">Volume</span>
            <p className="text-xl font-bold text-white tabular-nums">{formatUSDC(market.total_volume)}</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div>
            <span className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider">Options</span>
            <p className="text-xl font-bold text-white">{market.options?.length || 2}</p>
          </div>
          <div className="ml-auto">
            <span className="btn btn-outline-gradient text-sm">
              Trade Now
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

/**
 * Get featured markets based on the featured rule:
 * If no explicit featured markets, sort by volume and take top N
 */
export const getFeaturedMarkets = (
  markets: Market[],
  count: number = 3,
  featuredIds?: string[]
): Market[] => {
  // If specific featured IDs provided, use those
  if (featuredIds && featuredIds.length > 0) {
    const featured = markets.filter((m) => featuredIds.includes(m.id));
    if (featured.length > 0) {
      return featured.slice(0, count);
    }
  }

  // Fallback: sort by volume (24h or total) and take top N
  const sorted = [...markets].sort((a, b) => {
    const volumeA = a.total_volume || 0;
    const volumeB = b.total_volume || 0;
    return volumeB - volumeA;
  });

  return sorted.slice(0, count);
};

