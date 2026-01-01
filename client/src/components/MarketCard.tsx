import { memo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Market } from "@/types/market";
import {
  formatUSDC,
  formatTimeRemaining,
  calculateYesPrice,
} from "@/utils/format";
import { ChevronDown } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { WatchlistButton } from "./WatchlistButton";

interface MarketCardProps {
  market: Market;
  variant?: "default" | "compact" | "featured";
}

/**
 * Market Card Component - Premier Aesthetic
 *
 * Refined design matching the home page:
 * - Clean, minimal surfaces with subtle borders
 * - Elegant typography with extralight/light weights
 * - Subtle hover states with gradient accents
 * - Premium spacing and visual hierarchy
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
        <div className="relative flex items-center gap-4 p-5 bg-ink-black border border-white/5 hover:border-white/10 transition-all duration-300">
          {/* Gradient accent on hover */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-iris/0 via-neon-iris/30 to-neon-iris/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Market Cover Image */}
          {market.image_url && (
            <div className="relative flex-shrink-0">
              <img
                src={market.image_url}
                alt=""
                className="w-12 h-12 object-cover border border-white/10"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {/* Creator Info */}
            {(market.creator_username || market.creator_display_name) && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <UserAvatar
                  name={
                    market.creator_display_name ||
                    market.creator_username ||
                    "User"
                  }
                  imageUrl={market.creator_avatar_url}
                  size="sm"
                />
                <span className="text-[10px] text-moon-grey/50">
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
            <h3 className="text-sm font-light text-white line-clamp-1 mb-2">
              {market.question}
            </h3>
            <div className="flex items-center gap-4">
              <span className="text-lg font-light text-aqua-pulse tabular-nums">
                {(yesPrice * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-moon-grey/40 font-light">
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
      {/* Card - Premier aesthetic with subtle borders */}
      <div className="relative h-full bg-graphite-deep/40 border border-white/[0.06] hover:border-white/10 hover:bg-graphite-deep/60 transition-all duration-500 overflow-visible">
        {/* Gradient accent lines */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-iris/0 via-neon-iris/20 to-neon-iris/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-aqua-pulse/0 via-aqua-pulse/10 to-aqua-pulse/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="p-6 sm:p-8 h-full flex flex-col relative z-10 overflow-visible">
          {/* Top Row: Creator Info + Category + Bookmark */}
          <div className="flex items-center justify-between mb-5">
            {/* Creator Info */}
            {(market.creator_username || market.creator_display_name) && (
              <div className="flex items-center gap-2">
                <UserAvatar
                  name={
                    market.creator_display_name ||
                    market.creator_username ||
                    "User"
                  }
                  imageUrl={market.creator_avatar_url}
                  size="sm"
                />
                <span className="text-xs text-moon-grey/50 font-light">
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
              </div>
            )}
            {/* Category + Bookmark */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] tracking-[0.15em] uppercase text-neon-iris/70 font-medium">
                {categoryName}
              </span>
              <WatchlistButton marketId={market.id} />
            </div>
          </div>

          {/* Market Image and Title Row */}
          <div className="flex items-start gap-4 mb-6">
            {/* Market Cover Image */}
            {market.image_url && (
              <div className="relative flex-shrink-0">
                <img
                  src={market.image_url}
                  alt=""
                  width={56}
                  height={56}
                  loading="lazy"
                  className="w-14 h-14 object-cover border border-white/10 group-hover:border-white/20 transition-colors"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            {/* Question Title */}
            <h3 className="text-base sm:text-lg font-light text-white leading-snug flex-1 line-clamp-3">
              {market.question}
            </h3>
          </div>

          {/* Probability Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/40 font-medium">
                Probability
              </span>
              <span className="text-xl font-extralight text-white tabular-nums">
                {moodPercentage}%
              </span>
            </div>
            <div className="relative w-full h-1 bg-graphite-hover overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-neon-iris to-aqua-pulse transition-all duration-700"
                style={{ width: `${moodPercentage}%` }}
              />
            </div>
          </div>

          {/* Content Area - Action Buttons */}
          <div className="flex-1 flex flex-col justify-end min-h-0 overflow-visible relative">
            {isMultipleChoice ? (
              /* Multiple Choice Layout */
              <div className="space-y-2 relative overflow-visible">
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
                        <div className="relative overflow-hidden bg-graphite-deep/50 border border-white/5 hover:border-white/10 transition-all">
                          <div
                            className="absolute inset-0 bg-gradient-to-r from-neon-iris/10 to-transparent transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />

                          <div className="relative flex items-center gap-3 p-3">
                            {topOption.option_image_url ? (
                              <img
                                src={topOption.option_image_url}
                                alt={topOption.option_label}
                                className="w-6 h-6 object-cover flex-shrink-0"
                              />
                            ) : null}

                            <div className="flex-1 min-w-0">
                              <span className="font-light truncate block text-sm text-white">
                                {topOption.option_label}
                              </span>
                            </div>

                            <span className="text-sm font-light text-white/80 tabular-nums">
                              {percentage}%
                            </span>

                            {otherOptions.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowAllOptions(!showAllOptions);
                                }}
                                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-moon-grey/50 hover:text-white transition-colors"
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
                            className={`absolute bottom-full left-0 right-0 mb-2 space-y-1 bg-graphite-deep border border-white/10 p-2 shadow-2xl z-[9999] ${
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
                                  className="relative overflow-hidden bg-graphite-light/50 border border-white/5 hover:border-white/10 transition-all"
                                >
                                  <div
                                    className="absolute inset-0 bg-gradient-to-r from-neon-iris/10 to-transparent transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />

                                  <div className="relative flex items-center gap-2.5 p-2.5">
                                    {option.option_image_url ? (
                                      <img
                                        src={option.option_image_url}
                                        alt={option.option_label}
                                        className="w-5 h-5 object-cover flex-shrink-0"
                                      />
                                    ) : null}
                                    <div className="flex-1 min-w-0">
                                      <span className="font-light truncate block text-xs text-white">
                                        {option.option_label}
                                      </span>
                                    </div>
                                    <span className="text-xs font-light text-white/60 tabular-nums">
                                      {percentage}%
                                    </span>
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
              /* Binary Market Layout - Yes/No */
              <div className="grid grid-cols-2 gap-px bg-white/5">
                {/* Yes Option */}
                <div className="relative overflow-hidden bg-ink-black hover:bg-graphite-deep/50 transition-all group/btn">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-aqua-pulse/10 to-transparent transition-all duration-500"
                    style={{ width: `${(yesPrice * 100).toFixed(1)}%` }}
                  />
                  <div className="relative flex flex-col items-center justify-center py-4">
                    <span className="text-xs tracking-[0.15em] uppercase text-aqua-pulse/70 mb-1">
                      Yes
                    </span>
                    <span className="text-lg font-extralight text-white tabular-nums">
                      {(yesPrice * 100).toFixed(0)}¢
                    </span>
                  </div>
                </div>

                {/* No Option */}
                <div className="relative overflow-hidden bg-ink-black hover:bg-graphite-deep/50 transition-all group/btn">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-rose-500/10 to-transparent transition-all duration-500"
                    style={{ width: `${(noPrice * 100).toFixed(1)}%` }}
                  />
                  <div className="relative flex flex-col items-center justify-center py-4">
                    <span className="text-xs tracking-[0.15em] uppercase text-rose-400/70 mb-1">
                      No
                    </span>
                    <span className="text-lg font-extralight text-white tabular-nums">
                      {(noPrice * 100).toFixed(0)}¢
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Metrics Row */}
            <div className="flex items-center justify-between mt-5 pt-5 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-moon-grey/40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                <span className="text-xs text-white font-light tabular-nums">
                  {formatUSDC(market.total_volume)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-moon-grey/40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-xs text-moon-grey/50 font-light truncate max-w-[120px]">
                  {timeRemaining}
                </span>
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
  const prevMarket = prevProps.market;
  const nextMarket = nextProps.market;

  return (
    prevMarket.id === nextMarket.id &&
    prevMarket.total_volume === nextMarket.total_volume &&
    prevMarket.is_resolved === nextMarket.is_resolved &&
    prevProps.variant === nextProps.variant &&
    (prevMarket.options?.[0] as any)?.yes_price ===
      (nextMarket.options?.[0] as any)?.yes_price
  );
});
