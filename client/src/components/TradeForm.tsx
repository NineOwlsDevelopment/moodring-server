import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Market, MarketOption } from "@/types/market";
import { useUserStore } from "@/stores/userStore";
import {
  formatCurrency,
  formatUSDC,
  calculateYesPrice,
  calculateLmsrSellPayout,
  calculateSharesForAmount,
} from "@/utils/format";
import { buyShares, sellShares, fetchPositions, Position } from "@/api/api";
import { Tooltip } from "./Tooltip";

// Fee configuration (matching backend: 2% total)
const TOTAL_FEE_BPS = 200;

function calculateFees(amount: number): {
  totalFee: number;
  feePercent: number;
} {
  const totalFee = (amount * TOTAL_FEE_BPS) / 10000;
  return { totalFee, feePercent: TOTAL_FEE_BPS / 100 };
}

interface TradePreviewProps {
  action: "buy" | "sell";
  side: "yes" | "no";
  amount: number;
  shares: number;
  price: number;
  lmsrPayout?: number;
}

const TradePreview = ({
  action,
  side,
  amount,
  shares,
  price,
  lmsrPayout,
}: TradePreviewProps) => {
  const displayShares = shares / 1_000_000;

  if (action === "buy") {
    const rawCost = amount;
    const { totalFee, feePercent } = calculateFees(rawCost);
    const totalCost = rawCost + totalFee;
    let avgPrice = displayShares > 0 ? rawCost / displayShares : price;
    const isCapped = avgPrice >= 1.0;
    if (avgPrice > 0.999) {
      avgPrice = 0.999;
    }

    return (
      <div className="mb-5 p-4 bg-white/[0.02] border border-white/[0.04]">
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-moon-grey/60 text-xs tracking-wide">Est. shares</span>
            <span className="text-white font-light tabular-nums">
              {displayShares.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-moon-grey/60 text-xs tracking-wide">Avg. price</span>
            <span className="text-white font-light tabular-nums">
              {isCapped ? "≈" : ""}
              {(avgPrice * 100).toFixed(1)}¢
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-moon-grey/60 text-xs tracking-wide">Subtotal</span>
            <span className="text-white font-light tabular-nums">
              ${rawCost.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-moon-grey/60 text-xs tracking-wide">Fee ({feePercent}%)</span>
            <span className="text-amber-400/80 font-light tabular-nums">
              ≈${totalFee.toFixed(2)}
            </span>
          </div>
          <div className="pt-3 mt-3 border-t border-white/[0.06] flex justify-between items-center">
            <span className="text-moon-grey text-xs tracking-wide font-medium">Total</span>
            <span className="text-white font-medium tabular-nums">
              {totalCost < 100
                ? `$${totalCost.toFixed(2)}`
                : formatCurrency(totalCost)}
            </span>
          </div>
          <div className="pt-3 border-t border-white/[0.06] flex justify-between items-center">
            <span className="text-moon-grey/60 text-xs tracking-wide">
              If {side.toUpperCase()} wins
            </span>
            <span className="text-neon-iris font-medium tabular-nums">
              ${displayShares.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  } else {
    const rawPayout = lmsrPayout ?? amount * price;
    const { totalFee, feePercent } = calculateFees(rawPayout);
    const netPayout = rawPayout - totalFee;
    const avgPrice = amount > 0 ? rawPayout / amount : price;

    return (
      <div className="mb-5 p-4 bg-white/[0.02] border border-white/[0.04]">
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-moon-grey/60 text-xs tracking-wide">Shares to sell</span>
            <span className="text-white font-light tabular-nums">
              {amount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-moon-grey/60 text-xs tracking-wide">Avg. price</span>
            <span className="text-white font-light tabular-nums">
              {(avgPrice * 100).toFixed(1)}¢
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-moon-grey/60 text-xs tracking-wide">Gross payout</span>
            <span className="text-white font-light tabular-nums">
              ${rawPayout.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-moon-grey/60 text-xs tracking-wide">Fee ({feePercent}%)</span>
            <span className="text-amber-400/80 font-light tabular-nums">
              ≈${totalFee.toFixed(2)}
            </span>
          </div>
          <div className="pt-3 mt-3 border-t border-white/[0.06] flex justify-between items-center">
            <span className="text-moon-grey text-xs tracking-wide font-medium">Net payout</span>
            <span className="text-neon-iris font-medium tabular-nums">
              ≈
              {netPayout < 100
                ? `$${netPayout.toFixed(2)}`
                : formatCurrency(netPayout)}
            </span>
          </div>
        </div>
      </div>
    );
  }
};

interface TradeFormProps {
  market: Market;
  selectedOption?: MarketOption | null;
  preSelectedSide?: "yes" | "no";
  onTradeComplete?: () => void;
}

const SLIPPAGE_OPTIONS = [50, 100, 200, 500];
const DEFAULT_SLIPPAGE_BPS = 100;

export const TradeForm = ({
  market,
  selectedOption,
  preSelectedSide,
  onTradeComplete,
}: TradeFormProps) => {
  const { user } = useUserStore();
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [side, setSide] = useState<"yes" | "no">(preSelectedSide || "yes");
  const [amount, setAmount] = useState("1");
  const [shares, setShares] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [userPosition, setUserPosition] = useState<Position | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [customSlippage, setCustomSlippage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preSelectedSide) setSide(preSelectedSide);
  }, [preSelectedSide]);

  const option = selectedOption || market.options?.[0];
  const optionIsResolved = option?.is_resolved ?? false;
  const winningSide = option?.winning_side ?? null;

  const yesPrice = optionIsResolved
    ? calculateYesPrice(
        option?.yes_quantity || 0,
        option?.no_quantity || 0,
        market.liquidity_parameter,
        { is_resolved: optionIsResolved, winning_side: winningSide }
      )
    : (option as any)?.yes_price ??
      calculateYesPrice(
        option?.yes_quantity || 0,
        option?.no_quantity || 0,
        market.liquidity_parameter,
        { is_resolved: optionIsResolved, winning_side: winningSide }
      );
  const noPrice = 1 - yesPrice;
  const price = side === "yes" ? yesPrice : noPrice;

  const MIN_TRADE_AMOUNT = 0.01;
  const MIN_SHARES = 0.01;

  useEffect(() => {
    const loadPosition = async () => {
      if (!user || !option) return;
      setIsLoadingPosition(true);
      try {
        const { positions } = await fetchPositions({ status: "open" });
        const position = positions.find((p: any) => p.option_id === option.id);
        setUserPosition(position || null);
      } catch (error) {
        console.error("Failed to load position:", error);
        setUserPosition(null);
      } finally {
        setIsLoadingPosition(false);
      }
    };
    if (action === "sell") loadPosition();
  }, [user, option?.id, action]);

  const currentYes = Number(option?.yes_quantity) || 0;
  const currentNo = Number(option?.no_quantity) || 0;
  const liquidityParam = Number(market.liquidity_parameter) || 0;

  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    if (numAmount > 0) {
      if (action === "buy") {
        const microAmount = numAmount * 1_000_000;
        const microShares = calculateSharesForAmount(
          currentYes,
          currentNo,
          microAmount,
          side === "yes",
          liquidityParam
        );
        setShares(microShares);
      } else {
        setShares(numAmount * 1_000_000);
      }
    } else {
      setShares(0);
    }
  }, [amount, action, side, currentYes, currentNo, liquidityParam]);

  const handleTrade = async () => {
    setError(null);

    if (!user) {
      setError("Please log in to trade");
      toast.error("Please log in to trade");
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Please enter a valid amount");
      toast.error("Please enter a valid amount");
      return;
    }

    if (!option) {
      setError("Please select an option to trade");
      toast.error("Please select an option to trade");
      return;
    }

    if (action === "buy") {
      if (numAmount < MIN_TRADE_AMOUNT) {
        setError(`Minimum trade amount is $${MIN_TRADE_AMOUNT.toFixed(2)}`);
        toast.error(`Minimum trade amount is $${MIN_TRADE_AMOUNT.toFixed(2)}`);
        return;
      }
      const estimatedShares = shares / 1_000_000;
      if (estimatedShares < MIN_SHARES) {
        setError(
          `Trade amount too small - would receive less than ${MIN_SHARES} shares`
        );
        toast.error(
          `Trade amount too small - would receive less than ${MIN_SHARES} shares`
        );
        return;
      }
      if (numAmount > (user.wallet?.balance_usdc || 0) / 1_000_000) {
        setError("Insufficient balance");
        toast.error("Insufficient balance");
        return;
      }
    } else {
      if (numAmount < MIN_SHARES) {
        setError(`Minimum sell amount is ${MIN_SHARES} shares`);
        toast.error(`Minimum sell amount is ${MIN_SHARES} shares`);
        return;
      }
      if (!userPosition || numAmount > availableShares) {
        setError("Insufficient shares to sell");
        toast.error("Insufficient shares to sell");
        return;
      }
    }

    setIsLoading(true);
    try {
      if (action === "buy") {
        const microSharesToBuy = shares;
        const displayShares = microSharesToBuy / 1_000_000;

        await buyShares({
          market: market.id,
          option: option.id,
          buyYes: side === "yes" ? microSharesToBuy : 0,
          buyNo: side === "no" ? microSharesToBuy : 0,
          slippageBps: slippageBps,
        });

        toast.success(
          `Bought ${displayShares.toFixed(
            2
          )} ${side.toUpperCase()} shares for ${formatCurrency(numAmount)}`
        );
        setAmount("1");
        setShares(0);
        setError(null);
      } else {
        const microSharesToSell = shares;
        const displayShares = numAmount;

        await sellShares({
          market: market.id,
          option: option.id,
          sellYes: side === "yes" ? microSharesToSell : 0,
          sellNo: side === "no" ? microSharesToSell : 0,
          slippageBps: slippageBps,
        });

        toast.success(`Sold ${displayShares} ${side.toUpperCase()} shares`);
        setAmount("1");
        setShares(0);
        setError(null);
      }
      onTradeComplete?.();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || "Trade failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const availableSharesMicro =
    side === "yes"
      ? (userPosition as any)?.yes_shares || 0
      : (userPosition as any)?.no_shares || 0;
  const availableShares = availableSharesMicro / 1_000_000;

  return (
    <div className="relative bg-graphite-deep/60 border border-white/[0.06] overflow-hidden">
      {/* Gradient Accent Lines - Premium styling */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/40 to-transparent z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse/20 to-transparent z-10" />
      <div className="absolute top-0 left-0 w-px h-16 bg-gradient-to-b from-neon-iris/30 to-transparent z-10" />
      <div className="absolute top-0 right-0 w-px h-16 bg-gradient-to-b from-neon-iris/30 to-transparent z-10" />

      <div className="relative z-10 p-5 sm:p-6">
        {/* Selected Option Display */}
        {selectedOption && (
          <div className="mb-5 p-3.5 bg-neon-iris/5 border border-neon-iris/20">
            <div className="text-[10px] text-neon-iris/70 font-medium uppercase tracking-[0.15em] mb-1">
              Trading
            </div>
            <div className="font-light text-white text-sm truncate">
              {selectedOption.option_label}
            </div>
          </div>
        )}

        {/* Buy/Sell Toggle - Premium styling */}
        <div className="flex gap-px p-1 bg-white/[0.02] border border-white/[0.04] mb-5">
          <button
            onClick={() => {
              setAction("buy");
              setError(null);
            }}
            className={`flex-1 py-2.5 font-medium text-sm transition-all duration-300 ${
              action === "buy"
                ? "bg-muted-green text-white"
                : "text-moon-grey/60 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => {
              setAction("sell");
              setError(null);
            }}
            className={`flex-1 py-2.5 font-medium text-sm transition-all duration-300 ${
              action === "sell"
                ? "bg-rose-500 text-white"
                : "text-moon-grey/60 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            Sell
          </button>
        </div>

        {/* Outcome Selection - Refined */}
        <div className="mb-5">
          <label className="block text-[10px] font-medium text-moon-grey/50 uppercase tracking-[0.15em] mb-3">
            Outcome
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => !optionIsResolved && setSide("yes")}
              disabled={optionIsResolved}
              className={`relative p-4 text-center transition-all duration-300 border ${
                optionIsResolved
                  ? winningSide === 1
                    ? "border-muted-green/40 bg-muted-green/10"
                    : "bg-white/[0.01] border-white/[0.04] text-moon-grey/40 cursor-not-allowed"
                  : side === "yes"
                  ? "border-muted-green/40 bg-muted-green/10"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-muted-green/5 hover:border-muted-green/20"
              }`}
            >
              <div className="text-muted-green text-[10px] tracking-[0.15em] uppercase font-medium mb-1.5">
                Yes {optionIsResolved && winningSide === 1 && "✓"}
              </div>
              <div className={`text-2xl font-light tabular-nums ${
                optionIsResolved && winningSide !== 1 
                  ? "text-moon-grey/40" 
                  : "text-muted-green"
              }`}>
                {optionIsResolved
                  ? winningSide === 1
                    ? "$1.00"
                    : "$0.00"
                  : `${(yesPrice * 100).toFixed(1)}¢`}
              </div>
            </button>
            <button
              onClick={() => !optionIsResolved && setSide("no")}
              disabled={optionIsResolved}
              className={`relative p-4 text-center transition-all duration-300 border ${
                optionIsResolved
                  ? winningSide === 2
                    ? "border-rose-500/40 bg-rose-500/10"
                    : "bg-white/[0.01] border-white/[0.04] text-moon-grey/40 cursor-not-allowed"
                  : side === "no"
                  ? "border-rose-500/40 bg-rose-500/10"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-rose-500/5 hover:border-rose-500/20"
              }`}
            >
              <div className="text-rose-400 text-[10px] tracking-[0.15em] uppercase font-medium mb-1.5">
                No {optionIsResolved && winningSide === 2 && "✓"}
              </div>
              <div className={`text-2xl font-light tabular-nums ${
                optionIsResolved && winningSide !== 2 
                  ? "text-moon-grey/40" 
                  : "text-rose-400"
              }`}>
                {optionIsResolved
                  ? winningSide === 2
                    ? "$1.00"
                    : "$0.00"
                  : `${(noPrice * 100).toFixed(1)}¢`}
              </div>
            </button>
          </div>
        </div>

        {/* Amount Input - Refined */}
        <div className="mb-5">
          <label className="block text-[10px] font-medium text-moon-grey/50 uppercase tracking-[0.15em] mb-3">
            {action === "buy" ? "Amount" : "Shares to Sell"}
            <span className="ml-2 text-[9px] normal-case font-normal text-moon-grey/40 tracking-normal">
              min: {action === "buy" ? `$${MIN_TRADE_AMOUNT.toFixed(2)}` : `${MIN_SHARES}`}
            </span>
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              placeholder={action === "buy" ? "1.00" : "1.00"}
              className={`w-full px-4 py-3.5 ${
                action === "sell" && availableShares > 0 ? "pr-28" : "pr-20"
              } bg-white/[0.02] border text-white placeholder-moon-grey/40 focus:border-neon-iris/40 focus:ring-0 focus:outline-none transition-all text-lg font-light tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                error ? "border-rose-500/40" : "border-white/[0.08]"
              }`}
              min="0"
              step="1"
              disabled={isLoading || market.is_resolved || optionIsResolved}
            />
            {/* Increment/Decrement Controls */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col border border-white/[0.08] overflow-hidden bg-white/[0.02]">
              <button
                type="button"
                onClick={() => {
                  const current = parseFloat(amount) || 0;
                  const newValue = Math.max(0, current + 1.0);
                  setAmount(String(newValue.toFixed(2)));
                  setError(null);
                }}
                disabled={isLoading || market.is_resolved || optionIsResolved}
                className="w-7 h-6 flex items-center justify-center bg-white/[0.03] hover:bg-neon-iris/10 text-moon-grey/50 hover:text-neon-iris transition-all duration-200 border-b border-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-moon-grey/50"
                aria-label="Increment"
              >
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
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  const current = parseFloat(amount) || 0;
                  const newValue = Math.max(0, current - 1.0);
                  setAmount(String(newValue.toFixed(2)));
                  setError(null);
                }}
                disabled={isLoading || market.is_resolved || optionIsResolved}
                className="w-7 h-6 flex items-center justify-center bg-white/[0.03] hover:bg-neon-iris/10 text-moon-grey/50 hover:text-neon-iris transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-moon-grey/50"
                aria-label="Decrement"
              >
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
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
            {action === "sell" && availableShares > 0 && (
              <button
                onClick={() => setAmount(String(availableShares))}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] font-medium text-neon-iris/80 hover:text-neon-iris px-2 py-1 bg-neon-iris/10 hover:bg-neon-iris/15 border border-neon-iris/20 transition-all"
              >
                MAX
              </button>
            )}
          </div>
          {error && <p className="mt-2.5 text-xs text-rose-400/90">{error}</p>}
          {user && (
            <div className="mt-2.5 text-xs text-moon-grey/50">
              {action === "buy" ? (
                <span>
                  Balance:{" "}
                  <span className="text-moon-grey/80 font-light">
                    {formatUSDC(user.wallet.balance_usdc)}
                  </span>
                </span>
              ) : (
                <span>
                  Available:{" "}
                  <span className="text-moon-grey/80 font-light">
                    {isLoadingPosition
                      ? "..."
                      : `${availableShares.toFixed(2)} shares`}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Trade Preview */}
        {amount && parseFloat(amount) > 0 && (
          <>
            <TradePreview
              action={action}
              side={side}
              amount={parseFloat(amount)}
              shares={shares}
              price={price}
              lmsrPayout={
                action === "sell" && shares > 0
                  ? calculateLmsrSellPayout(
                      currentYes,
                      currentNo,
                      side === "yes" ? shares : 0,
                      side === "no" ? shares : 0,
                      liquidityParam
                    ) / 1_000_000
                  : undefined
              }
            />

            {/* Slippage Settings - Refined */}
            <div className="mb-5">
              <Tooltip
                content="Slippage is the maximum price difference you're willing to accept between the expected price and the actual execution price."
                position="top"
              >
                <button
                  onClick={() => setShowSlippageSettings(!showSlippageSettings)}
                  className="flex items-center justify-between w-full text-xs text-moon-grey/50 hover:text-moon-grey/80 transition-colors"
                >
                  <span className="flex items-center gap-2">
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
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="tracking-wide">Slippage: {(slippageBps / 100).toFixed(1)}%</span>
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      showSlippageSettings ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </Tooltip>

              {showSlippageSettings && (
                <div className="mt-3 p-3.5 bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex gap-1.5 mb-3">
                    {SLIPPAGE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setSlippageBps(opt);
                          setCustomSlippage("");
                        }}
                        className={`flex-1 py-1.5 text-xs font-medium transition-all ${
                          slippageBps === opt && !customSlippage
                            ? "bg-neon-iris text-white"
                            : "bg-white/[0.03] text-moon-grey/60 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        {(opt / 100).toFixed(1)}%
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-moon-grey/50 tracking-wide">Custom:</span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={customSlippage}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomSlippage(val);
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
                            setSlippageBps(Math.round(parsed * 100));
                          }
                        }}
                        placeholder="0.0"
                        className="w-full bg-white/[0.03] border border-white/[0.08] px-2.5 py-1.5 text-xs text-white placeholder-moon-grey/40 focus:border-neon-iris/40 focus:outline-none"
                        min="0.1"
                        max="50"
                        step="0.1"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-moon-grey/40">
                        %
                      </span>
                    </div>
                  </div>
                  {slippageBps > 500 && (
                    <p className="mt-2.5 text-xs text-amber-400/80 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      High slippage may result in unfavorable trades
                    </p>
                  )}
                  {slippageBps < 50 && (
                    <p className="mt-2.5 text-xs text-amber-400/80 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Low slippage may cause trade to fail
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Trade Button - Premium styling */}
        <button
          onClick={handleTrade}
          disabled={
            !user ||
            isLoading ||
            market.is_resolved ||
            optionIsResolved ||
            (action === "sell" && availableShares <= 0) ||
            (action === "buy" && parseFloat(amount || "0") <= 0) ||
            (action === "buy" &&
              parseFloat(amount || "0") > 0 &&
              shares / 1_000_000 < MIN_SHARES)
          }
          className={`w-full py-3.5 font-medium transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed text-sm tracking-wide ${
            isLoading
              ? "bg-moon-grey/20 text-moon-grey/60"
              : action === "buy"
              ? side === "yes"
                ? "bg-muted-green hover:bg-muted-green/90 text-white"
                : "bg-rose-500 hover:bg-rose-500/90 text-white"
              : "bg-rose-500 hover:bg-rose-500/90 text-white"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : market.is_resolved || optionIsResolved ? (
            optionIsResolved ? (
              `Resolved — ${winningSide === 1 ? "YES" : "NO"} Won`
            ) : (
              "Market Resolved"
            )
          ) : !user ? (
            "Log in to Trade"
          ) : action === "sell" && availableShares <= 0 ? (
            "No Position"
          ) : action === "buy" &&
            parseFloat(amount || "0") > 0 &&
            shares / 1_000_000 < MIN_SHARES ? (
            "Amount Too Small"
          ) : (
            `${action === "buy" ? "Buy" : "Sell"} ${side.toUpperCase()}`
          )}
        </button>

        {/* Footer Info */}
        <p className="mt-4 text-[11px] text-moon-grey/40 text-center tracking-wide">
          {action === "buy"
            ? "Win $1 per share if correct"
            : "Sell at current market price"}{" "}
          · {TOTAL_FEE_BPS / 100}% fee
        </p>
      </div>
    </div>
  );
};
