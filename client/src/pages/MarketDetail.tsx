import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Market, MarketOption } from "@/types/market";
import { TradeForm } from "@/components/TradeForm";
import { CommentSection } from "@/components/CommentSection";
import { PriceChart } from "@/components/PriceChart";
import { ClaimWinnings } from "@/components/ClaimWinnings";
import { ClaimLpRewards } from "@/components/ClaimLpRewards";
import { WatchlistButton } from "@/components/WatchlistButton";
import { ResolutionViewer } from "@/components/ResolutionViewer";
import { DisputeResolution } from "@/components/DisputeResolution";
import { ResolveOption } from "@/components/ResolveOption";
import { UserAvatar } from "@/components/UserAvatar";
import { SocialProof } from "@/components/SocialProof";
import { TrendingBadge, getTrendingStatus } from "@/components/TrendingBadge";
import {
  formatUSDC,
  formatDate,
  formatTimeRemaining,
  formatShares,
  calculateYesPrice,
  formatDistanceToNow,
} from "@/utils/format";
import {
  fetchMarket,
  fetchMarketActivity,
  Activity,
  submitResolution,
} from "@/api/api";
import { useOptionSocket, useMarketSocket } from "@/hooks/useSocket";
import { useCountdown } from "@/hooks/useCountdown";
import { PriceUpdate, MarketUpdate } from "@/services/socket";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";
import api from "@/config/axios";
import { getUserProfileUrl } from "@/utils/userProfile";

type Tab = "about" | "activity" | "discussion";

// OptionRow component for multiple choice markets - can use hooks
const OptionRow = ({
  option,
  idx,
  market,
  selectedOption,
  selectedSide,
  onSelectOption,
  onResolved,
  onDisputed,
  onClaimed,
}: {
  option: MarketOption;
  idx: number;
  market: Market;
  selectedOption: string | null;
  selectedSide: "yes" | "no";
  onSelectOption: (optionId: string, side: "yes" | "no") => void;
  onResolved: () => void;
  onDisputed: () => void;
  onClaimed: () => void;
}) => {
  const resolved = option.is_resolved ?? false;
  const winner = option.winning_side ?? null;
  const yp = resolved
    ? calculateYesPrice(
        option.yes_quantity,
        option.no_quantity,
        market.liquidity_parameter,
        { is_resolved: resolved, winning_side: winner }
      )
    : (option as any).yes_price ??
      calculateYesPrice(
        option.yes_quantity,
        option.no_quantity,
        market.liquidity_parameter,
        { is_resolved: resolved, winning_side: winner }
      );
  const yc = (yp * 100).toFixed(1);
  const nc = ((1 - yp) * 100).toFixed(1);
  const sel = selectedOption === option.id;

  // Check dispute deadline - hooks can be used here
  const disputeDeadline = option.dispute_deadline
    ? Number(option.dispute_deadline)
    : null;
  const disputeCountdown = useCountdown(disputeDeadline);
  const disputePeriodActive =
    resolved && disputeDeadline !== null && !disputeCountdown.hasEnded;
  const disputePeriodEnded =
    resolved && disputeDeadline !== null && disputeCountdown.hasEnded;

  return (
    <div>
      <div
        onClick={() => !resolved && onSelectOption(option.id, "yes")}
        className={`relative rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3 transition-all ${
          resolved
            ? "opacity-60 cursor-default"
            : sel
            ? "bg-white/[0.08] ring-1 ring-neon-iris/50 cursor-pointer"
            : "bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer"
        }`}
      >
        {/* Progress Bar */}
        <div className="absolute inset-0 rounded-xl overflow-visible">
          <div
            className={`h-full transition-all ${
              parseFloat(yc) >= 50
                ? "bg-muted-green/[0.08]"
                : parseFloat(yc) >= 25
                ? "bg-amber-500/[0.08]"
                : "bg-rose-500/[0.08]"
            }`}
            style={{ width: `${yc}%` }}
          />
        </div>

        {/* Rank/Image */}
        {option.option_image_url ? (
          <img
            src={option.option_image_url}
            alt=""
            className="relative w-9 h-9 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="relative w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-xs font-bold text-moon-grey flex-shrink-0">
            {idx + 1}
          </div>
        )}

        {/* Label */}
        <div className="relative flex-1 min-w-0 pr-2">
          <div>
            <span className="text-sm text-white font-medium break-words line-clamp-2">
              {option.option_label}
            </span>
            {option.option_sub_label && (
              <div className="text-gray-300 text-xs mt-0.5 break-words">
                {option.option_sub_label}
              </div>
            )}
          </div>
          {!resolved && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] text-moon-grey-dark tabular-nums">
                <span className="text-muted-green/70">
                  {formatShares(option.yes_quantity || 0)}
                </span>
                {" / "}
                <span className="text-rose-400/70">
                  {formatShares(option.no_quantity || 0)}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Percentage */}
        <span
          className={`relative text-sm sm:text-base font-bold tabular-nums mr-2 flex-shrink-0 ${
            parseFloat(yc) >= 50
              ? "text-muted-green"
              : parseFloat(yc) >= 25
              ? "text-amber-400"
              : "text-rose-400"
          }`}
        >
          {yc}%
        </span>

        {/* Action Buttons */}
        {!resolved && (
          <div className="relative hidden sm:flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectOption(option.id, "yes");
              }}
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all whitespace-nowrap ${
                sel && selectedSide === "yes"
                  ? "bg-muted-green text-white shadow-lg shadow-muted-green/25"
                  : "bg-muted-green/15 text-muted-green hover:bg-muted-green/25"
              }`}
            >
              Yes {yc}¢
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectOption(option.id, "no");
              }}
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all whitespace-nowrap ${
                sel && selectedSide === "no"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                  : "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
              }`}
            >
              No {nc}¢
            </button>
            <ResolveButton
              market={market}
              option={option}
              onResolved={onResolved}
            />
          </div>
        )}

        {/* Resolved state - show dispute button in action area if dispute period active */}
        {resolved && (
          <div className="relative flex items-center gap-1 sm:gap-1.5 flex-shrink-0 flex-wrap">
            <span className="relative px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-[11px] font-semibold">
              {winner === 1 ? "YES" : "NO"} Won
            </span>
            {disputePeriodActive && (
              <div className="ml-auto">
                <DisputeResolution
                  market={market}
                  option={option}
                  onDisputed={onDisputed}
                  compact={true}
                  countdown={disputeCountdown}
                />
              </div>
            )}
            {disputePeriodEnded && (
              <span className="relative px-2 py-1 rounded-lg bg-neon-iris/15 text-neon-iris text-[11px] font-semibold flex items-center gap-1 ml-auto">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Final
              </span>
            )}
          </div>
        )}
      </div>

      {resolved && (
        <div className="mt-2 ml-0 sm:ml-12">
          <ClaimWinnings
            market={market}
            option={option}
            onClaimed={onClaimed}
          />
        </div>
      )}
    </div>
  );
};

