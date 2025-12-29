import { memo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Market } from "@/types/market";
import {
  formatUSDC,
  formatTimeRemaining,
  calculateYesPrice,
} from "@/utils/format";
import { Clock, TrendingUp, ChevronDown } from "lucide-react";
import { GradientAccent } from "./GradientAccent";
import { UserAvatar } from "./UserAvatar";
import { WatchlistButton } from "./WatchlistButton";

interface MarketCardProps {
  market: Market;
  variant?: "default" | "compact" | "featured";
}

/**
 * Market Card Component
 *
 * Redesigned with Moodring brand identity:
 * - Deep graphite surface with gradient border on hover
 * - Neon iris + aqua pulse accents
 * - Clear data hierarchy with tabular numbers
 * - Subtle CSS hover animations (no JS animation for better perf)
 *
 * Wrapped in React.memo to prevent unnecessary re-renders when parent updates
 */
const MarketCardComponent = ({
  market,
  variant = "default",
}: MarketCardProps) => {
  const [showAllOptions, setShowAllOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMultipleChoice = market.options && market.options.length > 1;
  const isResolved = market.is_resolved;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowAllOptions(false);
      }
    };

    if (showAllOptions) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAllOptions]);
  const timeRemainingFull = formatTimeRemaining(market.expiration_timestamp);

  // Shorten very long date strings for better display
  const shortenTimeRemaining = (timeStr: string): string => {
    // If it's a long date with multiple parts (e.g., "1 year, 11 months, 28 days")
    // Show only the first two significant parts
    if (timeStr.includes(",") && timeStr.length > 20) {
      const parts = timeStr.split(",").map((p) => p.trim());
      if (parts.length > 2) {
        return `${parts[0]}, ${parts[1]}`;
      }
    }
    return timeStr;
  };
  const timeRemaining = shortenTimeRemaining(timeRemainingFull);

  const liquidityParam =
    market.liquidity_parameter || market.base_liquidity_parameter || 0;
  const firstOption = market.options?.[0];
  const yesPrice = firstOption
    ? (firstOption as any).yes_price ??
      calculateYesPrice(
        firstOption.yes_quantity,
        firstOption.no_quantity,
        liquidityParam,
        isResolved
      )
    : 0.5;
  const noPrice = 1 - yesPrice;

  // Get sorted options for multiple choice
  const sortedOptions = isMultipleChoice
    ? [...(market.options || [])].sort((a, b) => {
        const priceA =
          (a as any).yes_price ??
          calculateYesPrice(
            a.yes_quantity,
            a.no_quantity,
            liquidityParam,
            isResolved
          );
        const priceB =
          (b as any).yes_price ??
          calculateYesPrice(
            b.yes_quantity,
            b.no_quantity,
            liquidityParam,
            isResolved
          );
        return priceB - priceA;
      })
    : [];

  const topOption = sortedOptions.length > 0 ? sortedOptions[0] : null;
  const otherOptions = sortedOptions.slice(1);

  // Get the top option percentage for "Mood" display
  const topOptionPrice = isMultipleChoice
    ? sortedOptions.length > 0
      ? (sortedOptions[0] as any).yes_price ??
        calculateYesPrice(
          sortedOptions[0].yes_quantity,
          sortedOptions[0].no_quantity,
          liquidityParam,
          isResolved
        )
      : yesPrice
    : yesPrice >= 0.5
    ? yesPrice
    : noPrice;
  const moodPercentage = (topOptionPrice * 100).toFixed(0);

  // Get category name
  const categoryName =
    market.categories?.[0]?.name || market.category || "General";

  if (variant === "compact") {
    return (
      <Link to={`/market/${market.id}`} className="block group">
        <div className="relative overflow-hidden flex items-center gap-4 p-4 bg-graphite-light rounded-xl transition-all duration-300 hover:shadow-card-hover border border-transparent hover:border-neon-iris/35">
          <GradientAccent color="neon-iris" position="both" />
          {/* Market Cover Image */}
          {market.image_url && (
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-neon-iris/20 to-aqua-pulse/20 opacity-0 group-hover:opacity-60 transition-opacity blur-sm" />
              <img
                src={market.image_url}
                alt=""
                className="relative w-14 h-14 rounded-xl object-cover border-2 border-white/10 shadow-md group-hover:border-neon-iris/30 transition-all"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {/* Creator Info */}
            {(market.creator_username || market.creator_display_name) && (
              <div className="flex items-center gap-1.5 mb-1">
                <UserAvatar
                  name={
                    market.creator_display_name ||
                    market.creator_username ||
                    "User"
                  }
                  imageUrl={market.creator_avatar_url}
                  size="sm"
                />
                <span className="text-[10px] text-moon-grey-dark">
                  {market.creator_display_name ||
                    (market.creator_username
                      ? `@${market.creator_username}`
                      : "User")}
                </span>
                {market.is_admin_creator && (
                  <div className="flex items-center justify-center w-3 h-3 rounded-full bg-neon-iris flex-shrink-0">
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
              </div>
            )}
            <h3 className="text-sm font-bold text-white line-clamp-1">
              {market.question}
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-aqua-pulse font-black tabular-nums text-base px-2.5 py-1 rounded-lg bg-aqua-pulse/15 border border-aqua-pulse/30">
                {(yesPrice * 100).toFixed(1)}%
              </span>
              <span className="text-moon-grey-dark text-xs font-medium">
                {formatUSDC(market.total_volume)} vol
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/market/${market.id}`}
      className="block h-full group overflow-visible"
    >
      {/* Card */}
      <div className="relative h-full rounded-xl overflow-visible transition-all duration-300">
        {/* Background layer with rounded corners */}
        <div className="absolute inset-0 bg-graphite-light rounded-xl overflow-hidden border border-transparent hover:border-neon-iris/20 transition-all" />
        <GradientAccent color="neon-iris" position="both" />

        <div className="p-6 h-full flex flex-col relative z-10 overflow-visible">
          {/* Top Row: Category + Bookmark */}
          <div className="flex items-center justify-between mb-4">
            <span className="px-2.5 py-1 rounded-full bg-neon-iris/10 text-neon-iris text-xs font-medium">
              {categoryName}
            </span>
            <WatchlistButton marketId={market.id} />
          </div>

          {/* Market Image and Title Row */}
          <div className="flex items-start gap-3 mb-5">
            {/* Market Cover Image */}
            {market.image_url && (
              <div className="relative flex-shrink-0">
                <img
                  src={market.image_url}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  className="relative w-16 h-16 rounded-lg object-cover border border-white/10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            {/* Question Title */}
            <h3 className="text-base font-bold text-white leading-snug flex-1">
              {market.question}
            </h3>
          </div>

          {/* Mood Progress Bar Section - Simplified */}
          <div className="mb-5">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <span className="text-xs text-moon-grey-dark">Mood</span>
              <span className="text-base font-bold text-white tabular-nums">
                {moodPercentage}%
              </span>
            </div>
            <div className="relative w-full h-1.5 bg-graphite-deep rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-neon-iris to-aqua-pulse rounded-full transition-all duration-500"
                style={{ width: `${moodPercentage}%` }}
              />
            </div>
          </div>

          {/* Content Area - Action Buttons */}
          <div className="flex-1 flex flex-col justify-end min-h-0 pt-1 overflow-visible relative">
            {isMultipleChoice ? (
              /* Multiple Choice Layout - Top Option + Dropdown */
              <div className="space-y-2.5 relative overflow-visible">
                {topOption &&
                  (() => {
                    const optionPrice =
                      (topOption as any).yes_price ??
                      calculateYesPrice(
                        topOption.yes_quantity,
                        topOption.no_quantity,
                        liquidityParam,
                        isResolved
                      );
                    const percentage = (optionPrice * 100).toFixed(1);

                    return (
                      <div
                        ref={dropdownRef}
                        className="relative overflow-visible"
                      >
                        <div className="relative rounded-lg overflow-hidden bg-graphite-deep border border-white/10 hover:border-neon-iris/30 transition-all">
                          <div
                            className="absolute inset-0 bg-gradient-to-r from-neon-iris/15 to-aqua-pulse/15 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />

                          <div className="relative flex items-center gap-2.5 p-3">
                            {topOption.option_image_url ? (
                              <img
                                src={topOption.option_image_url}
                                alt={topOption.option_label}
                                className="w-7 h-7 rounded object-cover flex-shrink-0"
                              />
                            ) : null}

                            <div className="flex-1 min-w-0">
                              <span className="font-medium truncate block text-sm text-white">
                                {topOption.option_label}
                              </span>
                            </div>

                            {otherOptions.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowAllOptions(!showAllOptions);
                                }}
                                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-graphite-light hover:bg-graphite-hover transition-colors text-xs text-moon-grey hover:text-white"
                              >
                                <span>+{otherOptions.length}</span>
                                <ChevronDown
                                  className={`w-3 h-3 transition-transform ${
                                    showAllOptions ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Dropdown Options */}
                        {showAllOptions && otherOptions.length > 0 && (
                          <div
                            className={`absolute bottom-full left-0 right-0 mb-2.5 space-y-2 bg-graphite-deep border border-white/10 rounded-lg p-2.5 shadow-2xl z-[9999] ${
                              otherOptions.length > 3
                                ? "max-h-60 overflow-y-auto"
                                : ""
                            }`}
                          >
                            {otherOptions.map((option) => {
                              const optionPrice =
                                (option as any).yes_price ??
                                calculateYesPrice(
                                  option.yes_quantity,
                                  option.no_quantity,
                                  liquidityParam,
                                  isResolved
                                );
                              const percentage = (optionPrice * 100).toFixed(1);

                              return (
                                <div
                                  key={option.id}
                                  className="relative rounded overflow-hidden bg-graphite-light border border-white/10 hover:border-neon-iris/30 transition-all"
                                >
                                  <div
                                    className="absolute inset-0 bg-gradient-to-r from-neon-iris/15 to-aqua-pulse/15 transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />

                                  <div className="relative flex items-center gap-2.5 p-2.5">
                                    {option.option_image_url ? (
                                      <img
                                        src={option.option_image_url}
                                        alt={option.option_label}
                                        className="w-6 h-6 rounded object-cover flex-shrink-0"
                                      />
                                    ) : null}
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium truncate block text-xs text-white">
                                        {option.option_label}
                                      </span>
                                    </div>
                                    <div className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-semibold tabular-nums bg-graphite-deep text-white">
                                      {percentage}%
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            ) : (
              /* Binary Market Layout - Yes/No side by side */
              <div className="grid grid-cols-2 gap-2.5">
                {/* Yes Option */}
                <div className="relative rounded-lg overflow-hidden bg-graphite-deep border border-white/10 hover:border-aqua-pulse/30 transition-all">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-aqua-pulse/15 to-transparent transition-all duration-500"
                    style={{ width: `${(yesPrice * 100).toFixed(1)}%` }}
                  />

                  <div className="relative flex items-center justify-center p-3">
                    <span className="font-semibold text-white text-sm">
                      Yes
                    </span>
                  </div>
                </div>

                {/* No Option */}
                <div className="relative rounded-lg overflow-hidden bg-graphite-deep border border-white/10 hover:border-brand-danger/30 transition-all">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-brand-danger/15 to-transparent transition-all duration-500"
                    style={{ width: `${(noPrice * 100).toFixed(1)}%` }}
                  />

                  <div className="relative flex items-center justify-center p-3">
                    <span className="font-semibold text-white text-sm">No</span>
                  </div>
                </div>
              </div>
            )}

            {/* Metrics Row - At Bottom */}
            <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-white/5 text-xs text-moon-grey-dark">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-moon-grey-dark" />
                <span className="text-white">
                  {formatUSDC(market.total_volume)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span className="truncate">{timeRemaining}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

// Use React.memo with custom comparison for performance
export const MarketCard = memo(MarketCardComponent, (prevProps, nextProps) => {
  // Only re-render if the market data actually changed
  const prevMarket = prevProps.market;
  const nextMarket = nextProps.market;

  return (
    prevMarket.id === nextMarket.id &&
    prevMarket.total_volume === nextMarket.total_volume &&
    prevMarket.is_resolved === nextMarket.is_resolved &&
    prevProps.variant === nextProps.variant &&
    // Check first option prices for updates
    (prevMarket.options?.[0] as any)?.yes_price ===
      (nextMarket.options?.[0] as any)?.yes_price
  );
});
