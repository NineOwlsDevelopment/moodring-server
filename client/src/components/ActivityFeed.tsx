import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchActivityFeed, Activity } from "@/api/api";
import {
  formatUSDC,
  formatShares,
  formatDistanceToNow,
} from "@/utils/format";
import { useActivitySocket } from "@/hooks/useSocket";
import { ActivityUpdate } from "@/services/socket";
import { Activity as ActivityIcon, ArrowRight } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { getUserProfileUrl } from "@/utils/userProfile";

interface ActivityFeedProps {
  limit?: number;
  showHeader?: boolean;
}

// Helper to get activity type - handles both 'type' and 'activity_type' from API
const getType = (activity: any): string => {
  return activity.type || activity.activity_type || "unknown";
};

export const ActivityFeed = ({
  limit = 10,
  showHeader = true,
}: ActivityFeedProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Handle real-time activity updates from socket
  const handleActivityUpdate = useCallback(
    (update: ActivityUpdate) => {
      const metadata = update.metadata || {};
      // Convert socket activity to Activity format and prepend
      const newActivity: Activity = {
        id: `${Date.now()}-${Math.random()}`,
        type: update.activity_type as any,
        username: update.username || "anonymous",
        metadata: metadata,
        market_id:
          update.entity_type === "market"
            ? update.entity_id
            : metadata.market_id,
        market_question:
          metadata.market_question ||
          (update.activity_type === "market_created"
            ? metadata.question
            : null),
        created_at: update.timestamp.toString(),
      };

      setActivities((prev) => {
        // Add new activity at the beginning and keep only 'limit' items
        const updated = [newActivity, ...prev].slice(0, limit);
        return updated;
      });
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

  // Load activities only once on mount - WebSocket handles real-time updates
  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

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
          return (
            <span className="flex flex-wrap items-center gap-1">
              <span className="font-semibold text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                @{activity.username}
              </span>
              <span className="text-moon-grey">
                {tradeType === "buy" ? "bought" : "sold"}
              </span>
              <span
                className={
                  side === "yes"
                    ? "text-brand-success font-semibold"
                    : "text-brand-danger font-semibold"
                }
              >
                {formatShares(quantity)} {side?.toUpperCase()}
              </span>
            </span>
          );
        case "market_created":
        case "market_initialized":
          return (
            <span className="flex flex-wrap items-center gap-1">
              <span className="font-semibold text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                @{activity.username}
              </span>
              <span className="text-moon-grey">created a market</span>
            </span>
          );
        case "market_resolved":
          return (
            <span className="flex flex-wrap items-center gap-1">
              <span className="text-moon-grey">Market resolved:</span>
              <span className="text-neon-iris font-semibold">
                {metadata.outcome || metadata.winning_side?.toUpperCase()}
              </span>
            </span>
          );
        case "deposit":
          return (
            <span className="flex flex-wrap items-center gap-1">
              <span className="font-semibold text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                @{activity.username}
              </span>
              <span className="text-moon-grey">deposited</span>
              <span className="text-brand-success font-semibold">
                {formatUSDC(metadata.amount || 0)}
              </span>
            </span>
          );
        case "withdrawal":
          return (
            <span className="flex flex-wrap items-center gap-1">
              <span className="font-semibold text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                @{activity.username}
              </span>
              <span className="text-moon-grey">withdrew</span>
              <span className="text-amber-400 font-semibold">
                {formatUSDC(metadata.amount || 0)}
              </span>
            </span>
          );
        case "claim":
        case "lp_rewards_claimed":
          return (
            <span className="flex flex-wrap items-center gap-1">
              <span className="font-semibold text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                @{activity.username}
              </span>
              <span className="text-moon-grey">claimed</span>
              <span className="text-brand-success font-semibold">
                {formatUSDC(metadata.amount || metadata.rewards || 0)}
              </span>
            </span>
          );
        case "liquidity_added":
          return (
            <span className="flex flex-wrap items-center gap-1">
              <span className="font-semibold text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                @{activity.username}
              </span>
              <span className="text-moon-grey">added liquidity</span>
            </span>
          );
        case "liquidity_removed":
          return (
            <span className="flex flex-wrap items-center gap-1">
              <span className="font-semibold text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                @{activity.username}
              </span>
              <span className="text-moon-grey">removed liquidity</span>
            </span>
          );
        case "user_joined":
          return (
            <span className="flex flex-wrap items-center gap-1">
              <span className="font-semibold text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                @{activity.username}
              </span>
              <span className="text-moon-grey">joined</span>
            </span>
          );
        case "comment":
          return (
            <span className="flex flex-wrap items-center gap-1">
              <span className="font-semibold text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                @{activity.username}
              </span>
              <span className="text-moon-grey">commented</span>
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

  // Get market info from activity or metadata
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
    <div className="card card-mobile">
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

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {activities.map((activity, index) => {
          const { market_id, market_question } = getMarketInfo(activity);

          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-graphite-light/50 hover:bg-graphite-light transition-colors animate-fade-in overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {activity.username && (
                <Link
                  to={getUserProfileUrl(activity.username || activity.user_id)}
                  className="flex-shrink-0 hover:opacity-80 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <UserAvatar
                    name={activity.username}
                    imageUrl={activity.avatar_url}
                    size="md"
                  />
                </Link>
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