// BinaryOptionRow component for binary markets - can use hooks
const BinaryOptionRow = ({
  option,
  market,
  selectedSide,
  onSelectOption,
  onResolved,
  onDisputed,
  onClaimed,
}: {
  option: MarketOption;
  market: Market;
  selectedSide: "yes" | "no";
  onSelectOption: (optionId: string, side: "yes" | "no") => void;
  onResolved: () => void;
  onDisputed: () => void;
  onClaimed: () => void;
}) => {
  const resolved = option?.is_resolved ?? false;
  const winner = option?.winning_side ?? null;
  const yp = resolved
    ? calculateYesPrice(
        option?.yes_quantity || 0,
        option?.no_quantity || 0,
        market.liquidity_parameter || 100000,
        { is_resolved: resolved, winning_side: winner }
      )
    : (option as any)?.yes_price ??
      calculateYesPrice(
        option?.yes_quantity || 0,
        option?.no_quantity || 0,
        market.liquidity_parameter || 100000,
        { is_resolved: resolved, winning_side: winner }
      );
  const yc = (yp * 100).toFixed(1);
  const nc = ((1 - yp) * 100).toFixed(1);

  // Check dispute deadline - hooks can be used here
  const disputeDeadline = option?.dispute_deadline
    ? Number(option.dispute_deadline)
    : null;
  const disputeCountdown = useCountdown(disputeDeadline);
  const disputePeriodActive =
    resolved && disputeDeadline !== null && !disputeCountdown.hasEnded;
  const disputePeriodEnded =
    resolved && disputeDeadline !== null && disputeCountdown.hasEnded;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <button
          onClick={() => !resolved && onSelectOption(option?.id || "", "yes")}
          className={`relative rounded-xl p-3 sm:p-4 lg:p-5 text-center transition-all overflow-visible ${
            resolved
                ? winner === 1
                ? "ring-2 ring-muted-green/50"
                : "opacity-40"
              : selectedSide === "yes"
              ? "ring-2 ring-muted-green/50"
              : "hover:bg-muted-green/10"
          }`}
        >
          <div className="absolute inset-0 bg-muted-green/10" />
          <div className="relative">
            <div className="text-muted-green text-[10px] sm:text-xs font-semibold mb-1 sm:mb-1.5 uppercase tracking-wider">
              Yes {resolved && winner === 1 && "✓"}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-muted-green tabular-nums">
              {resolved && winner === 1 ? "$1" : `${yc}¢`}
            </div>
            <div className="text-muted-green/50 text-[10px] sm:text-[11px] mt-1 sm:mt-1.5 break-words">
              {formatShares(option?.yes_quantity || 0)} shares
            </div>
          </div>
        </button>
        <button
          onClick={() => !resolved && onSelectOption(option?.id || "", "no")}
          className={`relative rounded-xl p-3 sm:p-4 lg:p-5 text-center transition-all overflow-visible ${
            resolved
              ? winner === 2
                ? "ring-2 ring-rose-500/50"
                : "opacity-40"
              : selectedSide === "no"
              ? "ring-2 ring-rose-500/50"
              : "hover:bg-rose-500/10"
          }`}
        >
          <div className="absolute inset-0 bg-rose-500/10" />
          <div className="relative">
            <div className="text-rose-400 text-[10px] sm:text-xs font-semibold mb-1 sm:mb-1.5 uppercase tracking-wider">
              No {resolved && winner === 2 && "✓"}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-rose-400 tabular-nums">
              {resolved && winner === 2 ? "$1" : `${nc}¢`}
            </div>
            <div className="text-rose-400/50 text-[10px] sm:text-[11px] mt-1 sm:mt-1.5 break-words">
              {formatShares(option?.no_quantity || 0)} shares
            </div>
          </div>
        </button>
      </div>

      {/* Binary Resolve Button */}
      {!resolved && option && (
        <div className="mt-3 flex justify-end">
          <ResolveButton
            market={market}
            option={option}
            onResolved={onResolved}
          />
        </div>
      )}

      {/* Resolved state with integrated dispute period info */}
      {resolved && option && (
        <div className="mt-3 space-y-2">
          {/* Dispute period active - show countdown and dispute button */}
          {disputePeriodActive && (
            <div className="flex items-center justify-end gap-2">
              <DisputeResolution
                market={market}
                option={option}
                onDisputed={onDisputed}
                compact={true}
                countdown={disputeCountdown}
              />
            </div>
          )}

          {/* Dispute period ended - show final indicator */}
          {disputePeriodEnded && (
            <div className="px-3 py-2 bg-neon-iris/10 border border-neon-iris/30 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-neon-iris">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-medium">
                  Dispute period ended - Resolution is final
                </span>
              </div>
            </div>
          )}

          <ClaimWinnings
            market={market}
            option={option}
            onClaimed={onClaimed}
          />
        </div>
      )}
    </>
  );
};

