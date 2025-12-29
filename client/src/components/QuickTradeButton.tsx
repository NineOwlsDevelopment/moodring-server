import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, TrendingUp, TrendingDown } from "lucide-react";
import { celebrateSuccess } from "@/utils/confetti";
import { useUserStore } from "@/stores/userStore";
import { useNavigate } from "react-router-dom";

interface QuickTradeButtonProps {
  marketId: string;
  optionId: string;
  side: "yes" | "no";
  currentPrice: number;
  variant?: "default" | "compact" | "icon";
  onTrade?: () => void;
}

/**
 * One-click quick trade button with instant feedback
 * Creates addictive trading experience
 */
export const QuickTradeButton = ({
  marketId,
  optionId,
  side,
  currentPrice,
  variant = "default",
  onTrade,
}: QuickTradeButtonProps) => {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [isTrading, setIsTrading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleClick = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (isTrading) return;

    setIsTrading(true);
    setShowSuccess(true);

    // Celebrate immediately for instant gratification
    celebrateSuccess(
      side === "yes" ? "YES position opened! 🚀" : "NO position opened! 📉"
    );

    // Call trade handler if provided
    if (onTrade) {
      try {
        await onTrade();
      } catch (error) {
        console.error("Trade failed:", error);
      }
    }

    setTimeout(() => {
      setIsTrading(false);
      setShowSuccess(false);
    }, 2000);
  };

  const pricePercent = (currentPrice * 100).toFixed(1);
  const isYes = side === "yes";
  const colorClass = isYes
    ? "bg-brand-success/20 border-brand-success/50 text-brand-success hover:bg-brand-success/30"
    : "bg-brand-danger/20 border-brand-danger/50 text-brand-danger hover:bg-brand-danger/30";

  if (variant === "icon") {
    return (
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        disabled={isTrading}
        className={`p-2 rounded-lg border ${colorClass} transition-all disabled:opacity-50`}
        title={`Quick trade ${side.toUpperCase()}`}
      >
        {isYes ? (
          <TrendingUp className="w-4 h-4" />
        ) : (
          <TrendingDown className="w-4 h-4" />
        )}
      </motion.button>
    );
  }

  if (variant === "compact") {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        disabled={isTrading}
        className={`px-3 py-1.5 rounded-lg border font-semibold text-sm ${colorClass} transition-all disabled:opacity-50 flex items-center gap-1.5`}
      >
        {isTrading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Zap className="w-3.5 h-3.5" />
            </motion.div>
            Trading...
          </>
        ) : showSuccess ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500 }}
            >
              ✓
            </motion.div>
            Done!
          </>
        ) : (
          <>
            {isYes ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {side.toUpperCase()} {pricePercent}%
          </>
        )}
      </motion.button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      disabled={isTrading}
      className={`w-full px-4 py-3 rounded-xl border-2 font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${colorClass}`}
    >
      {isTrading ? (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Zap className="w-5 h-5" />
          </motion.div>
          <span>Trading...</span>
        </>
      ) : showSuccess ? (
        <>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500 }}
            className="text-2xl"
          >
            ✓
          </motion.div>
          <span>Trade Complete!</span>
        </>
      ) : (
        <>
          {isYes ? (
            <TrendingUp className="w-5 h-5" />
          ) : (
            <TrendingDown className="w-5 h-5" />
          )}
          <span>Quick {side.toUpperCase()}</span>
          <span className="text-xs opacity-75">({pricePercent}%)</span>
        </>
      )}
    </motion.button>
  );
};

