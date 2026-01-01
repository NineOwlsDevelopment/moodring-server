import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
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
import { ShareModal } from "@/components/ShareModal";
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
        className={`relative p-3 sm:p-4 flex items-center gap-3 sm:gap-4 transition-all duration-300 border ${
          resolved
            ? "opacity-60 cursor-default border-white/[0.04] bg-white/[0.01]"
            : sel
            ? "border-neon-iris/30 bg-neon-iris/5 cursor-pointer"
            : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.08] cursor-pointer"
        }`}
      >
        {/* Progress Bar - Refined */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              parseFloat(yc) >= 50
                ? "bg-gradient-to-r from-muted-green/[0.06] to-transparent"
                : parseFloat(yc) >= 25
                ? "bg-gradient-to-r from-amber-500/[0.06] to-transparent"
                : "bg-gradient-to-r from-rose-500/[0.06] to-transparent"
            }`}
            style={{ width: `${yc}%` }}
          />
        </div>

        {/* Rank/Image - Refined */}
        {option.option_image_url ? (
          <img
            src={option.option_image_url}
            alt=""
            className="relative w-10 h-10 object-cover flex-shrink-0 ring-1 ring-white/10"
          />
        ) : (
          <div className="relative w-10 h-10 border border-white/[0.08] flex items-center justify-center text-xs font-light text-moon-grey/60 flex-shrink-0">
            {idx + 1}
          </div>
        )}

        {/* Label */}
        <div className="relative flex-1 min-w-0 pr-2">
          <div>
            <span className="text-sm text-white font-light break-words line-clamp-2">
              {option.option_label}
            </span>
            {option.option_sub_label && (
              <div className="text-moon-grey/60 text-xs mt-0.5 break-words font-light">
                {option.option_sub_label}
              </div>
            )}
          </div>
          {!resolved && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-moon-grey/50 tabular-nums tracking-wide">
                <span className="text-muted-green/60">
                  {formatShares(option.yes_quantity || 0)}
                </span>
                {" / "}
                <span className="text-rose-400/60">
                  {formatShares(option.no_quantity || 0)}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Percentage - Refined */}
        <span
          className={`relative text-base sm:text-lg font-light tabular-nums mr-3 flex-shrink-0 ${
            parseFloat(yc) >= 50
              ? "text-muted-green"
              : parseFloat(yc) >= 25
              ? "text-amber-400"
              : "text-rose-400"
          }`}
        >
          {yc}%
        </span>

        {/* Action Buttons - Refined */}
        {!resolved && (
          <div className="relative hidden sm:flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectOption(option.id, "yes");
              }}
              className={`px-3 py-1.5 text-[10px] tracking-wide uppercase font-medium transition-all whitespace-nowrap ${
                sel && selectedSide === "yes"
                  ? "bg-muted-green text-white"
                  : "bg-muted-green/10 text-muted-green border border-muted-green/30 hover:bg-muted-green/20"
              }`}
            >
              Yes {yc}¢
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectOption(option.id, "no");
              }}
              className={`px-3 py-1.5 text-[10px] tracking-wide uppercase font-medium transition-all whitespace-nowrap ${
                sel && selectedSide === "no"
                  ? "bg-rose-500 text-white"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
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

        {/* Resolved state */}
        {resolved && (
          <div className="relative flex items-center gap-2 flex-shrink-0 flex-wrap">
            <span className="relative px-2.5 py-1 text-[10px] tracking-wide uppercase font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
              <span className="relative px-2.5 py-1 text-[10px] tracking-wide uppercase font-medium bg-neon-iris/10 text-neon-iris border border-neon-iris/20 flex items-center gap-1 ml-auto">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
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
        <div className="mt-3 ml-0 sm:ml-14">
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button
          onClick={() => !resolved && onSelectOption(option?.id || "", "yes")}
          className={`relative p-4 sm:p-5 lg:p-6 text-center transition-all duration-300 border ${
            resolved
              ? winner === 1
                ? "border-muted-green/40 bg-muted-green/10"
                : "opacity-40 border-white/[0.04]"
              : selectedSide === "yes"
              ? "border-muted-green/40 bg-muted-green/10"
              : "border-white/[0.06] bg-white/[0.02] hover:bg-muted-green/5 hover:border-muted-green/20"
          }`}
        >
          <div className="relative">
            <div className="text-muted-green text-[10px] tracking-[0.15em] uppercase font-medium mb-2">
              Yes {resolved && winner === 1 && "✓"}
            </div>
            <div className="text-3xl sm:text-4xl font-light text-muted-green tabular-nums">
              {resolved && winner === 1 ? "$1" : `${yc}¢`}
            </div>
            <div className="text-muted-green/40 text-[10px] tracking-wide mt-2 break-words">
              {formatShares(option?.yes_quantity || 0)} shares
            </div>
          </div>
        </button>
        <button
          onClick={() => !resolved && onSelectOption(option?.id || "", "no")}
          className={`relative p-4 sm:p-5 lg:p-6 text-center transition-all duration-300 border ${
            resolved
              ? winner === 2
                ? "border-rose-500/40 bg-rose-500/10"
                : "opacity-40 border-white/[0.04]"
              : selectedSide === "no"
              ? "border-rose-500/40 bg-rose-500/10"
              : "border-white/[0.06] bg-white/[0.02] hover:bg-rose-500/5 hover:border-rose-500/20"
          }`}
        >
          <div className="relative">
            <div className="text-rose-400 text-[10px] tracking-[0.15em] uppercase font-medium mb-2">
              No {resolved && winner === 2 && "✓"}
            </div>
            <div className="text-3xl sm:text-4xl font-light text-rose-400 tabular-nums">
              {resolved && winner === 2 ? "$1" : `${nc}¢`}
            </div>
            <div className="text-rose-400/40 text-[10px] tracking-wide mt-2 break-words">
              {formatShares(option?.no_quantity || 0)} shares
            </div>
          </div>
        </button>
      </div>

      {/* Binary Resolve Button */}
      {!resolved && option && (
        <div className="mt-4 flex justify-end">
          <ResolveButton
            market={market}
            option={option}
            onResolved={onResolved}
          />
        </div>
      )}

      {/* Resolved state with integrated dispute period info */}
      {resolved && option && (
        <div className="mt-4 space-y-3">
          {/* Dispute period active */}
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

          {/* Dispute period ended */}
          {disputePeriodEnded && (
            <div className="px-4 py-3 bg-neon-iris/5 border border-neon-iris/20">
              <div className="flex items-center gap-2 text-xs text-neon-iris">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-light tracking-wide">
                  Dispute period ended — Resolution is final
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
  const [showShareModal, setShowShareModal] = useState(false);

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
      <div className="min-h-screen bg-ink-black flex items-center justify-center relative overflow-hidden">
        {/* Atmospheric background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(124,77,255,0.12),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_80%_100%,rgba(33,246,210,0.06),transparent_40%)]" />
        </div>
        <motion.div
          className="text-center relative z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-10 h-10 border-2 border-neon-iris/60 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-moon-grey/70 text-sm font-light tracking-wide">
            Loading market...
          </p>
        </motion.div>
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

  // Get base URL for embeds
  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "https://moodring.io";
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
  const marketUrl = `${baseUrl}/market/${id}`;
  // Always use market's image_url if it exists and is not empty, otherwise fallback to icon
  const marketImage =
    market.image_url && market.image_url.trim() !== ""
      ? market.image_url
      : `${baseUrl}/icon.png`;

  // Build options text for description
  let optionsText = "";
  if (market.options && market.options.length > 0) {
    const optionPrices: Array<{ label: string; price: number }> = [];

    // Calculate prices for all options first
    for (const option of market.options) {
      try {
        const yesPrice =
          (option as any).yes_price ??
          calculateYesPrice(
            option.yes_quantity || 0,
            option.no_quantity || 0,
            market.liquidity_parameter,
            market.is_resolved
          );

        if (market.is_binary) {
          // Binary market: show Yes and No
          optionPrices.push({ label: "Yes", price: yesPrice });
          optionPrices.push({ label: "No", price: 1 - yesPrice });
          break; // Only need first option for binary
        } else {
          // Multiple choice: show option label
          optionPrices.push({ label: option.option_label, price: yesPrice });
        }
      } catch (e) {
        // Skip if calculation fails
      }
    }

    // Sort by price (highest first) and take top 2-3
    optionPrices.sort((a, b) => b.price - a.price);
    const topOptions = market.is_binary
      ? optionPrices
      : optionPrices.slice(0, 3);

    // Format options text
    if (topOptions.length > 0) {
      optionsText =
        " • " +
        topOptions
          .map((op) => `${op.label}: ${(op.price * 100).toFixed(1)}%`)
          .join(" | ");
    }
  }

  // Build description with options
  const marketDescription = market.market_description
    ? market.market_description.substring(0, 150) +
      (market.market_description.length > 150 ? "..." : "") +
      optionsText
    : `Trade on ${market.question}${optionsText}`;
  const marketTitle = `${market.question} | Moodring`;

  return (
    <div className="min-h-screen bg-ink-black relative overflow-hidden">
      {/* Atmospheric background matching Home */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_90%_100%,rgba(33,246,210,0.06),transparent_40%)]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02] hidden sm:block"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Gradient line accent at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/20 to-transparent z-10" />

      <Helmet>
        {/* Primary Meta Tags */}
        <title>{marketTitle}</title>
        <meta name="title" content={marketTitle} />
        <meta name="description" content={marketDescription} />
        <link rel="canonical" href={marketUrl} />

        {/* oEmbed Discovery */}
        <link
          rel="alternate"
          type="application/json+oembed"
          href={`${apiUrl}/market/${id}/oembed`}
          title={marketTitle}
        />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={marketUrl} />
        <meta property="og:title" content={marketTitle} />
        <meta property="og:description" content={marketDescription} />
        <meta property="og:image" content={marketImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Moodring" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={marketUrl} />
        <meta name="twitter:title" content={marketTitle} />
        <meta name="twitter:description" content={marketDescription} />
        <meta name="twitter:image" content={marketImage} />
      </Helmet>
      <div
        className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 pb-24 lg:pb-12"
        data-market-detail-container
      >
        {/* Breadcrumb - Refined styling */}
        <motion.div
          className="relative z-40 mb-6"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Link
            to="/markets"
            className="group inline-flex items-center gap-2 text-moon-grey/70 hover:text-white text-xs tracking-wide uppercase transition-all duration-300"
          >
            <svg
              className="w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>Back to Markets</span>
          </Link>
        </motion.div>

        {/* Resolution Mode - Refined minimal display */}
        {(market as any).resolution_mode && (
          <motion.div
            className="relative group mb-5"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="inline-flex items-center gap-2.5 text-[10px] tracking-[0.15em] uppercase">
              <div className="h-px w-6 bg-gradient-to-r from-transparent to-amber-400/40" />
              <span className="text-amber-400/60 font-medium">Resolution:</span>
              <span className="text-amber-400 font-medium">
                {(market as any).resolution_mode}
              </span>
              <svg
                className="w-3 h-3 text-amber-400/40 cursor-help"
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
              <div className="bg-graphite-deep/95 backdrop-blur-sm border border-white/10 rounded-lg p-4 shadow-2xl min-w-[200px] max-w-[300px]">
                <div className="text-xs text-white font-medium mb-1.5">
                  {(market as any).resolution_mode === "ORACLE" &&
                    "Oracle Mode"}
                  {(market as any).resolution_mode === "AUTHORITY" &&
                    "Authority Mode"}
                  {(market as any).resolution_mode === "OPINION" &&
                    "Opinion Mode"}
                </div>
                <div className="text-xs text-moon-grey/70 font-light leading-relaxed">
                  {(market as any).resolution_mode === "ORACLE" &&
                    "Resolved by Oracles"}
                  {(market as any).resolution_mode === "AUTHORITY" &&
                    "Resolved by market creator"}
                  {(market as any).resolution_mode === "OPINION" &&
                    "Market price determines outcome"}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Sticky Header - Refined minimal styling */}
        <div
          className={`hidden lg:block fixed top-16 z-40 transition-all duration-500 ${
            isScrolled
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-4 pointer-events-none"
          }`}
          style={{
            left: heroLeft !== null ? `${heroLeft}px` : undefined,
            width: heroWidth ? `${heroWidth}px` : undefined,
            maxWidth: heroWidth ? `${heroWidth}px` : undefined,
          }}
        >
          <div className="w-full relative">
            {/* Gradient accent lines */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="bg-graphite-deep/90 backdrop-blur-xl border border-white/5 shadow-2xl">
              <div className="flex items-center justify-between py-3 px-5">
                {/* Title and Option Info */}
                <div className="flex-1 min-w-0 flex items-center gap-4">
                  {market.image_url && (
                    <img
                      src={market.image_url}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/10"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-medium text-white leading-tight truncate min-w-0 tracking-tight">
                      {market.question}
                    </h1>

                    {!allOptionsResolved && highestLikelihoodOption && (
                      <div className="flex items-center gap-2 mt-1">
                        {isMultipleChoice &&
                          highestLikelihoodOption.option_image_url && (
                            <img
                              src={highestLikelihoodOption.option_image_url}
                              alt=""
                              className="w-5 h-5 rounded object-cover flex-shrink-0"
                            />
                          )}

                        <span className="text-xs font-light text-moon-grey/70 truncate">
                          {highestLikelihoodOption.option_label}
                        </span>

                        <span
                          className={`text-xs font-medium tabular-nums ${
                            highestLikelihoodPrice >= 0.5
                              ? "text-neon-iris"
                              : "text-rose-400"
                          }`}
                        >
                          {(highestLikelihoodPrice * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Share Button */}
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-neon-iris/30 transition-all duration-300 text-moon-grey/60 hover:text-white ml-auto"
                    title="Share market"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
          {/* Left Column */}
          <motion.section
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            {/* Hero Card */}
            <motion.div
              ref={heroRef}
              className="relative overflow-hidden bg-graphite-deep/60 border border-white/[0.06]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* Market Image Background */}
              {market.image_url && (
                <div className="absolute inset-0">
                  <img
                    src={market.image_url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover max-w-full max-h-full opacity-40"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-ink-black/95 via-graphite-deep/90 to-graphite-deep/95" />
                  {/* Vignette overlay */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(10,10,13,0.9) 100%)",
                    }}
                  />
                </div>
              )}

              {/* Gradient Accent Lines - Premium styling */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/40 to-transparent z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse/20 to-transparent z-10" />
              <div className="absolute top-0 left-0 w-px h-24 bg-gradient-to-b from-neon-iris/30 to-transparent z-10" />
              <div className="absolute top-0 right-0 w-px h-24 bg-gradient-to-b from-neon-iris/30 to-transparent z-10" />

              <div className="relative z-10 p-5 sm:p-7 lg:p-8">
                {/* Top Bar - Creator & Actions */}
                <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                  <div className="flex items-center gap-3">
                    <WatchlistButton marketId={market.id} />
                    {/* Creator Info - Refined */}
                    {(market.creator_username ||
                      market.creator_display_name) && (
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
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={getUserProfileUrl(
                              market.creator_username || market.creator_id
                            )}
                            className="text-xs text-moon-grey/70 font-light hover:text-white transition-colors cursor-pointer"
                          >
                            {market.creator_display_name ||
                              (market.creator_username
                                ? `@${market.creator_username}`
                                : "User")}
                          </Link>
                          {market.is_admin_creator && (
                            <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gradient-to-br from-neon-iris to-aqua-pulse flex-shrink-0">
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
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {categories.slice(0, 2).map((cat) => (
                      <span
                        key={cat.id}
                        className="px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase font-medium text-moon-grey/60 border border-white/[0.06]"
                      >
                        {cat.name}
                      </span>
                    ))}
                    {categories.length === 0 && (
                      <span className="px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase font-medium text-moon-grey/60 border border-white/[0.06]">
                        {primaryCategory}
                      </span>
                    )}
                    {market.is_resolved && (
                      <span className="px-2.5 py-1 text-[10px] tracking-[0.15em] uppercase font-medium bg-neon-iris/10 text-neon-iris border border-neon-iris/20">
                        Resolved
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
                    {/* Share Button - Refined */}
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-neon-iris/30 transition-all duration-300 text-moon-grey/60 hover:text-white"
                      title="Share market"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                      <span className="text-[10px] tracking-wide uppercase font-medium">
                        Share
                      </span>
                    </button>
                  </div>
                </div>

                {/* Title & Probability - Premium typography */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-5 mb-6">
                  <h1 className="flex-1 text-2xl sm:text-3xl lg:text-4xl font-light text-white leading-[1.15] tracking-tight break-words min-w-0">
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
                          <div
                            className={`text-3xl sm:text-4xl lg:text-5xl font-bold tabular-nums leading-none ${
                              primaryOption?.winning_side === 1
                                ? "text-muted-green"
                                : "text-rose-400"
                            }`}
                          >
                            {primaryOption?.winning_side === 1 ? "YES" : "NO"}
                          </div>
                          <div
                            className={`text-[10px] sm:text-xs mt-1 ${
                              primaryOption?.winning_side === 1
                                ? "text-muted-green/70"
                                : "text-rose-400/70"
                            }`}
                          >
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

                {/* Stats Bar - Refined with better spacing */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-8 pt-5 border-t border-white/[0.06]">
                  <div>
                    <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-1">
                      Volume
                    </div>
                    <div className="text-lg font-light text-white tabular-nums">
                      {formatUSDC(market.total_volume)}
                    </div>
                  </div>
                  <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/10 to-transparent hidden sm:block" />
                  <div>
                    <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-1">
                      Liquidity
                    </div>
                    <div className="text-lg font-light text-white tabular-nums">
                      {formatUSDC(
                        Number((market as any).shared_pool_liquidity || 0) +
                          Number((market as any).accumulated_lp_fees || 0)
                      )}
                    </div>
                  </div>
                  <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/10 to-transparent hidden sm:block" />
                  <div>
                    <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-1">
                      {market.is_resolved ? "Status" : "Ends"}
                    </div>
                    {market.is_resolved ? (
                      <div className="text-lg font-light text-neon-iris">
                        Ended
                      </div>
                    ) : (
                      <div className="text-lg font-light text-white">
                        {formatTimeRemaining(market.expiration_timestamp)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Social Proof */}
                {!market.is_resolved && (
                  <div className="mt-5 pt-5 border-t border-white/[0.04]">
                    <SocialProof marketId={market.id} recentActivity={[]} />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Price Chart */}
            {id && market.options && (
              <motion.div
                className="relative overflow-visible bg-graphite-deep/40 border border-white/[0.04]"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {/* Gradient Accent Lines */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent z-10" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />
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
              </motion.div>
            )}

            {/* Outcomes */}
            <motion.div
              className="relative overflow-visible bg-graphite-deep/40 border border-white/[0.04] p-5 sm:p-6"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              {/* Gradient Accent Lines */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-px w-6 bg-gradient-to-r from-neon-iris/50 to-transparent" />
                  <h2 className="text-[10px] tracking-[0.2em] uppercase font-medium text-moon-grey/70">
                    {isMultipleChoice ? `Outcomes` : "Outcome"}
                  </h2>
                </div>
                {isMultipleChoice && (
                  <span className="text-[10px] tracking-wider uppercase text-moon-grey/50">
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
            </motion.div>

            {/* Tabs Section */}
            <motion.div
              className="relative bg-graphite-deep/40 border border-white/[0.04] overflow-visible"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {/* Gradient Accent Lines */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />

              {/* Tab Headers - Refined */}
              <div className="flex border-b border-white/[0.04]">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`relative flex items-center gap-2 px-5 py-4 text-xs tracking-wide uppercase font-medium transition-all duration-300 ${
                      activeTab === t.id
                        ? "text-white"
                        : "text-moon-grey/60 hover:text-white"
                    }`}
                  >
                    {t.label}
                    {activeTab === t.id && (
                      <motion.div
                        className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-neon-iris to-transparent"
                        layoutId="activeTab"
                        transition={{ duration: 0.3 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-5 sm:p-6">
                {activeTab === "about" && (
                  <div className="space-y-6">
                    {market.market_description && (
                      <p className="text-moon-grey/80 text-sm leading-relaxed font-light">
                        {market.market_description}
                      </p>
                    )}
                    {/* Creator Section - Refined */}
                    {(market.creator_username ||
                      market.creator_display_name) && (
                      <div className="border border-white/[0.04] p-5">
                        <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-4">
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
                            <div className="flex items-center gap-2">
                              <Link
                                to={getUserProfileUrl(
                                  market.creator_username || market.creator_id
                                )}
                                className="text-white font-medium text-sm hover:text-neon-iris transition-colors cursor-pointer"
                              >
                                {market.creator_display_name ||
                                  (market.creator_username
                                    ? `@${market.creator_username}`
                                    : "User")}
                              </Link>
                              {market.is_admin_creator && (
                                <div className="flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-neon-iris to-aqua-pulse flex-shrink-0">
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
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/[0.04]">
                      <div className="bg-ink-black p-4">
                        <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2">
                          Status
                        </div>
                        <div
                          className={`text-base font-light ${
                            market.is_resolved
                              ? "text-neon-iris"
                              : "text-aqua-pulse"
                          }`}
                        >
                          {market.is_resolved ? "Resolved" : "Active"}
                        </div>
                      </div>
                      <div className="bg-ink-black p-4">
                        <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2">
                          Resolution
                        </div>
                        <div className="text-base font-light text-white">
                          {formatDate(market.expiration_timestamp)}
                        </div>
                      </div>
                      <div className="bg-ink-black p-4 col-span-2 sm:col-span-1">
                        <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2">
                          Created
                        </div>
                        <div className="text-base font-light text-white">
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
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-16 bg-white/[0.02] border border-white/[0.04] animate-pulse"
                          />
                        ))}
                      </div>
                    ) : activities.length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="w-14 h-14 border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                          <svg
                            className="w-6 h-6 text-moon-grey/40"
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
                        <p className="text-moon-grey/50 text-xs tracking-wide uppercase">
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
                                      bg: "bg-muted-green/10",
                                      border: "border-muted-green/20",
                                      text: "text-muted-green",
                                      icon: "↑",
                                    }
                                  : {
                                      bg: "bg-rose-500/10",
                                      border: "border-rose-500/20",
                                      text: "text-rose-400",
                                      icon: "↓",
                                    }
                                : type === "market_created"
                                ? {
                                    bg: "bg-neon-iris/10",
                                    border: "border-neon-iris/20",
                                    text: "text-neon-iris",
                                    icon: "✦",
                                  }
                                : type === "market_resolved"
                                ? {
                                    bg: "bg-amber-500/10",
                                    border: "border-amber-500/20",
                                    text: "text-amber-400",
                                    icon: "✓",
                                  }
                                : {
                                    bg: "bg-white/[0.02]",
                                    border: "border-white/[0.06]",
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
                                className={`flex items-center gap-4 p-4 border ${style.border} ${style.bg} transition-colors`}
                              >
                                <div
                                  className={`w-9 h-9 flex items-center justify-center text-sm font-light ${style.text}`}
                                >
                                  {style.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-light truncate">
                                    {desc}
                                  </p>
                                  <p className="text-moon-grey/50 text-[11px] mt-0.5">
                                    @
                                    {a.username ||
                                      (a as any).display_name ||
                                      "anon"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  {amt && (
                                    <p className="text-white text-sm font-light tabular-nums">
                                      ${(Number(amt) / 1e6).toFixed(2)}
                                    </p>
                                  )}
                                  <p className="text-moon-grey/50 text-[10px] mt-0.5">
                                    {formatDistanceToNow(Number(a.created_at))}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center mt-5 pt-5 border-t border-white/[0.04]">
                          <button
                            onClick={() =>
                              currentPage > 1 && loadActivities(currentPage - 1)
                            }
                            disabled={currentPage === 1}
                            className="text-[10px] tracking-wide uppercase text-moon-grey/60 hover:text-white disabled:opacity-30 transition-colors"
                          >
                            ← Previous
                          </button>
                          <span className="text-[10px] tracking-wide text-moon-grey/40 tabular-nums">
                            Page {currentPage}
                          </span>
                          <button
                            onClick={() =>
                              hasMoreActivities &&
                              loadActivities(currentPage + 1)
                            }
                            disabled={!hasMoreActivities}
                            className="text-[10px] tracking-wide uppercase text-moon-grey/60 hover:text-white disabled:opacity-30 transition-colors"
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
            </motion.div>
          </motion.section>

          <motion.aside
            className="lg:w-[400px] lg:sticky lg:top-20"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="overflow-visible space-y-4" ref={tradeFormRef}>
              {/* LP Rewards Claim - Refined Display */}
              {market.is_resolved && id && hasLpShares && (
                <div className="relative overflow-visible bg-aqua-pulse/5 border border-aqua-pulse/20">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse/20 to-transparent" />
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 flex items-center justify-center border border-aqua-pulse/30">
                        <svg
                          className="w-4 h-4 text-aqua-pulse"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-white">
                          Claim LP Rewards
                        </h3>
                        <p className="text-[10px] text-aqua-pulse/70 tracking-wide">
                          Available to claim
                        </p>
                      </div>
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

              {/* Market Resolved - Refined styling */}
              {market.is_resolved &&
                allOptionsResolved &&
                id &&
                !hasLpShares && (
                  <div className="relative overflow-visible bg-neon-iris/5 border border-neon-iris/20">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/20 to-transparent" />
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 flex items-center justify-center border border-neon-iris/30">
                          <svg
                            className="w-4 h-4 text-neon-iris"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-white">
                            Market Resolved
                          </h3>
                          <p className="text-[10px] text-neon-iris/60 tracking-wide uppercase">
                            Final outcome
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-neon-iris/10">
                        {hasResolvedOption ? (
                          <div>
                            {isMultipleChoice ? (
                              <div>
                                <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2">
                                  Winning Option
                                </div>
                                <div className="text-lg font-light text-neon-iris">
                                  {winningOptions[0]
                                    ? winningOptions[0].option_label
                                    : "N/A"}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2">
                                  Winner
                                </div>
                                <div
                                  className={`text-2xl font-light ${
                                    primaryOption?.winning_side === 1
                                      ? "text-muted-green"
                                      : "text-rose-400"
                                  }`}
                                >
                                  {primaryOption?.winning_side === 1
                                    ? "YES"
                                    : "NO"}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-neon-iris/70 font-light">
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

              {/* Trade Form - Wrapped with styling */}
              {!market.is_resolved && (
                <div className="relative bg-graphite-deep/60 border border-white/[0.06]">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <TradeForm
                    key={`${selectedOption || "def"}-${
                      selectedOptionData?.yes_quantity
                    }-${selectedOptionData?.no_quantity}`}
                    market={market}
                    selectedOption={selectedOptionData}
                    preSelectedSide={selectedSide}
                    onTradeComplete={() => id && fetchMarketData(id)}
                  />
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      </div>

      {/* Mobile LP Rewards Claim - Refined */}
      {market.is_resolved && id && hasLpShares && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-ink-black via-ink-black/95 to-transparent z-40">
          <div className="relative bg-aqua-pulse/5 border border-aqua-pulse/20 p-4">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse/40 to-transparent" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 flex items-center justify-center border border-aqua-pulse/30">
                <svg
                  className="w-4 h-4 text-aqua-pulse"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">
                  Claim LP Rewards
                </h3>
                <p className="text-[10px] text-aqua-pulse/70 tracking-wide">
                  Available to claim
                </p>
              </div>
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

      {/* Mobile Market Resolved - Refined */}
      {market.is_resolved && allOptionsResolved && id && !hasLpShares && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-ink-black via-ink-black/95 to-transparent z-40">
          <div className="relative bg-neon-iris/5 border border-neon-iris/20 p-4">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/40 to-transparent" />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 flex items-center justify-center border border-neon-iris/30">
                <svg
                  className="w-4 h-4 text-neon-iris flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">
                  Market Resolved
                </h3>
                <p className="text-[10px] text-neon-iris/60 tracking-wide uppercase">
                  Final outcome
                </p>
              </div>
            </div>
            {hasResolvedOption ? (
              <div>
                {isMultipleChoice ? (
                  <div className="text-sm font-light text-neon-iris break-words line-clamp-2">
                    {winningOptions[0] ? winningOptions[0].option_label : "N/A"}
                  </div>
                ) : (
                  <div
                    className={`text-xl font-light ${
                      primaryOption?.winning_side === 1
                        ? "text-muted-green"
                        : "text-rose-400"
                    }`}
                  >
                    {primaryOption?.winning_side === 1 ? "YES" : "NO"}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-neon-iris/70 font-light">
                All options have been resolved.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Sticky Trade Panel - Refined styling */}
      {!market.is_resolved && (
        <div
          className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 transition-all duration-500 ${
            isScrolled
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="relative bg-graphite-deep/95 backdrop-blur-xl border-t border-white/[0.06]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-4">
                {/* Market Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] tracking-wide uppercase text-moon-grey/50 truncate mb-1">
                    {isMultipleChoice && selectedOptionData
                      ? selectedOptionData.option_label
                      : "Trade"}
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className={`text-lg font-light tabular-nums ${
                        primaryYesPrice >= 0.5
                          ? "text-neon-iris"
                          : "text-moon-grey"
                      }`}
                    >
                      {(primaryYesPrice * 100).toFixed(1)}%
                    </div>
                    <div className="w-px h-4 bg-white/10" />
                    <div
                      className={`text-lg font-light tabular-nums ${
                        primaryYesPrice < 0.5
                          ? "text-rose-400"
                          : "text-moon-grey"
                      }`}
                    >
                      {((1 - primaryYesPrice) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Quick Trade Buttons - Refined */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setSelectedSide("yes");
                      setShowMobileTradePanel(true);
                    }}
                    className={`px-4 py-2.5 text-xs tracking-wide uppercase font-medium transition-all ${
                      selectedSide === "yes"
                        ? "bg-muted-green text-white"
                        : "bg-muted-green/10 text-muted-green border border-muted-green/30"
                    }`}
                  >
                    YES {(primaryYesPrice * 100).toFixed(0)}¢
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSide("no");
                      setShowMobileTradePanel(true);
                    }}
                    className={`px-4 py-2.5 text-xs tracking-wide uppercase font-medium transition-all ${
                      selectedSide === "no"
                        ? "bg-rose-500 text-white"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    NO {((1 - primaryYesPrice) * 100).toFixed(0)}¢
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Trade Panel - Full screen refined */}
      {showMobileTradePanel && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <motion.div
            className="absolute inset-0 bg-ink-black overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            {/* Atmospheric background */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(124,77,255,0.08),transparent_50%)]" />
            </div>

            {/* Header */}
            <div className="sticky top-0 bg-graphite-deep/95 backdrop-blur-xl pt-5 pb-4 px-5 border-b border-white/[0.04] z-10 relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-light text-white tracking-tight">
                    Trade
                  </h2>
                  {selectedOptionData && isMultipleChoice && (
                    <p className="text-xs text-moon-grey/60 mt-1 font-light">
                      {selectedOptionData.option_label}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowMobileTradePanel(false)}
                  className="w-10 h-10 flex items-center justify-center text-moon-grey/60 hover:text-white transition-colors"
                  aria-label="Close trade panel"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Side Selection - Refined */}
            <div className="p-5 border-b border-white/[0.04] relative">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedSide("yes")}
                  className={`py-4 text-sm tracking-wide uppercase font-medium transition-all ${
                    selectedSide === "yes"
                      ? "bg-muted-green text-white"
                      : "bg-muted-green/10 text-muted-green border border-muted-green/30"
                  }`}
                >
                  YES {(primaryYesPrice * 100).toFixed(1)}¢
                </button>
                <button
                  onClick={() => setSelectedSide("no")}
                  className={`py-4 text-sm tracking-wide uppercase font-medium transition-all ${
                    selectedSide === "no"
                      ? "bg-rose-500 text-white"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  NO {((1 - primaryYesPrice) * 100).toFixed(1)}¢
                </button>
              </div>
            </div>

            {/* Trade Form */}
            <div className="px-5 pt-5 pb-10 relative">
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
          </motion.div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        marketUrl={marketUrl}
        marketTitle={marketTitle}
        marketDescription={marketDescription}
      />
    </div>
  );
};