// ResolveButton wrapper - uses ResolveOption for new resolution system, old logic for legacy
const ResolveButton = ({
  market,
  option,
  onResolved,
}: {
  market: Market;
  option: MarketOption;
  onResolved: () => void;
}) => {
  // For new resolution system, use ResolveOption component
  const usesNewResolutionSystem = !!(market as any).resolution_mode;

  if (usesNewResolutionSystem) {
    return (
      <ResolveOption market={market} option={option} onResolved={onResolved} />
    );
  }

  // Legacy resolution system - keep old logic
  const { user, isAdmin } = useUserStore();
  const [showModal, setShowModal] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [winningSide, setWinningSide] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Legacy system: creator or admin
  const hasAuthority = user && (user.id === market.creator_id || isAdmin);

  if (!hasAuthority || (option as any).is_resolved) return null;

  const handleResolve = async () => {
    if (!user) return;
    setError(null);
    setIsResolving(true);
    try {
      await submitResolution({
        marketId: market.id,
        optionId: option.id,
        outcome: option.option_label,
        winningSide,
        evidence: reason.trim() ? { notes: reason.trim() } : undefined,
      });
      setShowModal(false);
      setReason("");
      toast.success("Option resolved successfully");
      onResolved();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to resolve");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        className="px-2 py-1 text-[10px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded transition-all"
        title="Resolve this option"
      >
        <svg
          className="w-3 h-3 inline mr-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Resolve
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowModal(false);
            setError(null);
            setReason("");
          }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative bg-graphite-light rounded-2xl border border-white/10 p-6 max-w-lg w-full shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Legacy Resolution UI */}
            <>
              <h3 className="text-lg font-bold text-white mb-1">
                Resolve Option
              </h3>
              <p className="text-moon-grey text-sm mb-5">
                {option.option_label}
              </p>

              <div className="mb-4">
                <label className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-2 block">
                  Winner
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setWinningSide(1)}
                    disabled={isResolving}
                    className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                      winningSide === 1
                        ? "bg-muted-green text-white shadow-lg shadow-muted-green/25"
                        : "bg-muted-green/15 text-muted-green hover:bg-muted-green/25"
                    }`}
                  >
                    YES Wins
                  </button>
                  <button
                    onClick={() => setWinningSide(2)}
                    disabled={isResolving}
                    className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                      winningSide === 2
                        ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                        : "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
                    }`}
                  >
                    NO Wins
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-2 block">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isResolving}
                  placeholder="Brief explanation..."
                  className="w-full px-3 py-2.5 bg-graphite-light border border-white/10 rounded-xl text-white text-sm placeholder-moon-grey-dark focus:border-neon-iris/50 focus:ring-1 focus:ring-neon-iris/25 resize-none transition-all"
                  rows={2}
                />
              </div>

              {error && (
                <div className="mb-4 px-3 py-2 bg-rose-500/15 border border-rose-500/25 rounded-lg text-rose-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                    setReason("");
                  }}
                  disabled={isResolving}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-moon-grey rounded-xl font-medium text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={isResolving}
                  className="flex-1 py-2.5 bg-neon-iris hover:bg-neon-iris/90 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                >
                  {isResolving ? "Resolving..." : "Confirm"}
                </button>
              </div>
            </>
          </div>
        </div>
      )}
    </>
  );
};

