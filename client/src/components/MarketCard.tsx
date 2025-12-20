import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { Market } from "@/types/market";
import {
  formatUSDC,
  formatTimeRemaining,
  calculateYesPrice,
  capitalizeWords,
  formatDistanceToNow,
} from "@/utils/format";
import { Clock, TrendingUp, ChevronDown } from "lucide-react";
import { GradientAccent } from "./GradientAccent";
import { WatchlistButton } from "./WatchlistButton";
import { UserAvatar } from "./UserAvatar";

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
  const isMultipleChoice = market.options && market.options.length > 1;
  const isResolved = market.is_resolved;
  const timeRemaining = formatTimeRemaining(market.expiration_timestamp);
  const isEnding = timeRemaining.includes("h") || timeRemaining.includes("m");

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
              </div>
            )}
            <h3 className="text-sm font-bold text-white line-clamp-1">
              {capitalizeWords(market.question)}
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
    <Link to={`/market/${market.id}`} className="block h-full group">
      {/* Enhanced card with gradient glow effects */}
      <div className="relative h-full bg-graphite-light rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-card-hover border border-transparent hover:border-neon-iris/30">
        {/* Animated gradient background orbs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial-iris opacity-0 group-hover:opacity-25 group-hover:w-80 group-hover:h-80 transition-all duration-500 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial-aqua opacity-0 group-hover:opacity-18 group-hover:w-64 group-hover:h-64 transition-all duration-500 blur-3xl pointer-events-none" />

        <GradientAccent color="neon-iris" position="both" />

        <div className="p-5 h-full flex flex-col relative z-10">
          {/* Top Row: Creator Info (left) and Timestamp (right) */}
          <div className="flex items-center justify-between mb-3">
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
                <span className="text-xs text-moon-grey-dark">
                  {market.creator_display_name ||
                    (market.creator_username
                      ? `@${market.creator_username}`
                      : "User")}
                </span>
              </div>
            )}
            {/* Timestamp */}
            <span className="text-xs text-moon-grey-dark">
              {formatDistanceToNow(market.created_at)}
            </span>
          </div>

          {/* Status Tags Row */}
          <div className="flex items-center justify-between gap-2 mb-3">
            {/* Active/Resolved Status */}
            {isResolved ? (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-aqua-pulse" />
                <span className="text-xs text-moon-grey-dark">Resolved</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-brand-success" />
                <span className="text-xs text-moon-grey-dark">Active</span>
              </div>
            )}
            {/* Category Tag */}
            <span className="px-2 py-0.5 rounded-full bg-neon-iris/10 text-neon-iris text-xs font-medium border border-neon-iris/20">
              {categoryName}
            </span>
          </div>

          {/* Market Image and Title Row */}
          <div className="flex items-start gap-3 mb-4">
            {/* Market Cover Image */}
            {market.image_url && (
              <div className="relative flex-shrink-0 group/image">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-neon-iris/20 to-aqua-pulse/20 opacity-0 group-hover/image:opacity-50 transition-opacity blur-sm" />
                <img
                  src={market.image_url}
                  alt=""
                  width={80}
                  height={80}
                  loading="lazy"
                  className="relative w-20 h-20 rounded-xl object-cover border-2 border-white/10 shadow-lg group-hover:border-neon-iris/30 transition-all duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            {/* Question Title */}
            <h3 className="text-base font-bold text-white leading-snug flex-1">
              {capitalizeWords(market.question)}
            </h3>
          </div>

          {/* Metrics Row */}
          <div className="flex items-center justify-between gap-4 mb-4 text-xs text-moon-grey-dark">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-aqua-pulse" />
              <span className="font-semibold text-white">
                {formatUSDC(market.total_volume)}
              </span>
            </div>
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${
                isEnding
                  ? "bg-brand-warning/10 text-brand-warning border border-brand-warning/20"
                  : "bg-neon-iris/10 text-neon-iris border border-neon-iris/20"
              }`}
            >
              <Clock
                className={`w-3.5 h-3.5 ${
                  isEnding ? "text-brand-warning" : "text-neon-iris"
                }`}
              />
              <span
                className={`font-semibold ${
                  isEnding ? "text-brand-warning" : "text-neon-iris"
                }`}
              >
                {timeRemaining} left
              </span>
            </div>
          </div>

          {/* Mood Progress Bar Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-sm font-medium text-white">Mood</span>
              <span className="text-lg font-bold text-white tabular-nums">
                {moodPercentage}%
              </span>
            </div>
            <div className="relative w-full h-2 bg-graphite-light rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-neon-iris/60 to-aqua-pulse/60 rounded-full transition-all duration-500"
                style={{ width: `${moodPercentage}%` }}
              />
            </div>
          </div>

          {/* Content Area - Action Buttons */}
          <div className="flex-1 flex flex-col justify-end min-h-0">
            {isMultipleChoice ? (
              /* Multiple Choice Layout - Top Option + Dropdown */
              <div className="space-y-2">
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
                    const percentageNum = parseFloat(percentage);

                    return (
                      <div className="relative">
                        <div className="relative rounded-xl overflow-hidden transition-all duration-300 group/option bg-graphite-light border border-white/5 shadow-lg hover:border-neon-iris/30 hover:shadow-neon-subtle">
                          {/* Enhanced progress bar with gradient colors */}
                          <div
                            className={`absolute inset-0 transition-all duration-500 ${
                              percentageNum >= 50
                                ? "bg-gradient-to-r from-aqua-pulse/20 via-aqua-pulse/10 to-transparent"
                                : percentageNum >= 25
                                ? "bg-gradient-to-r from-brand-warning/20 via-brand-warning/10 to-transparent"
                                : "bg-gradient-to-r from-brand-danger/20 via-brand-danger/10 to-transparent"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                          {/* Glow effect on progress */}
                          <div
                            className="absolute inset-0 bg-gradient-to-r from-aqua-pulse/0 via-aqua-pulse/30 to-transparent opacity-0 group-hover/option:opacity-60 transition-opacity duration-500 blur-sm"
                            style={{ width: `${percentage}%` }}
                          />

                          <div className="relative flex items-center gap-2 p-3">
                            {/* Option Image */}
                            {topOption.option_image_url ? (
                              <div className="relative flex-shrink-0">
                                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-neon-iris/20 to-aqua-pulse/20 opacity-0 group-hover/option:opacity-60 transition-opacity blur-sm" />
                                <img
                                  src={topOption.option_image_url}
                                  alt={capitalizeWords(topOption.option_label)}
                                  className="relative w-8 h-8 rounded-lg object-cover border border-white/10 group-hover/option:border-neon-iris/40 transition-all"
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-graphite-hover to-graphite-deep flex items-center justify-center font-bold text-moon-grey-dark flex-shrink-0 text-xs border border-white/10 group-hover/option:border-neon-iris/30 transition-all">
                                1
                              </div>
                            )}

                            {/* Option Label */}
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold truncate block text-sm text-white group-hover/option:text-neon-iris-light transition-colors">
                                {capitalizeWords(topOption.option_label)}
                              </span>
                            </div>

                            {/* Dropdown Arrow + Count */}
                            {otherOptions.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowAllOptions(!showAllOptions);
                                }}
                                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-graphite-hover hover:bg-graphite-light transition-colors text-xs text-moon-grey hover:text-white"
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
                            className={`absolute bottom-full left-0 right-0 mb-2 space-y-2 bg-graphite-deep border border-white/10 rounded-xl p-2 shadow-lg z-10 ${
                              otherOptions.length > 3
                                ? "max-h-60 overflow-y-auto"
                                : ""
                            }`}
                          >
                            {otherOptions.map((option, index) => {
                              const optionPrice =
                                (option as any).yes_price ??
                                calculateYesPrice(
                                  option.yes_quantity,
                                  option.no_quantity,
                                  liquidityParam,
                                  isResolved
                                );
                              const percentage = (optionPrice * 100).toFixed(1);
                              const percentageNum = parseFloat(percentage);

                              return (
                                <div
                                  key={option.id}
                                  className="relative rounded-lg overflow-hidden transition-all duration-300 group/option bg-graphite-light border border-white/5 hover:border-neon-iris/30"
                                >
                                  {/* Progress bar with gradient colors */}
                                  <div
                                    className={`absolute inset-0 transition-all duration-500 ${
                                      percentageNum >= 50
                                        ? "bg-gradient-to-r from-aqua-pulse/20 via-aqua-pulse/10 to-transparent"
                                        : percentageNum >= 25
                                        ? "bg-gradient-to-r from-brand-warning/20 via-brand-warning/10 to-transparent"
                                        : "bg-gradient-to-r from-brand-danger/20 via-brand-danger/10 to-transparent"
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />

                                  <div className="relative flex items-center gap-2 p-2">
                                    {option.option_image_url ? (
                                      <img
                                        src={option.option_image_url}
                                        alt={capitalizeWords(
                                          option.option_label
                                        )}
                                        className="w-8 h-8 rounded-lg object-cover border border-white/10"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-graphite-hover to-graphite-deep flex items-center justify-center font-bold text-moon-grey-dark text-xs border border-white/10">
                                        {index + 2}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium truncate block text-xs text-white">
                                        {capitalizeWords(option.option_label)}
                                      </span>
                                    </div>
                                    <div
                                      className={`flex-shrink-0 px-2 py-1 rounded text-xs font-bold tabular-nums ${
                                        percentageNum >= 50
                                          ? "bg-aqua-pulse/20 text-aqua-pulse"
                                          : percentageNum >= 25
                                          ? "bg-brand-warning/20 text-brand-warning"
                                          : "bg-brand-danger/20 text-brand-danger"
                                      }`}
                                    >
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
              /* Binary Market Layout - Yes/No side by side with gradient colors */
              <div className="grid grid-cols-2 gap-2">
                {/* Yes Option - Premium design with gradient */}
                <div className="relative rounded-xl overflow-hidden transition-all duration-300 group/yes bg-graphite-light border border-white/5 shadow-lg hover:border-aqua-pulse/40 hover:shadow-aqua-subtle">
                  {/* Enhanced progress bar with glow */}
                  <div
                    className={`absolute inset-0 transition-all duration-500 ${
                      yesPrice >= 0.5
                        ? "bg-gradient-to-r from-aqua-pulse/20 via-aqua-pulse/10 to-transparent"
                        : yesPrice >= 0.25
                        ? "bg-gradient-to-r from-brand-warning/20 via-brand-warning/10 to-transparent"
                        : "bg-gradient-to-r from-brand-danger/20 via-brand-danger/10 to-transparent"
                    }`}
                    style={{ width: `${(yesPrice * 100).toFixed(1)}%` }}
                  />
                  {/* Glow effect */}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-aqua-pulse/0 via-aqua-pulse/30 to-transparent opacity-0 group-hover/yes:opacity-60 transition-opacity duration-500 blur-sm"
                    style={{ width: `${(yesPrice * 100).toFixed(1)}%` }}
                  />

                  <div className="relative flex items-center gap-2 p-3">
                    {/* Yes Icon - Enhanced */}
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aqua-pulse/25 to-aqua-pulse/10 flex items-center justify-center flex-shrink-0 border border-aqua-pulse/30 group-hover/yes:border-aqua-pulse/40 transition-all">
                      <svg
                        className="w-3.5 h-3.5 text-aqua-pulse"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>

                    {/* Option Label */}
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-white text-sm block group-hover/yes:text-aqua-pulse-light transition-colors">
                        Yes
                      </span>
                    </div>
                  </div>
                </div>

                {/* No Option - Premium design with gradient */}
                <div className="relative rounded-xl overflow-hidden transition-all duration-300 group/no bg-graphite-hover/60 border border-white/5 hover:border-brand-danger/40 hover:shadow-brand-danger/10">
                  {/* Enhanced progress bar */}
                  <div
                    className={`absolute inset-0 transition-all duration-500 ${
                      noPrice >= 0.5
                        ? "bg-gradient-to-r from-brand-danger/20 via-brand-danger/10 to-transparent"
                        : noPrice >= 0.25
                        ? "bg-gradient-to-r from-brand-warning/20 via-brand-warning/10 to-transparent"
                        : "bg-gradient-to-r from-aqua-pulse/20 via-aqua-pulse/10 to-transparent"
                    }`}
                    style={{ width: `${(noPrice * 100).toFixed(1)}%` }}
                  />
                  {/* Glow effect */}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-brand-danger/0 via-brand-danger/30 to-transparent opacity-0 group-hover/no:opacity-60 transition-opacity duration-500 blur-sm"
                    style={{ width: `${(noPrice * 100).toFixed(1)}%` }}
                  />

                  <div className="relative flex items-center gap-2 p-3">
                    {/* No Icon - Enhanced */}
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-danger/25 to-brand-danger/10 flex items-center justify-center flex-shrink-0 border border-brand-danger/30 group-hover/no:border-brand-danger/40 transition-all">
                      <svg
                        className="w-3.5 h-3.5 text-brand-danger"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>

                    {/* Option Label */}
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-white text-sm block group-hover/no:text-brand-danger transition-colors">
                        No
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
