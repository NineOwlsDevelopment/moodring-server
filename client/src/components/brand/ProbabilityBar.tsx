import { motion } from "framer-motion";

interface ProbabilityBarProps {
  value: number; // 0-1
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  animated?: boolean;
  className?: string;
}

/**
 * Probability visualization bar using brand colors.
 * Shows YES probability in aqua/green and NO in pink/red.
 */
export const ProbabilityBar = ({
  value,
  size = "md",
  showLabels = false,
  animated = true,
  className = "",
}: ProbabilityBarProps) => {
  const clampedValue = Math.max(0, Math.min(1, value));
  const yesPercent = (clampedValue * 100).toFixed(1);
  const noPercent = ((1 - clampedValue) * 100).toFixed(1);

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabels && (
        <div className="flex justify-between items-center mb-1.5 text-xs font-medium">
          <span className="text-aqua-pulse tabular-nums">
            Yes {yesPercent}%
          </span>
          <span className="text-brand-danger tabular-nums">
            No {noPercent}%
          </span>
        </div>
      )}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-graphite-hover rounded-full overflow-hidden`}
      >
        {/* YES fill */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-aqua-pulse to-aqua-pulse-light rounded-full"
          initial={animated ? { width: 0 } : false}
          animate={{ width: `${parseFloat(yesPercent)}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
        {/* Center divider glow */}
        <div
          className="absolute inset-y-0 w-px bg-white/40"
          style={{
            left: `${parseFloat(yesPercent)}%`,
            transform: "translateX(-50%)",
          }}
        />
      </div>
    </div>
  );
};

/**
 * Compact probability display with just the percentage
 */
export const ProbabilityBadge = ({
  value,
  side = "yes",
  size = "md",
}: {
  value: number;
  side?: "yes" | "no";
  size?: "sm" | "md" | "lg";
}) => {
  const percent = (value * 100).toFixed(1);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-2.5 py-1.5",
  };

  const colorClasses =
    side === "yes"
      ? "bg-aqua-pulse/15 text-aqua-pulse"
      : "bg-brand-danger/15 text-brand-danger";

  return (
    <span
      className={`${sizeClasses[size]} ${colorClasses} rounded-lg font-semibold tabular-nums`}
    >
      {percent}%
    </span>
  );
};
