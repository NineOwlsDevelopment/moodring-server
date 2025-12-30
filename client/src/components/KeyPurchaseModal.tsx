import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Key } from "lucide-react";
import { getBuyCost, getSellPayout, getKeyPrice } from "@/utils/bondingCurve";
import { useUserStore } from "@/stores/userStore";
import { formatUSDC } from "@/utils/format";

interface KeyPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  traderName?: string;
  currentSupply: number;
  currentPrice: number;
  keyOwnership: number;
  isTrader?: boolean; // Whether the current user is the trader themselves
  requiredKeysToFollow?: number; // Minimum keys needed to follow
  onBuy: (quantity: number) => Promise<void>;
  onSell: (quantity: number) => Promise<void>;
}

export const KeyPurchaseModal = ({
  isOpen,
  onClose,
  traderName,
  currentSupply,
  currentPrice,
  keyOwnership,
  isTrader = false,
  requiredKeysToFollow = 1,
  onBuy,
  onSell,
}: KeyPurchaseModalProps) => {
  const { user } = useUserStore();
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Ensure supply is at least 1 (founder key)
  const effectiveSupply = Math.max(1, currentSupply);

  // Ensure keyOwnership is a number
  const numericKeyOwnership =
    typeof keyOwnership === "number"
      ? keyOwnership
      : parseFloat(String(keyOwnership)) || 0;

  // Parse quantity to number for calculations
  const quantityNum = parseFloat(quantity) || 0;

  // Calculate costs/payouts
  const totalCost =
    mode === "buy" && quantityNum > 0
      ? getBuyCost(effectiveSupply, quantityNum)
      : 0;
  const totalPayout =
    mode === "sell" && quantityNum > 0
      ? getSellPayout(effectiveSupply, quantityNum)
      : 0;

  const handleSubmit = async () => {
    if (isProcessing) return;

    setError(null);

    // Validate input
    if (!quantity || quantity.trim() === "") {
      setError("Please enter an amount");
      return;
    }

    const quantityNum = parseFloat(quantity);

    if (isNaN(quantityNum) || quantityNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (mode === "sell") {
      // If trader, check they're not selling below 1 key
      if (isTrader) {
        const maxSellable = Math.max(0, effectiveSupply - 1);
        if (quantityNum > maxSellable + 0.000001) {
          setError(`You can only sell up to ${maxSellable.toFixed(2)} keys`);
          return;
        }
      } else {
        if (quantityNum > numericKeyOwnership + 0.000001) {
          setError(`You only own ${numericKeyOwnership.toFixed(2)} keys`);
          return;
        }
      }
    }

    if (mode === "buy" && user) {
      const balance = (user.wallet?.balance_usdc || 0) / 1_000_000;
      if (totalCost > balance) {
        setError("Insufficient balance");
        return;
      }
    }

    setIsProcessing(true);
    try {
      if (mode === "buy") {
        await onBuy(quantityNum);
      } else {
        await onSell(quantityNum);
      }
      onClose();
      setQuantity("");
      setError(null);
    } catch (error: any) {
      console.error("Transaction failed:", error);
      setError(
        error?.response?.data?.error || error?.message || "Transaction failed"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getModalRoot = () => {
    return document.getElementById("root") || document.body;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative bg-graphite-deep rounded-2xl border border-white/10 p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-moon-grey hover:text-white transition-colors rounded-lg hover:bg-white/5"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6 pr-8">
          <div className="flex items-center gap-2 mb-1 min-w-0">
            <Key className="w-5 h-5 text-neon-iris flex-shrink-0" />
            <h2 className="text-xl font-bold text-white truncate">
              {mode === "buy" ? "Buy Keys" : "Sell Keys"}
            </h2>
          </div>
          <p className="text-sm text-gray-400 truncate">
            {traderName || "Trader"}
          </p>
        </div>

        {/* Buy/Sell Tabs */}
        <div className="flex gap-2 mb-6 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => {
              setMode("buy");
              setQuantity("");
              setError(null);
            }}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all ${
              mode === "buy"
                ? "bg-muted-green text-white shadow-lg shadow-muted-green/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => {
              setMode("sell");
              setQuantity("");
              setError(null);
            }}
            disabled={!isTrader && numericKeyOwnership === 0}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all ${
              mode === "sell"
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                : "text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          >
            Sell
          </button>
        </div>

        {/* Key Info Card */}
        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl p-4 sm:p-5 mb-5 border border-white/10">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-sm text-gray-400 flex-shrink-0">
                Price per Key
              </span>
              <span className="text-xl font-bold text-white tabular-nums truncate text-right">
                ${(currentPrice || getKeyPrice(effectiveSupply)).toFixed(4)}
              </span>
            </div>
            {user && (
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10 min-w-0">
                <span className="text-sm text-gray-400 flex-shrink-0">
                  Your Balance
                </span>
                <span className="text-base font-semibold text-white tabular-nums truncate text-right">
                  {formatUSDC(user.wallet?.balance_usdc || 0)} USDC
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10 min-w-0">
              <span className="text-sm text-gray-400 flex-shrink-0">
                {isTrader
                  ? mode === "sell"
                    ? "Keys You Can Sell"
                    : "Your Keys"
                  : "Keys You Own"}
              </span>
              <span className="text-base font-semibold text-white tabular-nums truncate text-right">
                {isTrader
                  ? mode === "sell"
                    ? Math.max(0, effectiveSupply - 1).toFixed(2)
                    : effectiveSupply.toFixed(2)
                  : numericKeyOwnership.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Quantity Input */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            How many keys?
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setError(null);
              }}
              placeholder="Enter amount"
              className="w-full px-4 py-3 pr-16 bg-white/5 border border-white/10 rounded-lg text-white text-center placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-iris/50 focus:border-neon-iris text-base sm:text-lg font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={isProcessing}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col border border-white/[0.08] rounded-md overflow-hidden bg-white/[0.03] backdrop-blur-sm">
              <button
                type="button"
                onClick={() => {
                  const current = parseFloat(quantity) || 0;
                  const newQuantity = current + 1;
                  setQuantity(String(newQuantity));
                  setError(null);
                }}
                disabled={isProcessing}
                className="w-7 h-6 flex items-center justify-center bg-white/[0.05] hover:bg-neon-iris/20 hover:border-neon-iris/50 text-moon-grey-dark hover:text-neon-iris-light active:bg-neon-iris/30 transition-all duration-200 border-b border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.05] disabled:hover:text-moon-grey-dark group"
                aria-label="Increment"
              >
                <svg
                  className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  const current = parseFloat(quantity) || 0;
                  const newQuantity = Math.max(0, current - 1);
                  setQuantity(newQuantity > 0 ? String(newQuantity) : "");
                  setError(null);
                }}
                disabled={isProcessing}
                className="w-7 h-6 flex items-center justify-center bg-white/[0.05] hover:bg-neon-iris/20 hover:border-neon-iris/50 text-moon-grey-dark hover:text-neon-iris-light active:bg-neon-iris/30 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.05] disabled:hover:text-moon-grey-dark group"
                aria-label="Decrement"
              >
                <svg
                  className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </div>
          {error && (
            <p className="text-sm text-rose-400 mt-2 text-center font-medium break-words">
              {error}
            </p>
          )}
          {!error && mode === "buy" && requiredKeysToFollow > 1 && (
            <p className="text-xs text-gray-500 mt-2 text-center break-words">
              Minimum {requiredKeysToFollow} keys needed to follow
            </p>
          )}
        </div>

        {/* Total Summary */}
        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl p-4 sm:p-5 mb-5 border border-white/10">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-base font-semibold text-white flex-shrink-0">
              {mode === "buy" ? "You'll Pay" : "You'll Receive"}
            </span>
            <span
              className={`text-xl sm:text-2xl font-bold tabular-nums truncate text-right ${
                quantityNum > 0
                  ? mode === "buy"
                    ? "text-aqua-pulse"
                    : "text-white"
                  : "text-gray-500"
              }`}
            >
              {quantityNum > 0 && mode === "sell" ? "+" : ""}$
              {quantityNum > 0
                ? (mode === "buy" ? totalCost : totalPayout).toFixed(2)
                : "0.00"}
            </span>
          </div>
          {mode === "buy" &&
            user &&
            quantityNum > 0 &&
            totalCost > (user.wallet?.balance_usdc || 0) / 1_000_000 && (
              <p className="text-xs text-rose-400 mt-2 text-center break-words">
                Insufficient balance
              </p>
            )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleSubmit}
          disabled={isProcessing || !quantityNum || quantityNum <= 0}
          className={`w-full py-3 sm:py-4 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base shadow-lg min-w-0 ${
            mode === "buy"
              ? "bg-muted-green hover:bg-muted-green-light shadow-muted-green/30"
              : "bg-rose-500 hover:bg-rose-400 shadow-rose-500/30"
          }`}
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
              <span className="truncate">Processing...</span>
            </>
          ) : quantityNum > 0 ? (
            <>
              <Key className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">
                {mode === "buy" ? "Buy" : "Sell"} {quantityNum.toFixed(2)} Key
                {quantityNum !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <>
              <Key className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">Enter Amount</span>
            </>
          )}
        </button>
      </div>
    </div>,
    getModalRoot()
  );
};
