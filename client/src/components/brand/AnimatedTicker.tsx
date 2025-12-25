import { motion } from "framer-motion";
import { Market } from "@/types/market";
import { formatUSDC } from "@/utils/format";

interface AnimatedTickerProps {
  markets: Market[];
  speed?: "slow" | "normal" | "fast";
  className?: string;
}

/**
 * Horizontal auto-scrolling ticker strip for recent markets.
 * Infinitely scrolling with seamless loop effect.
 */
export const AnimatedTicker = ({
  markets,
  speed = "normal",
  className = "",
}: AnimatedTickerProps) => {
  const speedDurations = {
    slow: 40,
    normal: 28,
    fast: 18,
  };

  // Duplicate the markets array for seamless infinite scroll
  const duplicatedMarkets = [...markets, ...markets];

  if (markets.length === 0) {
    return null;
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        className="flex gap-8"
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: speedDurations[speed],
            ease: "linear",
          },
        }}
      >
        {duplicatedMarkets.map((market, index) => (
          <TickerItem key={`${market.id}-${index}`} market={market} />
        ))}
      </motion.div>
    </div>
  );
};

const TickerItem = ({ market }: { market: Market }) => {
  const firstOption = market.options?.[0];
  const yesPrice = firstOption?.yes_price ?? 0.5;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-graphite-deep/50 rounded-xl border border-white/5 whitespace-nowrap shrink-0">
      <span className="text-sm text-white font-medium max-w-[200px] truncate">
        {market.question}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-aqua-pulse font-semibold tabular-nums text-sm">
          {(yesPrice * 100).toFixed(1)}%
        </span>
        <span className="text-moon-grey-dark text-xs">·</span>
        <span className="text-moon-grey text-xs tabular-nums">
          {formatUSDC(market.total_volume)}
        </span>
      </div>
    </div>
  );
};

/**
 * Simple text ticker for announcements or news
 */
export const TextTicker = ({
  items,
  speed = "normal",
  className = "",
}: {
  items: string[];
  speed?: "slow" | "normal" | "fast";
  className?: string;
}) => {
  const speedDurations = {
    slow: 50,
    normal: 35,
    fast: 20,
  };

  const duplicatedItems = [...items, ...items];

  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        className="flex gap-12"
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: speedDurations[speed],
            ease: "linear",
          },
        }}
      >
        {duplicatedItems.map((item, index) => (
          <span
            key={index}
            className="text-moon-grey text-sm whitespace-nowrap flex items-center gap-3"
          >
            <span className="w-1 h-1 rounded-full bg-neon-iris" />
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
};