export const MarketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUserStore();
  const [market, setMarket] = useState<Market | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes");
  const [activeTab, setActiveTab] = useState<Tab>("discussion");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreActivities, setHasMoreActivities] = useState(false);
  const [showMobileTradePanel, setShowMobileTradePanel] = useState(false);
  const [_tradeFormHighlight, _setTradeFormHighlight] = useState(false);
  const [hasLpShares, setHasLpShares] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [heroWidth, setHeroWidth] = useState<number | null>(null);
  const [heroLeft, setHeroLeft] = useState<number | null>(null);

  const tradeFormRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Hide bottom nav and prevent background scrolling when trade panel is open
  useEffect(() => {
    if (showMobileTradePanel) {
      document.body.classList.add("trade-panel-open");
      document.body.style.overflow = "hidden";
    } else {
      document.body.classList.remove("trade-panel-open");
      document.body.style.overflow = "";
    }
    return () => {
      document.body.classList.remove("trade-panel-open");
      document.body.style.overflow = "";
    };
  }, [showMobileTradePanel]);

  const fetchMarketData = async (publicKey: string) => {
    try {
      const foundMarket = await fetchMarket(publicKey);
      if (foundMarket.market) setMarket(foundMarket.market);
    } catch (error) {
      console.error("Failed to fetch market:", error);
    }
  };

  useEffect(() => {
    if (id) fetchMarketData(id);
  }, [id]);

  // Measure hero width and position for sticky header
  useEffect(() => {
    const measureHero = () => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setHeroWidth(rect.width);
        setHeroLeft(rect.left);
      }
    };

    measureHero();
    window.addEventListener("resize", measureHero);
    window.addEventListener("scroll", measureHero, { passive: true });
    return () => {
      window.removeEventListener("resize", measureHero);
      window.removeEventListener("scroll", measureHero);
    };
  }, [market]);

  // Scroll detection for sticky header
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setIsScrolled(rect.top < -100); // Show sticky header when hero is scrolled past
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const optionIds = useMemo(
    () => market?.options?.map((opt) => opt.id) || [],
    [market?.options]
  );

  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    setMarket((prev) => {
      if (!prev || !prev.options) return prev;
      const updatedOptions = prev.options.map((opt) =>
        opt.id === update.option_id
          ? {
              ...opt,
              yes_price: update.yes_price,
              no_price: update.no_price,
              yes_quantity: update.yes_quantity,
              no_quantity: update.no_quantity,
            }
          : opt
      );
      return { ...prev, options: updatedOptions };
    });
  }, []);

  const handleMarketUpdate = useCallback((update: MarketUpdate) => {
    if (update.event === "updated" && update.data) {
      setMarket((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          total_volume: update.data.total_volume ?? prev.total_volume,
          shared_pool_liquidity:
            update.data.shared_pool_liquidity !== undefined
              ? Number(update.data.shared_pool_liquidity)
              : Number((prev as any).shared_pool_liquidity) || 0,
          accumulated_lp_fees:
            update.data.accumulated_lp_fees !== undefined
              ? Number(update.data.accumulated_lp_fees)
              : Number((prev as any).accumulated_lp_fees) || 0,
          resolution_mode:
            update.data.resolution_mode ?? (prev as any).resolution_mode,
          is_resolved: update.data.is_resolved ?? prev.is_resolved,
        };
      });
    }
  }, []);

  useOptionSocket(optionIds, { onPrice: handlePriceUpdate });
  useMarketSocket(id, { onMarket: handleMarketUpdate });

  useEffect(() => {
    if (market?.options && market.options.length > 1 && !selectedOption) {
      const sorted = [...market.options].sort((a, b) => {
        const aYesPrice =
          (a as any).yes_price ??
          calculateYesPrice(
            a.yes_quantity || 0,
            a.no_quantity || 0,
            market.liquidity_parameter,
            market.is_resolved
          );
        const bYesPrice =
          (b as any).yes_price ??
          calculateYesPrice(
            b.yes_quantity || 0,
            b.no_quantity || 0,
            market.liquidity_parameter,
            market.is_resolved
          );
        return bYesPrice - aYesPrice;
      });
      setSelectedOption(sorted[0]?.id || null);
    }
  }, [market]);

  useEffect(() => {
    if (id && activeTab === "activity") {
      setCurrentPage(1);
      loadActivities(1);
    }
  }, [id, activeTab]);

  // Check if user has LP shares for this market
  useEffect(() => {
    const checkLpShares = async () => {
      if (!user || !id || !market?.is_resolved) {
        setHasLpShares(false);
        return;
      }

      try {
        const response = await api.get(`/liquidity/position/${id}`);
        const pos = response.data.position;
        setHasLpShares(pos && Number(pos.shares) > 0);
      } catch (error) {
        console.error("Failed to check LP position:", error);
        setHasLpShares(false);
      }
    };

    checkLpShares();
  }, [user, id, market?.is_resolved]);

  const loadActivities = async (page: number = 1) => {
    if (!id) return;
    setIsLoadingActivities(true);
    try {
      const { activities: data, pagination } = await fetchMarketActivity(id, {
        page,
        limit: 50,
      });
      // Filter out trade activities - only show non-trade activities
      const nonTradeActivities = (data || []).filter((activity: Activity) => {
        const activityType = activity.type || (activity as any).activity_type;
        return activityType !== "trade";
      });
      setActivities(nonTradeActivities);
      setHasMoreActivities(pagination?.hasMore || false);
      setCurrentPage(page);
    } catch {
      setActivities([]);
      setHasMoreActivities(false);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleSelectOption = (optionId: string, side: "yes" | "no") => {
    setSelectedOption(optionId);
    setSelectedSide(side);
    if (window.innerWidth >= 1024 && tradeFormRef.current) {
      const rect = tradeFormRef.current.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        tradeFormRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
    if (window.innerWidth < 1024) setShowMobileTradePanel(true);
  };

  // Check if all options are resolved (must be before early return)
  const allOptionsResolved = useMemo(() => {
    if (!market?.options || market.options.length === 0) return false;
    return market.options.every((opt) => opt.is_resolved === true);
  }, [market?.options]);

  // Find winning option(s) when market is fully resolved (must be before early return)
  const winningOptions = useMemo(() => {
    if (!allOptionsResolved || !market?.options) return [];
    return market.options.filter(
      (opt) => opt.is_resolved && opt.winning_side === 1
    );
  }, [allOptionsResolved, market?.options]);

  // Check if market has a resolved option (must be before early return)
  const hasResolvedOption = useMemo(() => {
    if (!allOptionsResolved || !market?.options) return false;
    const isMultipleChoice = market.options && market.options.length > 1;
    if (isMultipleChoice) {
      return winningOptions.length > 0;
    } else {
      // Binary market - check if the single option is resolved
      const opt = market.options[0];
      return opt && opt.is_resolved && opt.winning_side !== null;
    }
  }, [allOptionsResolved, market?.options, winningOptions]);

  // Find the option with highest likelihood percentage (must be before early return)
  const highestLikelihoodOption = useMemo(() => {
    if (!market?.options || market.options.length === 0) return null;

    return market.options.reduce((highest, option) => {
      const yesPrice =
        (option as any).yes_price ??
        calculateYesPrice(
          option.yes_quantity || 0,
          option.no_quantity || 0,
          market.liquidity_parameter,
          market.is_resolved
        );
      const highestPrice =
        (highest as any).yes_price ??
        calculateYesPrice(
          highest.yes_quantity || 0,
          highest.no_quantity || 0,
          market.liquidity_parameter,
          market.is_resolved
        );
      return yesPrice > highestPrice ? option : highest;
    });
  }, [market?.options, market?.liquidity_parameter, market?.is_resolved]);

  const highestLikelihoodPrice =
    highestLikelihoodOption && market
      ? (highestLikelihoodOption as any).yes_price ??
        calculateYesPrice(
          highestLikelihoodOption.yes_quantity || 0,
          highestLikelihoodOption.no_quantity || 0,
          market.liquidity_parameter,
          market.is_resolved
        )
      : 0.5;

  if (!market) {
    return (
      <div className="min-h-screen bg-ink-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neon-iris border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-moon-grey text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const categories = market.categories || [];
  const primaryCategory = categories[0]?.name || market.category || "General";
  const isMultipleChoice = market.options && market.options.length > 1;
  const selectedOptionData = isMultipleChoice
    ? market.options?.find((opt) => opt.id === selectedOption)
    : market.options?.[0];
  const primaryOption = isMultipleChoice
    ? selectedOptionData
    : market.options?.[0];
  const primaryYesPrice = primaryOption
    ? (primaryOption as any).yes_price ??
      calculateYesPrice(
        primaryOption.yes_quantity || 0,
        primaryOption.no_quantity || 0,
        market.liquidity_parameter,
        market.is_resolved
      )
    : 0.5;

  // Helper function to show actual percentage with 1 decimal precision
  const getDisplayPercentage = (price: number): string => {
    return (price * 100).toFixed(1);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "discussion", label: "Discussion" },
    { id: "activity", label: "Activity" },
    { id: "about", label: "About" },
  ];

  return (
    <div className="min-h-screen bg-ink-black">
      <div
        className="mx-auto max-w-6xl px-4 py-10 pb-24 lg:pb-10"
        data-market-detail-container
      >
        {/* Breadcrumb - Positioned absolutely to stay above content but below navbar */}
        <div className="relative z-40 mb-4">
          <Link
            to="/markets"
            className="inline-flex items-center gap-1.5 text-moon-grey hover:text-white text-sm transition-colors bg-ink-black backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-lg"
            style={{ position: "relative", zIndex: 40 }}
          >
            <svg
              className="w-3 h-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Markets
          </Link>
        </div>

        {/* Resolution Mode - Clean, Minimal Display */}
        {(market as any).resolution_mode && (
          <div className="relative group mb-4">
            <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <span className="uppercase tracking-wider text-amber-400/70">
                Resolution Mode:
              </span>
              <span className="text-amber-400 font-medium">
                {(market as any).resolution_mode}
              </span>
              <svg
                className="w-3 h-3 text-amber-400/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            {/* Tooltip */}
            <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50">
              <div className="bg-graphite-light border border-amber-500/30 rounded-lg p-3 shadow-xl min-w-[200px] max-w-[300px]">
                <div className="text-xs text-white font-medium mb-1">
                  {(market as any).resolution_mode === "ORACLE" &&
                    "Oracle Mode"}
                  {(market as any).resolution_mode === "AUTHORITY" &&
                    "Authority Mode"}
                  {(market as any).resolution_mode === "OPINION" &&
                    "Opinion Mode"}
                </div>
                <div className="text-xs text-moon-grey">
                  {(market as any).resolution_mode === "ORACLE" &&
                    "Resolved by Oracles"}
                  {(market as any).resolution_mode === "AUTHORITY" &&
                    "Resolved by market creator"}
                  {(market as any).resolution_mode === "OPINION" &&
                    "Market price determines outcome"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Header - Shows when scrolled */}
        <div
          className={`hidden lg:block fixed top-16 z-40 transition-all duration-300 ${
            isScrolled
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-full pointer-events-none"
          }`}
          style={{
            left: heroLeft !== null ? `${heroLeft}px` : undefined,
            width: heroWidth ? `${heroWidth}px` : undefined,
            maxWidth: heroWidth ? `${heroWidth}px` : undefined,
          }}
        >
          <div className="w-full">
            <div className="bg-graphite-light/95 backdrop-blur-md border-b border-white/10 shadow-lg rounded-2xl">
              <div className="flex items-center justify-between py-3 px-4">
                {/* Title and Option Info */}
                <div className="flex-1 min-w-0 gap-4 flex items-center gap-3">
                  {market.image_url && (
                    <img
                      src={market.image_url}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-sm sm:text-base font-bold mb-2 text-white leading-tight truncate min-w-0 mb-0.5">
                      {market.question}
                    </h1>

                    {!allOptionsResolved && highestLikelihoodOption && (
                      <div className="flex items-center gap-2">
                        {isMultipleChoice &&
                          highestLikelihoodOption.option_image_url && (
                            <img
                              src={highestLikelihoodOption.option_image_url}
                              alt=""
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                          )}

                        <span className="text-s font-medium text-moon-grey truncate">
                          {highestLikelihoodOption.option_label}
                        </span>

                        <span
                          className={`text-xs font-bold tabular-nums ${
                            highestLikelihoodPrice >= 0.5
                              ? "text-muted-green"
                              : "text-rose-400"
                          }`}
                        >
                          {(highestLikelihoodPrice * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
          {/* Left Column */}
          <section className="space-y-6">
            {/* Hero Card */}
            <div
              ref={heroRef}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-graphite-light via-graphite-light to-graphite-hover"
            >
              {/* Market Image Background */}
              {market.image_url && (
                <div className="absolute inset-0">
                  <img
                    src={market.image_url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover max-w-full max-h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-graphite-light/95 via-graphite-light/90 to-graphite-hover/85" />
                  {/* Vignette overlay to darken corners */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "radial-gradient(ellipse at center, transparent 0%, transparent 40%, #0a0a0d 100%)",
                    }}
                  />
                </div>
              )}

              {/* Gradient Accent Lines */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent z-10" />

              <div className="relative z-10 p-4 sm:p-6">
                {/* Tags */}
                <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <WatchlistButton marketId={market.id} />
                    {/* Creator Info */}
                    {(market.creator_username ||
                      market.creator_display_name) && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.06]">
                        <UserAvatar
                          name={
                            market.creator_display_name ||
                            market.creator_username ||
                            "User"
                          }
                          imageUrl={market.creator_avatar_url}
                          size="sm"
                        />
                        <Link
                          to={getUserProfileUrl(
                            market.creator_username || market.creator_id
                          )}
                          className="text-[11px] text-moon-grey font-medium hover:text-neon-iris transition-colors cursor-pointer"
                        >
                          {market.creator_display_name ||
                            (market.creator_username
                              ? `@${market.creator_username}`
                              : "User")}
                        </Link>
                        {market.is_admin_creator && (
                          <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-neon-iris flex-shrink-0">
                            <svg
                              className="w-2.5 h-2.5 text-white"
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
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {categories.slice(0, 2).map((cat) => (
                      <span
                        key={cat.id}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/[0.06] text-moon-grey border border-white/[0.06]"
                      >
                        {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                      </span>
                    ))}
                    {categories.length === 0 && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/[0.06] text-moon-grey border border-white/[0.06]">
                        {primaryCategory.charAt(0).toUpperCase() +
                          primaryCategory.slice(1)}
                      </span>
                    )}
                    {market.is_resolved && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neon-iris/15 text-neon-iris border border-neon-iris/20">
                        ✓ Resolved
                      </span>
                    )}
                    {/* Trending Badge */}
                    {!market.is_resolved &&
                      (() => {
                        const trendingStatus = getTrendingStatus({
                          total_volume: market.total_volume || 0,
                          created_at: market.created_at,
                          total_open_interest:
                            (market as any).total_open_interest || 0,
                        });
                        return trendingStatus ? (
                          <TrendingBadge type={trendingStatus} size="sm" />
                        ) : null;
                      })()}
                  </div>
                </div>

                {/* Title & Probability */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-5">
                  <h1 className="flex-1 text-xl sm:text-2xl lg:text-[28px] font-bold text-white leading-tight tracking-tight break-words min-w-0">
                    {market.question}
                  </h1>

                  {/* Probability Display */}
                  <div className="flex-shrink-0 w-full sm:w-auto">
                    {allOptionsResolved && hasResolvedOption ? (
                      /* Show winning option when market is fully resolved */
                      isMultipleChoice ? (
                        <div className="flex items-center gap-2 sm:gap-3 bg-neon-iris/10 rounded-2xl p-2 pr-3 sm:pr-4 border border-neon-iris/20 w-full sm:w-auto">
                          {winningOptions[0]?.option_image_url ? (
                            <img
                              src={winningOptions[0].option_image_url}
                              alt=""
                              className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl bg-neon-iris/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm sm:text-base lg:text-lg font-bold text-neon-iris">
                                {winningOptions[0]?.option_label
                                  ?.charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums leading-none text-neon-iris">
                              Winner
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-neon-iris/70 mt-0.5 truncate">
                              {winningOptions[0]?.option_label || ""}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Binary Market - Show winning side */
                        <div className="text-left sm:text-right w-full sm:w-auto">
                          <div className={`text-3xl sm:text-4xl lg:text-5xl font-bold tabular-nums leading-none ${
                            primaryOption?.winning_side === 1 ? "text-muted-green" : "text-rose-400"
                          }`}>
                            {primaryOption?.winning_side === 1 ? "YES" : "NO"}
                          </div>
                          <div className={`text-[10px] sm:text-xs mt-1 ${
                            primaryOption?.winning_side === 1 ? "text-muted-green/70" : "text-rose-400/70"
                          }`}>
                            Winner
                          </div>
                        </div>
                      )
                    ) : isMultipleChoice && selectedOptionData ? (
                      /* Multiple Choice - Show option with image */
                      <div className="flex items-center gap-2 sm:gap-3 bg-white/[0.03] rounded-2xl p-2 pr-3 sm:pr-4 w-full sm:w-auto">
                        {selectedOptionData.option_image_url ? (
                          <img
                            src={selectedOptionData.option_image_url}
                            alt=""
                            className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-neon-iris to-neon-iris flex items-center justify-center flex-shrink-0">
                            <span className="text-sm sm:text-base lg:text-lg font-bold text-white">
                              {selectedOptionData.option_label
                                ?.charAt(0)
                                .toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums leading-none ${
                              primaryYesPrice >= 0.5
                                ? "text-neon-iris"
                                : "text-rose-400"
                            }`}
                          >
                            {getDisplayPercentage(primaryYesPrice)}%
                          </div>
                          <div>
                            <div className="text-[10px] sm:text-[11px] text-moon-grey mt-0.5 truncate">
                              {selectedOptionData.option_label}
                            </div>
                            {selectedOptionData.option_sub_label && (
                              <div className="text-[10px] sm:text-[11px] text-gray-300 mt-0.5 truncate">
                                {selectedOptionData.option_sub_label}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Binary Market */
                      <div className="text-left sm:text-right w-full sm:w-auto">
                        <div
                          className={`text-3xl sm:text-4xl lg:text-5xl font-bold tabular-nums leading-none ${
                            primaryYesPrice >= 0.5
                              ? "text-neon-iris"
                              : "text-rose-400"
                          }`}
                        >
                          {getDisplayPercentage(primaryYesPrice)}%
                        </div>
                        <div className="text-[10px] sm:text-xs text-moon-grey-dark mt-1">
                          Chance
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Bar */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-moon-grey-dark">Volume</span>
                    <span className="text-white font-semibold tabular-nums">
                      {formatUSDC(market.total_volume)}
                    </span>
                  </div>
                  <div className="w-px h-4 bg-white/10 hidden sm:block" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-moon-grey-dark">Liquidity</span>
                    <span className="text-white font-semibold tabular-nums">
                      {formatUSDC(
                        Number((market as any).shared_pool_liquidity || 0) +
                          Number((market as any).accumulated_lp_fees || 0)
                      )}
                    </span>
                    {Number((market as any).accumulated_lp_fees || 0) > 0 && (
                      <span className="text-moon-grey-dark text-[10px]">
                        (pool:{" "}
                        {formatUSDC(
                          Number((market as any).shared_pool_liquidity || 0)
                        )}{" "}
                        + fees:{" "}
                        {formatUSDC(
                          Number((market as any).accumulated_lp_fees || 0)
                        )}
                        )
                      </span>
                    )}
                  </div>
                  <div className="w-px h-4 bg-white/10 hidden sm:block" />
                  <div className="flex items-center gap-1.5">
                    {market.is_resolved ? (
                      <span className="text-neon-iris font-medium">
                        Ended
                      </span>
                    ) : (
                      <>
                        <span className="text-moon-grey-dark">Ends</span>
                        <span className="text-white font-medium text-xs sm:text-sm">
                          {formatTimeRemaining(market.expiration_timestamp)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Social Proof */}
                {!market.is_resolved && (
                  <div className="mt-4">
                    <SocialProof
                      marketId={market.id}
                      recentActivity={[]} // TODO: Add real recent activity
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Price Chart */}
            {id && market.options && (
              <div className="relative overflow-visible rounded-2xl bg-graphite-light/40">
                {/* Gradient Accent Lines */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
                <PriceChart
                  marketId={id}
                  options={market.options.map((option: MarketOption) => ({
                    id: option.id,
                    option_label: option.option_label,
                    option_sub_label: option.option_sub_label || "",
                    yes_quantity: option.yes_quantity,
                    no_quantity: option.no_quantity,
                    yes_price: option.yes_price,
                    yes_shares: option.yes_shares,
                    no_shares: option.no_shares,
                    total_volume: option.total_volume,
                  }))}
                  liquidityParameter={market.liquidity_parameter}
                  isMultipleChoice={isMultipleChoice}
                  isResolved={market.is_resolved}
                  createdAt={
                    new Date(Number(market.created_at) * 1000).toISOString() as
                      | Date
                      | string
                  }
                />
              </div>
            )}

            {/* Outcomes */}
            <div className="relative overflow-visible rounded-2xl bg-graphite-light/60 p-4 sm:p-5">
              {/* Gradient Accent Lines */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">
                  {isMultipleChoice ? `Outcomes` : "Outcome"}
                </h2>
                {isMultipleChoice && (
                  <span className="text-xs text-moon-grey-dark">
                    {market.options?.length} options
                  </span>
                )}
              </div>

              {isMultipleChoice ? (
                <div className="space-y-2">
                  {market.options
                    ?.sort((a, b) => {
                      // First, separate resolved and unresolved options
                      const aResolved = a.is_resolved ?? false;
                      const bResolved = b.is_resolved ?? false;

                      // Resolved options go to the bottom
                      if (aResolved && !bResolved) return 1;
                      if (!aResolved && bResolved) return -1;

                      // Within each group, sort by price
                      const pa =
                        (a as any).yes_price ??
                        calculateYesPrice(
                          a.yes_quantity,
                          a.no_quantity,
                          market.liquidity_parameter,
                          market.is_resolved
                        );
                      const pb =
                        (b as any).yes_price ??
                        calculateYesPrice(
                          b.yes_quantity,
                          b.no_quantity,
                          market.liquidity_parameter,
                          market.is_resolved
                        );
                      return pb - pa;
                    })
                    .map((option, idx) => (
                      <OptionRow
                        key={option.id}
                        option={option}
                        idx={idx}
                        market={market}
                        selectedOption={selectedOption}
                        selectedSide={selectedSide}
                        onSelectOption={handleSelectOption}
                        onResolved={() => id && fetchMarketData(id)}
                        onDisputed={() => id && fetchMarketData(id)}
                        onClaimed={() => id && fetchMarketData(id)}
                      />
                    ))}
                </div>
              ) : (
                // Binary Market
                market.options?.[0] && (
                  <BinaryOptionRow
                    option={market.options[0]}
                    market={market}
                    selectedSide={selectedSide}
                    onSelectOption={handleSelectOption}
                    onResolved={() => id && fetchMarketData(id)}
                    onDisputed={() => id && fetchMarketData(id)}
                    onClaimed={() => id && fetchMarketData(id)}
                  />
                )
              )}
            </div>

            {/* Tabs Section */}
            <div className="relative rounded-2xl bg-graphite-light/60 overflow-visible">
              {/* Gradient Accent Lines */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent z-10" />
              {/* Tab Headers */}
              <div className="flex border-b border-white/[0.04]">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                      activeTab === t.id
                        ? "text-white border-neon-iris"
                        : "text-moon-grey hover:text-white border-transparent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-5">
                {activeTab === "about" && (
                  <div className="space-y-5">
                    {market.market_description && (
                      <p className="text-moon-grey text-sm leading-relaxed">
                        {market.market_description}
                      </p>
                    )}
                    {/* Creator Section */}
                    {(market.creator_username ||
                      market.creator_display_name) && (
                      <div className="bg-white/[0.03] rounded-xl p-4 mb-5">
                        <div className="text-moon-grey-dark text-xs uppercase tracking-wider mb-3">
                          Created By
                        </div>
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={
                              market.creator_display_name ||
                              market.creator_username ||
                              "User"
                            }
                            imageUrl={market.creator_avatar_url}
                            size="md"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link
                                to={getUserProfileUrl(
                                  market.creator_username || market.creator_id
                                )}
                                className="text-white font-semibold text-sm hover:text-neon-iris transition-colors cursor-pointer"
                              >
                                {market.creator_display_name ||
                                  (market.creator_username
                                    ? `@${market.creator_username}`
                                    : "User")}
                              </Link>
                              {market.is_admin_creator && (
                                <div className="flex items-center justify-center w-4 h-4 rounded-full bg-neon-iris flex-shrink-0">
                                  <svg
                                    className="w-3 h-3 text-white"
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
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/[0.03] rounded-xl p-4">
                        <div className="text-moon-grey-dark text-xs uppercase tracking-wider mb-1.5">
                          Status
                        </div>
                        <div
                          className={
                            market.is_resolved
                              ? "text-neon-iris font-semibold"
                              : "text-neon-iris font-semibold"
                          }
                        >
                          {market.is_resolved ? "Resolved" : "Active"}
                        </div>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-4">
                        <div className="text-moon-grey-dark text-xs uppercase tracking-wider mb-1.5">
                          Resolution
                        </div>
                        <div className="text-white font-semibold">
                          {formatDate(market.expiration_timestamp)}
                        </div>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-4">
                        <div className="text-moon-grey-dark text-xs uppercase tracking-wider mb-1.5">
                          Created
                        </div>
                        <div className="text-white font-semibold">
                          {formatDate(market.created_at)}
                        </div>
                      </div>
                    </div>

                    {/* Resolution Viewer - Show for all markets with resolution config */}
                    {id && (market as any).resolution_mode && (
                      <ResolutionViewer marketId={id} />
                    )}
                    {market.is_resolved && id && hasLpShares && (
                      <ClaimLpRewards
                        marketId={id}
                        onClaimed={() => {
                          fetchMarketData(id);
                          setHasLpShares(false); // Reset after claiming
                        }}
                      />
                    )}
                  </div>
                )}

                {activeTab === "activity" && (
                  <div>
                    {isLoadingActivities ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-14 bg-white/[0.03] rounded-xl animate-pulse"
                          />
                        ))}
                      </div>
                    ) : activities.length === 0 ? (
                      <div className="py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                          <svg
                            className="w-5 h-5 text-moon-grey-dark"
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
                        </div>
                        <p className="text-moon-grey-dark text-sm">
                          No activity yet
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {activities.map((a) => {
                            const meta = (a as any).metadata || a || {};
                            const type = (a as any).activity_type || a.type;
                            const side = meta.side;
                            const shares =
                              meta.quantity ||
                              meta.yes_shares ||
                              meta.no_shares;
                            const amt = meta.total_cost;

                            const style =
                              type === "trade"
                                ? side === "yes"
                                  ? {
                                      bg: "bg-muted-green/15",
                                      text: "text-muted-green",
                                      icon: "↑",
                                    }
                                  : {
                                      bg: "bg-rose-500/15",
                                      text: "text-rose-400",
                                      icon: "↓",
                                    }
                                : type === "market_created"
                                ? {
                                    bg: "bg-neon-iris/15",
                                    text: "text-neon-iris",
                                    icon: "✦",
                                  }
                                : type === "market_resolved"
                                ? {
                                    bg: "bg-amber-500/15",
                                    text: "text-amber-400",
                                    icon: "✓",
                                  }
                                : {
                                    bg: "bg-white/5",
                                    text: "text-moon-grey",
                                    icon: "•",
                                  };

                            const desc =
                              type === "trade"
                                ? `${
                                    meta.trade_type === "buy"
                                      ? "Bought"
                                      : "Sold"
                                  } ${formatShares(shares)} ${
                                    side?.toUpperCase() || ""
                                  }`
                                : type === "market_created"
                                ? "Market created"
                                : type === "market_resolved"
                                ? `${meta.winning_side?.toUpperCase()} wins`
                                : type || "Activity";

                            return (
                              <div
                                key={a.id}
                                className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl"
                              >
                                <div
                                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${style.bg} ${style.text}`}
                                >
                                  {style.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-medium truncate">
                                    {desc}
                                  </p>
                                  <p className="text-moon-grey-dark text-[11px]">
                                    @
                                    {a.username ||
                                      (a as any).display_name ||
                                      "anon"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  {amt && (
                                    <p className="text-white text-sm font-semibold tabular-nums">
                                      ${(Number(amt) / 1e6).toFixed(2)}
                                    </p>
                                  )}
                                  <p className="text-moon-grey-dark text-[11px]">
                                    {formatDistanceToNow(Number(a.created_at))}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/[0.04]">
                          <button
                            onClick={() =>
                              currentPage > 1 && loadActivities(currentPage - 1)
                            }
                            disabled={currentPage === 1}
                            className="text-xs text-moon-grey hover:text-white disabled:opacity-30 transition-colors"
                          >
                            ← Previous
                          </button>
                          <span className="text-xs text-moon-grey-dark tabular-nums">
                            Page {currentPage}
                          </span>
                          <button
                            onClick={() =>
                              hasMoreActivities &&
                              loadActivities(currentPage + 1)
                            }
                            disabled={!hasMoreActivities}
                            className="text-xs text-moon-grey hover:text-white disabled:opacity-30 transition-colors"
                          >
                            Next →
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "discussion" && id && (
                  <CommentSection marketId={id} market={market} />
                )}
              </div>
            </div>
          </section>

          <aside className="lg:w-[380px] lg:sticky lg:top-20">
            <div className="overflow-visible" ref={tradeFormRef}>
              {/* LP Rewards Claim - Prominent Display */}
              {market.is_resolved && id && hasLpShares && (
                <div className="relative overflow-visible rounded-xl bg-gradient-to-br from-success-500/20 via-success-500/10 to-success-500/5 border border-success-500/30">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-success-400/50 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-success-400/30 to-transparent" />
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg
                        className="w-5 h-5 text-success-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <h3 className="text-sm font-semibold text-white">
                        Claim LP Rewards
                      </h3>
                    </div>
                    <ClaimLpRewards
                      marketId={id}
                      onClaimed={() => {
                        if (id) fetchMarketData(id);
                        setHasLpShares(false);
                      }}
                      compact={true}
                    />
                  </div>
                </div>
              )}

              {/* Market Resolved - Show when market is fully resolved and user doesn't have LP or has already claimed */}
              {market.is_resolved &&
                allOptionsResolved &&
                id &&
                !hasLpShares && (
                  <div className="relative overflow-visible rounded-xl bg-gradient-to-br from-neon-iris/20 via-neon-iris/10 to-neon-iris/5 border border-neon-iris/30">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <svg
                          className="w-5 h-5 text-neon-iris"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <h3 className="text-sm font-semibold text-white">
                          Market Resolved
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {hasResolvedOption ? (
                          <div className="text-sm text-neon-iris/80">
                            {isMultipleChoice ? (
                              <div>
                                <div className="font-medium text-white mb-1">
                                  Winning Option:
                                </div>
                                <div className="text-neon-iris">
                                  {winningOptions[0]
                                    ? winningOptions[0].option_label
                                    : "N/A"}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium text-white mb-1">
                                  Winner:
                                </div>
                                <div className={primaryOption?.winning_side === 1 ? "text-muted-green" : "text-rose-400"}>
                                  {primaryOption?.winning_side === 1
                                    ? "YES"
                                    : "NO"}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-neon-iris/80">
                            All options have been resolved.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {/* Trading Context */}
              {!market.is_resolved &&
                selectedOptionData &&
                isMultipleChoice && <> </>}

              {/* Trade Form */}
              {!market.is_resolved && (
                <TradeForm
                  key={`${selectedOption || "def"}-${
                    selectedOptionData?.yes_quantity
                  }-${selectedOptionData?.no_quantity}`}
                  market={market}
                  selectedOption={selectedOptionData}
                  preSelectedSide={selectedSide}
                  onTradeComplete={() => id && fetchMarketData(id)}
                />
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile LP Rewards Claim - Prominent Display */}
      {market.is_resolved && id && hasLpShares && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-ink-black via-ink-black to-transparent z-40">
          <div className="relative overflow-visible rounded-xl bg-gradient-to-br from-success-500/20 via-success-500/10 to-success-500/5 border border-success-500/30 p-4 mb-2">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-success-400/50 to-transparent" />
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-5 h-5 text-success-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-sm font-semibold text-white">
                Claim LP Rewards
              </h3>
            </div>
            <ClaimLpRewards
              marketId={id}
              onClaimed={() => {
                if (id) fetchMarketData(id);
                setHasLpShares(false); // Reset after claiming
              }}
              compact={true}
            />
          </div>
        </div>
      )}

      {/* Mobile Market Resolved - Show when market is fully resolved and user doesn't have LP or has already claimed */}
      {market.is_resolved && allOptionsResolved && id && !hasLpShares && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-ink-black via-ink-black to-transparent z-40">
          <div className="relative overflow-visible rounded-xl bg-gradient-to-br from-neon-iris/20 via-neon-iris/10 to-neon-iris/5 border border-neon-iris/30 p-3 sm:p-4 mb-2">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-neon-iris flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-xs sm:text-sm font-semibold text-white">
                Market Resolved
              </h3>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              {hasResolvedOption ? (
                <div className="text-xs sm:text-sm text-neon-iris/80">
                  {isMultipleChoice ? (
                    <div>
                      <div className="font-medium text-white mb-1 text-xs sm:text-sm">
                        Winning Option:
                      </div>
                      <div className="text-neon-iris break-words line-clamp-2 text-xs sm:text-sm">
                        {winningOptions[0]
                          ? winningOptions[0].option_label
                          : "N/A"}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium text-white mb-1 text-xs sm:text-sm">
                        Winner:
                      </div>
                      <div className={`text-xs sm:text-sm ${
                        primaryOption?.winning_side === 1 ? "text-muted-green" : "text-rose-400"
                      }`}>
                        {primaryOption?.winning_side === 1 ? "YES" : "NO"}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs sm:text-sm text-neon-iris/80">
                  All options have been resolved.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Trade Panel - Shows when scrolled */}
      {!market.is_resolved && (
        <div
          className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
            isScrolled
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-full pointer-events-none"
          }`}
        >
          <div className="bg-graphite-light/95 backdrop-blur-md border-t border-white/10 shadow-lg">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                {/* Market Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-moon-grey-dark truncate mb-0.5">
                    {isMultipleChoice && selectedOptionData
                      ? selectedOptionData.option_label
                      : market.question}
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-lg font-bold tabular-nums ${
                        primaryYesPrice >= 0.5
                          ? "text-neon-iris"
                          : "text-rose-400"
                      }`}
                    >
                      {(primaryYesPrice * 100).toFixed(1)}%
                    </div>
                    <span className="text-xs text-moon-grey-dark">/</span>
                    <div
                      className={`text-lg font-bold tabular-nums ${
                        primaryYesPrice >= 0.5
                          ? "text-rose-400"
                          : "text-neon-iris"
                      }`}
                    >
                      {((1 - primaryYesPrice) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Quick Trade Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setSelectedSide("yes");
                      setShowMobileTradePanel(true);
                    }}
                    className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                      selectedSide === "yes"
                        ? "bg-muted-green text-white shadow-lg shadow-muted-green/25"
                        : "bg-muted-green/15 text-muted-green"
                    }`}
                  >
                    YES {(primaryYesPrice * 100).toFixed(1)}¢
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSide("no");
                      setShowMobileTradePanel(true);
                    }}
                    className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                      selectedSide === "no"
                        ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                        : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    NO {((1 - primaryYesPrice) * 100).toFixed(1)}¢
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Trade Panel - Full screen slide from right */}
      {showMobileTradePanel && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-graphite-light overflow-y-auto animate-slide-in-right"
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            {/* Header with close button */}
            <div className="sticky top-0 bg-graphite-light pt-4 pb-3 px-4 border-b border-white/[0.04] z-10">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">Trade</h2>
                  {selectedOptionData && isMultipleChoice && (
                    <p className="text-sm text-moon-grey-dark mt-1">
                      {selectedOptionData.option_label}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowMobileTradePanel(false)}
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  aria-label="Close trade panel"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Side Selection */}
            <div className="p-4 border-b border-white/[0.04]">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedSide("yes")}
                  className={`py-3.5 rounded-xl font-semibold transition-all ${
                    selectedSide === "yes"
                      ? "bg-muted-green text-white shadow-lg shadow-muted-green/25"
                      : "bg-muted-green/15 text-muted-green"
                  }`}
                >
                  YES {(primaryYesPrice * 100).toFixed(1)}¢
                </button>
                <button
                  onClick={() => setSelectedSide("no")}
                  className={`py-3.5 rounded-xl font-semibold transition-all ${
                    selectedSide === "no"
                      ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                      : "bg-rose-500/15 text-rose-400"
                  }`}
                >
                  NO {((1 - primaryYesPrice) * 100).toFixed(1)}¢
                </button>
              </div>
            </div>

            {/* Trade Form */}
            <div className="px-4 pt-4 pb-8">
              <TradeForm
                key={`m-${selectedOption}-${selectedOptionData?.yes_quantity}-${selectedOptionData?.no_quantity}`}
                market={market}
                selectedOption={selectedOptionData}
                preSelectedSide={selectedSide}
                onTradeComplete={() => {
                  id && fetchMarketData(id);
                  setShowMobileTradePanel(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
