import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Key, TrendingUp, TrendingDown } from "lucide-react";
import { getBuyCost, getSellPayout, getKeyPrice } from "@/utils/bondingCurve";

interface KeyPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  traderName?: string;
  currentSupply: number;
  currentPrice: number;
  keyOwnership: number;
  isTrader?: boolean; // Whether the current user is the trader themselves
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
  onBuy,
  onSell,
}: KeyPurchaseModalProps) => {
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState<number>(0.000001);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset quantity when mode changes
  useEffect(() => {
    if (mode === "sell") {
      // If trader, they can only sell up to (supply - 1) to keep the founder key
      const maxSellable = isTrader
        ? Math.max(0, currentSupply - 1)
        : keyOwnership;
      setQuantity(Math.min(0.000001, maxSellable));
    } else {
      setQuantity(0.000001);
    }
  }, [mode, keyOwnership, isTrader, currentSupply]);

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

  // Calculate costs/payouts
  const totalCost = mode === "buy" ? getBuyCost(effectiveSupply, quantity) : 0;
  const totalPayout =
    mode === "sell" ? getSellPayout(effectiveSupply, quantity) : 0;
  const averagePrice =
    mode === "buy"
      ? quantity > 0
        ? totalCost / quantity
        : 0
      : quantity > 0
      ? totalPayout / quantity
      : 0;

  // Calculate price after transaction
  const newSupply =
    mode === "buy" ? effectiveSupply + quantity : effectiveSupply - quantity;
  const priceAfter = getKeyPrice(newSupply);
  const priceChange =
    priceAfter - (currentPrice || getKeyPrice(effectiveSupply));
  const priceChangePercent =
    (currentPrice || getKeyPrice(effectiveSupply)) > 0
      ? (priceChange / (currentPrice || getKeyPrice(effectiveSupply))) * 100
      : 0;

  const handleSubmit = async () => {
    if (isProcessing) return;

    if (mode === "buy" && quantity <= 0.000001) return;

    if (mode === "sell") {
      if (quantity <= 0.000001) return;
      // If trader, check they're not selling below 1 key
      if (isTrader) {
        const maxSellable = Math.max(0, effectiveSupply - 1);
        if (quantity > maxSellable + 0.000001) {
          // Small epsilon for decimal comparison
          return;
        }
      } else {
        if (quantity > keyOwnership + 0.000001) return; // Small epsilon for decimal comparison
      }
    }

    setIsProcessing(true);
    try {
      if (mode === "buy") {
        await onBuy(quantity);
      } else {
        await onSell(quantity);
      }
      onClose();
      setQuantity(0.000001);
    } catch (error) {
      console.error("Transaction failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getModalRoot = () => {
    return document.getElementById("root") || document.body;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative bg-graphite-deep rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl animate-scale-in"
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
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-neon-iris" />
            <h2 className="text-xl font-bold text-white">
              {traderName || "Trader"} Keys
            </h2>
          </div>
          <p className="text-sm text-gray-400">
            Current Supply: {effectiveSupply.toFixed(6)}{" "}
            {isTrader && "(1 unsellable founder key)"}
          </p>
        </div>

        {/* Buy/Sell Tabs */}
        <div className="flex gap-2 mb-6 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setMode("buy")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === "buy"
                ? "bg-neon-iris text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setMode("sell")}
            disabled={!isTrader && keyOwnership === 0}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === "sell"
                ? "bg-aqua-pulse text-white"
                : "text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          >
            Sell{" "}
            {isTrader
              ? `(${Math.max(0, effectiveSupply - 1)} sellable)`
              : keyOwnership > 0 && `(${keyOwnership})`}
          </button>
        </div>

        {/* Current Price */}
        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Current Price</span>
            <span className="text-lg font-bold text-white">
              ${(currentPrice || getKeyPrice(effectiveSupply)).toFixed(4)}
            </span>
          </div>
          {mode === "buy" && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Price After</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  ${priceAfter.toFixed(4)}
                </span>
                {priceChange !== 0 && (
                  <span
                    className={`text-xs flex items-center gap-1 ${
                      priceChange > 0 ? "text-aqua-pulse" : "text-brand-danger"
                    }`}
                  >
                    {priceChange > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {priceChangePercent > 0 ? "+" : ""}
                    {priceChangePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quantity Input */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
            {mode === "buy" ? "Quantity to Buy" : "Quantity to Sell"}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const newQuantity = Math.max(0.000001, quantity - 0.000001);
                setQuantity(parseFloat(newQuantity.toFixed(6)));
              }}
              disabled={quantity <= 0.000001 || isProcessing}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              -
            </button>
            <input
              type="number"
              min={0.000001}
              step={0.000001}
              max={
                mode === "sell"
                  ? isTrader
                    ? Math.max(0, effectiveSupply - 1)
                    : keyOwnership
                  : undefined
              }
              value={quantity}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0.000001;
                if (isNaN(val) || val < 0.000001) {
                  setQuantity(0.000001);
                  return;
                }
                // Round to 6 decimals
                const rounded = parseFloat(val.toFixed(6));
                if (mode === "sell") {
                  if (isTrader) {
                    const maxSellable = Math.max(0, effectiveSupply - 1);
                    setQuantity(Math.min(rounded, maxSellable));
                  } else {
                    setQuantity(Math.min(rounded, keyOwnership));
                  }
                } else {
                  setQuantity(rounded);
                }
              }}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-neon-iris"
              disabled={isProcessing}
            />
            <button
              onClick={() => {
                const newQuantity = quantity + 0.000001;
                const rounded = parseFloat(newQuantity.toFixed(6));
                if (mode === "sell") {
                  if (isTrader) {
                    const maxSellable = Math.max(0, effectiveSupply - 1);
                    setQuantity(Math.min(rounded, maxSellable));
                  } else {
                    setQuantity(Math.min(rounded, keyOwnership));
                  }
                } else {
                  setQuantity(rounded);
                }
              }}
              disabled={
                isProcessing ||
                (mode === "sell" &&
                  (isTrader
                    ? quantity >= Math.max(0, effectiveSupply - 1)
                    : quantity >= keyOwnership))
              }
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          {mode === "sell" && (
            <p className="text-xs text-gray-500 mt-1 text-center">
              {isTrader
                ? `You can sell up to ${Math.max(
                    0,
                    effectiveSupply - 1
                  ).toFixed(6)} key(s) (must keep 1 founder key)`
                : keyOwnership > 0 &&
                  `You own ${keyOwnership.toFixed(6)} key${
                    keyOwnership !== 1 ? "s" : ""
                  }`}
            </p>
          )}
        </div>

        {/* Cost/Payout Summary */}
        <div className="bg-white/5 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Average Price</span>
            <span className="text-sm font-semibold text-white">
              ${averagePrice.toFixed(4)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-base font-semibold text-white">
              {mode === "buy" ? "Total Cost" : "Total Payout"}
            </span>
            <span
              className={`text-lg font-bold ${
                mode === "buy" ? "text-aqua-pulse" : "text-brand-danger"
              }`}
            >
              {mode === "buy" ? "-" : "+"}$
              {(mode === "buy" ? totalCost : totalPayout).toFixed(4)}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSubmit}
          disabled={
            isProcessing ||
            quantity <= 0.000001 ||
            (mode === "sell" &&
              (isTrader
                ? quantity > Math.max(0, effectiveSupply - 1) + 0.000001
                : quantity > keyOwnership + 0.000001))
          }
          className={`w-full py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            mode === "buy"
              ? "bg-neon-iris hover:bg-neon-iris/90"
              : "bg-aqua-pulse hover:bg-aqua-pulse/90"
          }`}
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Key className="w-4 h-4" />
              {mode === "buy"
                ? `Buy ${quantity.toFixed(6)} Key${quantity !== 1 ? "s" : ""}`
                : `Sell ${quantity.toFixed(6)} Key${quantity !== 1 ? "s" : ""}`}
            </>
          )}
        </button>
      </div>
    </div>,
    getModalRoot()
  );
};
