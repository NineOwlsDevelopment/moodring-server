import { motion } from "framer-motion";
import { TrendingUp, Zap, Flame } from "lucide-react";

interface TrendingBadgeProps {
  type: "trending" | "hot" | "pump" | "new";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const badgeConfig = {
  trending: {
    icon: TrendingUp,
    label: "TRENDING",
    colors: "bg-aqua-pulse/20 border-aqua-pulse/50 text-aqua-pulse",
    glow: "shadow-[0_0_12px_rgba(0,229,255,0.4)]",
  },
  hot: {
    icon: Flame,
    label: "HOT",
    colors: "bg-brand-danger/20 border-brand-danger/50 text-brand-danger",
    glow: "shadow-[0_0_12px_rgba(239,68,68,0.4)]",
  },
  pump: {
    icon: Zap,
    label: "PUMP",
    colors: "bg-brand-warning/20 border-brand-warning/50 text-brand-warning",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.4)]",
  },
  new: {
    icon: Zap,
    label: "NEW",
    colors: "bg-neon-iris/20 border-neon-iris/50 text-neon-iris",
    glow: "shadow-[0_0_12px_rgba(124,77,255,0.4)]",
  },
};

export const TrendingBadge = ({
  type,
  size = "md",
  className = "",
}: TrendingBadgeProps) => {
  const config = badgeConfig[type];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className={`inline-flex items-center font-bold rounded-full border ${config.colors} ${config.glow} ${sizeClasses[size]} ${className}`}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
    </motion.div>
  );
};

/**
 * Determine trending status based on market metrics
 */
export const getTrendingStatus = (market: {
  total_volume: number;
  created_at: number;
  total_open_interest?: number;
}): "trending" | "hot" | "pump" | "new" | null => {
  const now = Date.now() / 1000;
  const age = now - market.created_at;
  const volume = market.total_volume || 0;
  const openInterest = market.total_open_interest || 0;

  // New market (created in last hour)
  if (age < 3600) {
    return "new";
  }

  // Pumping market (high volume in short time)
  if (age < 86400 && volume > 10000000) {
    // > $10 USDC in first 24h
    return "pump";
  }

  // Hot market (high volume + high open interest)
  if (volume > 50000000 && openInterest > 20000000) {
    // > $50 volume and > $20 open interest
    return "hot";
  }

  // Trending (moderate volume, recent activity)
  if (volume > 10000000 && age < 604800) {
    // > $10 volume in last week
    return "trending";
  }

  return null;
};

