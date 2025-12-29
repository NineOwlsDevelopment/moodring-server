import { motion } from "framer-motion";
import { Flame, Trophy, Star, Zap } from "lucide-react";

interface GamificationBadgeProps {
  type: "streak" | "achievement" | "rank" | "points";
  value: number | string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const badgeConfig = {
  streak: {
    icon: Flame,
    label: "Day Streak",
    colors: "bg-brand-warning/20 border-brand-warning/50 text-brand-warning",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.4)]",
  },
  achievement: {
    icon: Trophy,
    label: "Achievement",
    colors: "bg-neon-iris/20 border-neon-iris/50 text-neon-iris",
    glow: "shadow-[0_0_12px_rgba(124,77,255,0.4)]",
  },
  rank: {
    icon: Star,
    label: "Rank",
    colors: "bg-aqua-pulse/20 border-aqua-pulse/50 text-aqua-pulse",
    glow: "shadow-[0_0_12px_rgba(0,229,255,0.4)]",
  },
  points: {
    icon: Zap,
    label: "Points",
    colors: "bg-brand-success/20 border-brand-success/50 text-brand-success",
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.4)]",
  },
};

export const GamificationBadge = ({
  type,
  value,
  size = "md",
  className = "",
}: GamificationBadgeProps) => {
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
      <span>{value}</span>
      {size !== "sm" && <span className="opacity-75 ml-1">{config.label}</span>}
    </motion.div>
  );
};

/**
 * Streak counter component with animation
 */
export const StreakCounter = ({
  days,
  className = "",
}: {
  days: number;
  className?: string;
}) => {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`flex items-center gap-2 ${className}`}
    >
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Flame className="w-5 h-5 text-brand-warning" />
      </motion.div>
      <div>
        <div className="text-lg font-bold text-white">{days}</div>
        <div className="text-xs text-moon-grey-dark">Day Streak</div>
      </div>
    </motion.div>
  );
};

