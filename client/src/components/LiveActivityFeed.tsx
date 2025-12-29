import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchActivityFeed, Activity } from "@/api/api";
import {
  formatUSDC,
  formatShares,
  formatDistanceToNow,
} from "@/utils/format";
import { useActivitySocket } from "@/hooks/useSocket";
import { ActivityUpdate } from "@/services/socket";
import { Activity as ActivityIcon, ArrowRight, TrendingUp, Zap } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { createConfetti } from "@/utils/confetti";

interface LiveActivityFeedProps {
  limit?: number;
  showHeader?: boolean;
  compact?: boolean;
}

// Helper to get activity type
const getType = (activity: any): string => {
  return activity.type || activity.activity_type || "unknown";
};

export const LiveActivityFeed = ({
  limit = 15,
  showHeader = true,
  compact = false,
}: LiveActivityFeedProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle real-time activity updates from socket
  const handleActivityUpdate = useCallback(
    (update: ActivityUpdate) => {
      const metadata = update.metadata || {};
      const activityType = update.activity_type;

      // Convert socket activity to Activity format
      const newActivity: Activity = {
        id: `${Date.now()}-${Math.random()}`,
        type: activityType as any,
        username: update.username || "anonymous",
        metadata: metadata,
        market_id:
          update.entity_type === "market"
            ? update.entity_id
            : metadata.market_id,
        market_question:
          metadata.market_question ||
          (activityType === "market_created"
            ? metadata.question
            : null),
        created_at: update.timestamp.toString(),
      };

      setActivities((prev) => {
        // Add new activity at the beginning and keep only 'limit' items
        const updated = [newActivity, ...prev].slice(0, limit);
        return updated;
      });

      // Increment live count for trades
      if (activityType === "trade") {
        setLiveCount((prev) => prev + 1);
        
        // Small confetti burst for large trades
        const tradeAmount = metadata.total_cost || metadata.quantity || 0;
        if (tradeAmount > 1000000) { // > $1 USDC
          createConfetti({
            particleCount: 20,
            spread: 30,
            origin: { x: 0.1, y: 0.1 },
          });
        }
      }
    },
    [limit]
  );

  // Subscribe to real-time activity updates
  useActivitySocket(handleActivityUpdate);

  const loadActivities = useCallback(async () => {
    try {
      const { activities: data } = await fetchActivityFeed({ limit });
      setActivities(data);
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Reset live count every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveCount(0);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const getActivityText = (activity: Activity) => {
    try {
      const metadata =
        typeof activity.metadata === "string"
          ? JSON.parse(activity.metadata)
          : activity.metadata || {};

      const activityType = getType(activity);

      switch (activityType) {
        case "trade":
          const side = metadata.side || metadata.option_side;
          const tradeType = metadata.trade_type || metadata.action;
          const quantity = metadata.quantity || metadata.shares || 0;
          const cost = metadata.total_cost || 0;
          const isLarge = cost > 1000000; // > $1 USDC
          
          return (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-white truncate max-w-[100px] inline-block">
                @{activity.username}
              </span>
              <span className="text-moon-grey">
                {tradeType === "buy" ? "bought" : "sold"}
              </span>
              {isLarge && (
                <TrendingUp className="w-3.5 h-3.5 text-brand-success animate-pulse" />
              )}
              <span
                className={`font-bold ${
                  side === "yes"
                    ? "text-brand-success"
                    : "text-brand-danger"
                }`}
              >
                {formatShares(quantity)} {side?.toUpperCase()}
              </span>
              {cost > 0 && (
                <span className="text-aqua-pulse font-semibold">
                  {formatUSDC(cost)}
                </span>
              )}
            </span>
          );
        case "market_created":
        case "market_initialized":
          return (
            <span className="flex flex-wrap items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-neon-iris" />
              <span className="font-bold text-white truncate max-w-[100px] inline-block">
                @{activity.username}
              </span>
              <span className="text-moon-grey">created a market</span>
            </span>
          );
        case "market_resolved":
          return (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-moon-grey">Market resolved:</span>
              <span className="text-neon-iris font-bold">
                {metadata.outcome || metadata.winning_side?.toUpperCase()}
              </span>
            </span>
          );
        default:
          return (
            <span className="text-moon-grey capitalize">
              {activityType.replace(/_/g, " ")}
            </span>
          );
      }
    } catch {
      return (
        <span className="text-moon-grey capitalize">
          {getType(activity).replace(/_/g, " ")}
        </span>
      );
    }
  };

  const getMarketInfo = (activity: Activity) => {
    const metadata =
      typeof activity.metadata === "string"
        ? (() => {
            try {
              return JSON.parse(activity.metadata);
            } catch {
              return {};
            }
          })()
        : activity.metadata || {};

    return {
      market_id: activity.market_id || metadata.market_id,
      market_question: activity.market_question || metadata.market_question,
    };
  };

  if (isLoading) {
    return (
      <div className="card card-mobile">
        {showHeader && (
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-success" />
              </span>
            </div>
            <h3 className="font-semibold text-white">Live Activity</h3>
          </div>
        )}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 bg-graphite-light rounded-lg skeleton-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="card card-mobile">
        {showHeader && (
          <h3 className="font-semibold text-white mb-4">Live Activity</h3>
        )}
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 rounded-full bg-graphite-light flex items-center justify-center mb-3">
            <ActivityIcon className="w-6 h-6 text-moon-grey-dark" />
          </div>
          <p className="text-moon-grey text-center">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-mobile" ref={containerRef}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-success" />
              </span>
            </div>
            <h3 className="font-semibold text-white">Live Activity</h3>
            {liveCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-2 px-2 py-0.5 bg-neon-iris/20 border border-neon-iris/30 rounded-full text-xs font-bold text-neon-iris"
              >
                +{liveCount}
              </motion.span>
            )}
          </div>
          <Link
            to="/activity"
            className="text-sm text-neon-iris hover:text-neon-iris-light flex items-center gap-1 transition-colors"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div
        className={`space-y-2 overflow-y-auto ${
          compact ? "max-h-[300px]" : "max-h-[500px]"
        }`}
      >
        <AnimatePresence mode="popLayout">
          {activities.map((activity, index) => {
            const { market_id, market_question } = getMarketInfo(activity);
            const isNew = index === 0; // First item is newest

            return (
              <motion.div
                key={activity.id}
                initial={isNew ? { opacity: 0, y: -20, scale: 0.95 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`flex items-start gap-3 p-3 rounded-xl bg-graphite-light/50 hover:bg-graphite-light transition-colors ${
                  isNew ? "ring-2 ring-neon-iris/50" : ""
                }`}
              >
                {activity.username && (
                  <UserAvatar
                    name={activity.username}
                    imageUrl={activity.avatar_url}
                    size="md"
                  />
                )}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="text-sm text-moon-grey leading-relaxed">
                    {getActivityText(activity)}
                  </div>
                  {market_question && (
                    <Link
                      to={`/market/${market_id}`}
                      className="text-xs text-moon-grey-dark hover:text-neon-iris line-clamp-1 mt-1 transition-colors block"
                    >
                      {market_question}
                    </Link>
                  )}
                </div>
                <div className="text-xs text-moon-grey-dark flex-shrink-0 whitespace-nowrap">
                  {formatDistanceToNow(Number(activity.created_at))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

