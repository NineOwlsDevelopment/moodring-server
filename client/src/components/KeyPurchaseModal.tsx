import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden"
          onClick={onClose}
        >
          {/* Backdrop with atmospheric gradient */}
          <div className="absolute inset-0 bg-ink-black/90 backdrop-blur-sm" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_30%,rgba(124,77,255,0.08),transparent_70%)]" />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative bg-ink-black border border-white/10 p-5 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto overflow-x-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient line accent at top */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/40 to-transparent" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-moon-grey/60 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border border-neon-iris/20 flex items-center justify-center">
                  <Key className="w-4 h-4 text-neon-iris/80" />
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.2em] uppercase text-neon-iris/80 mb-1">
                    {mode === "buy" ? "Purchase Keys" : "Sell Keys"}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extralight text-white tracking-tight">
                    {traderName || "Trader"}
                  </h2>
                </div>
              </div>
            </div>

            {/* Buy/Sell Tabs - minimal design */}
            <div className="flex mb-8 border-b border-white/5">
              <button
                onClick={() => {
                  setMode("buy");
                  setQuantity("");
                  setError(null);
                }}
                className={`flex-1 py-3 text-sm font-medium tracking-wide uppercase transition-all relative ${
                  mode === "buy"
                    ? "text-white"
                    : "text-moon-grey/50 hover:text-white"
                }`}
              >
                Buy
                {mode === "buy" && (
                  <motion.div
                    layoutId="modeIndicator"
                    className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse to-transparent"
                  />
                )}
              </button>
              <button
                onClick={() => {
                  setMode("sell");
                  setQuantity("");
                  setError(null);
                }}
                disabled={!isTrader && numericKeyOwnership === 0}
                className={`flex-1 py-3 text-sm font-medium tracking-wide uppercase transition-all relative ${
                  mode === "sell"
                    ? "text-white"
                    : "text-moon-grey/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              >
                Sell
                {mode === "sell" && (
                  <motion.div
                    layoutId="modeIndicator"
                    className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-danger to-transparent"
                  />
                )}
              </button>
            </div>

            {/* Key Info Section */}
            <div className="space-y-4 mb-8 pb-8 border-b border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50">
                  Price per Key
                </span>
                <span className="text-2xl sm:text-3xl font-extralight text-white tabular-nums">
                  ${(currentPrice || getKeyPrice(effectiveSupply)).toFixed(4)}
                </span>
              </div>
              {user && (
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50">
                    Your Balance
                  </span>
                  <span className="text-lg font-light text-white tabular-nums">
                    {formatUSDC(user.wallet?.balance_usdc || 0)} USDC
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50">
                  {isTrader
                    ? mode === "sell"
                      ? "Keys Available"
                      : "Your Keys"
                    : "Keys Owned"}
                </span>
                <span className="text-lg font-light text-white tabular-nums">
                  {isTrader
                    ? mode === "sell"
                      ? Math.max(0, effectiveSupply - 1).toFixed(2)
                      : effectiveSupply.toFixed(2)
                    : numericKeyOwnership.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Quantity Input - refined minimal design */}
            <div className="mb-8">
              <label className="block text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 mb-4">
                Quantity
              </label>
              <div className="flex gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseFloat(quantity) || 0;
                    const newQuantity = Math.max(0, current - 1);
                    setQuantity(newQuantity > 0 ? String(newQuantity) : "");
                    setError(null);
                  }}
                  disabled={isProcessing}
                  className="w-11 sm:w-12 flex-shrink-0 py-3 border border-white/10 text-white hover:bg-white/5 transition-colors font-light disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  −
                </button>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setError(null);
                  }}
                  placeholder="0"
                  className="flex-1 min-w-0 px-2 sm:px-4 py-3 bg-transparent border border-white/10 text-white text-center placeholder-moon-grey/30 focus:outline-none focus:border-neon-iris/50 text-xl font-extralight tabular-nums transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = parseFloat(quantity) || 0;
                    const newQuantity = current + 1;
                    setQuantity(String(newQuantity));
                    setError(null);
                  }}
                  disabled={isProcessing}
                  className="w-11 sm:w-12 flex-shrink-0 py-3 border border-white/10 text-white hover:bg-white/5 transition-colors font-light disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  +
                </button>
              </div>
              {error && (
                <p className="text-sm text-brand-danger mt-3 text-center font-light">
                  {error}
                </p>
              )}
              {!error && mode === "buy" && requiredKeysToFollow > 1 && (
                <p className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/40 mt-3 text-center">
                  Minimum {requiredKeysToFollow} keys to follow
                </p>
              )}
            </div>

            {/* Total Summary - refined */}
            <div className="border border-white/5 p-5 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50">
                  {mode === "buy" ? "Total Cost" : "You'll Receive"}
                </span>
                <span
                  className={`text-2xl sm:text-3xl font-extralight tabular-nums ${
                    quantityNum > 0
                      ? mode === "buy"
                        ? "text-white"
                        : "text-aqua-pulse"
                      : "text-moon-grey/30"
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
                  <p className="text-xs text-brand-danger mt-3 text-center font-light">
                    Insufficient balance
                  </p>
                )}
            </div>

            {/* Action Button - refined minimal design */}
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !quantityNum || quantityNum <= 0}
              className={`w-full py-4 font-medium tracking-wide uppercase text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${
                mode === "buy"
                  ? "bg-white text-ink-black hover:bg-moon-grey-light"
                  : "bg-brand-danger text-white hover:bg-brand-danger/90"
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : quantityNum > 0 ? (
                <>
                  <Key className="w-4 h-4" />
                  <span>
                    {mode === "buy" ? "Buy" : "Sell"} {quantityNum.toFixed(2)} Key
                    {quantityNum !== 1 ? "s" : ""}
                  </span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>Enter Amount</span>
                </>
              )}
            </button>

            {/* Bottom info */}
            <div className="mt-6 text-center">
              <p className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/30">
                Bonding curve • Instant settlement
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    getModalRoot()
  );
};
