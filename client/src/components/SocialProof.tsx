import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, TrendingUp } from "lucide-react";
import { formatNumberRoundedUp } from "@/utils/format";
import { useMarketWatchers } from "@/hooks/useSocket";

interface SocialProofProps {
  marketId: string;
  watchers?: number;
  recentActivity?: Array<{
    username: string;
    action: string;
    timestamp: number;
  }>;
  className?: string;
}

/**
 * Social proof component showing live activity and engagement
 * Creates FOMO with "X traders watching", "Y just bought" messages
 */
export const SocialProof = ({
  marketId,
  watchers: _watchers,
  recentActivity = [],
  className = "",
}: SocialProofProps) => {
  // Get real-time watcher count from WebSocket
  const liveWatchers = useMarketWatchers(marketId);
  const [displayedActivity, setDisplayedActivity] = useState(recentActivity);

  // Rotate through recent activity
  useEffect(() => {
    if (recentActivity.length === 0) return;

    const interval = setInterval(() => {
      setDisplayedActivity((prev) => {
        const nextIndex = (prev.length + 1) % recentActivity.length;
        return [recentActivity[nextIndex], ...prev].slice(0, 3);
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [recentActivity]);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Live watchers count */}
      {liveWatchers > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 bg-graphite-light/50 rounded-lg border border-white/5"
        >
          <div className="relative">
            <Eye className="w-4 h-4 text-aqua-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-brand-success rounded-full animate-pulse" />
          </div>
          <span className="text-sm text-moon-grey">
            <span className="font-bold text-white">
              {formatNumberRoundedUp(liveWatchers)}
            </span>{" "}
            watching
          </span>
        </motion.div>
      )}

      {/* Recent activity feed */}
      <AnimatePresence mode="popLayout">
        {displayedActivity.map((activity, index) => (
          <motion.div
            key={`${activity.username}-${activity.timestamp}-${index}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-graphite-light/30 rounded-lg"
          >
            <TrendingUp className="w-3.5 h-3.5 text-brand-success" />
            <span className="text-xs text-moon-grey">
              <span className="font-semibold text-white">
                @{activity.username}
              </span>{" "}
              {activity.action}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

/**
 * Quick activity notification that appears and disappears
 */
export const QuickActivityToast = ({
  username,
  action,
  marketName,
  onClose,
}: {
  username: string;
  action: string;
  marketName: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className="fixed top-20 right-4 z-50 px-4 py-3 bg-graphite-deep border border-neon-iris/30 rounded-xl shadow-lg max-w-sm"
    >
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-brand-success rounded-full animate-pulse" />
        <div className="flex-1">
          <p className="text-sm text-white">
            <span className="font-bold">@{username}</span> {action}
          </p>
          <p className="text-xs text-moon-grey-dark truncate">{marketName}</p>
        </div>
      </div>
    </motion.div>
  );
};
