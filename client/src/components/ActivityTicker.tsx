import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchActivityFeed, Activity } from "@/api/api";
import { useActivitySocket } from "@/hooks/useSocket";
import { ActivityUpdate } from "@/services/socket";
import { Zap } from "lucide-react";

// Helper to get activity type
const getType = (activity: any): string => {
  return activity.type || activity.activity_type || "unknown";
};

/**
 * Scrolling activity ticker at the top of the page
 * Shows live activity in a compact, scrolling format
 */
export const ActivityTicker = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // Handle real-time activity updates
  const handleActivityUpdate = useCallback((update: ActivityUpdate) => {
    const metadata = update.metadata || {};
    const activityType = update.activity_type;

    // Only show market creation/initialization, never trades
    if (
      activityType !== "market_created" &&
      activityType !== "market_initialized"
    ) {
      return;
    }

    const newActivity: Activity = {
      id: `${Date.now()}-${Math.random()}`,
      type: activityType as any,
      username: update.username || "anonymous",
      metadata: metadata,
      market_id:
        update.entity_type === "market" ? update.entity_id : metadata.market_id,
      market_question:
        metadata.market_question ||
        (activityType === "market_created" ? metadata.question : null),
      created_at: update.timestamp.toString(),
    };

    setActivities((prev) => {
      const updated = [newActivity, ...prev].slice(0, 20);
      return updated;
    });
  }, []);

  useActivitySocket(handleActivityUpdate);

  const loadActivities = useCallback(async () => {
    try {
      const { activities: data } = await fetchActivityFeed({ limit: 30 });
      // Filter to only market creation/initialization
      const marketActivities = data.filter(
        (activity) =>
          getType(activity) === "market_created" ||
          getType(activity) === "market_initialized"
      );
      setActivities(marketActivities);
    } catch (error) {
      console.error("Failed to load activities:", error);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const getActivityText = (activity: Activity) => {
    try {
      const activityType = getType(activity);

      // Only show market creation/initialization
      if (
        activityType === "market_created" ||
        activityType === "market_initialized"
      ) {
        const metadata =
          typeof activity.metadata === "string"
            ? JSON.parse(activity.metadata)
            : activity.metadata || {};

        const marketQuestion =
          activity.market_question ||
          metadata.question ||
          metadata.market_question;

        return (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Zap className="w-2.5 h-2.5 text-neon-iris flex-shrink-0" />
            <span className="text-white text-[10px] font-medium max-w-[200px] truncate">
              {marketQuestion || "New market"}
            </span>
          </span>
        );
      }

      return null;
    } catch {
      return null;
    }
  };

  // Get initials from username
  const getInitials = (username: string) => {
    if (!username) return "?";
    const parts = username.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
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

  if (activities.length === 0) {
    return null;
  }

  // Duplicate activities for seamless loop
  const duplicatedActivities = [...activities, ...activities];

  return (
    <div
      className="relative h-8 bg-graphite-deep/90 backdrop-blur-sm border-b border-white/5 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Live indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-neon-iris to-aqua-pulse z-10" />
      <div className="absolute left-2 top-0 bottom-0 flex items-center z-10">
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neon-iris/10 border border-neon-iris/20">
          <div className="relative">
            <span className="flex h-1 w-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-success opacity-75" />
              <span className="relative inline-flex rounded-full h-1 w-1 bg-brand-success" />
            </span>
          </div>
          <span className="text-[9px] font-bold text-neon-iris uppercase tracking-wider">
            Live
          </span>
        </div>
      </div>

      {/* Scrolling content */}
      <div className="ml-20 h-full flex items-center overflow-hidden">
        <div
          className={`flex items-center gap-6 ${
            isPaused ? "" : "animate-scroll"
          }`}
          style={{
            animationDuration: `${activities.length * 15}s`,
          }}
        >
          {duplicatedActivities
            .filter((activity) => {
              const type = getType(activity);
              return type === "market_created" || type === "market_initialized";
            })
            .map((activity, index) => {
              const { market_id } = getMarketInfo(activity);
              const activityText = getActivityText(activity);
              if (!activityText) return null;

              return (
                <Link
                  key={`${activity.id}-${index}`}
                  to={market_id ? `/market/${market_id}` : "#"}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/5 transition-colors group flex-shrink-0"
                >
                  {/* Small avatar or initials */}
                  {activity.username ? (
                    activity.avatar_url ? (
                      <img
                        src={activity.avatar_url}
                        alt={activity.username}
                        className="w-4 h-4 rounded-full border border-white/10"
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-neon-iris/20 border border-neon-iris/30 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-neon-iris">
                          {getInitials(activity.username)}
                        </span>
                      </div>
                    )
                  ) : null}

                  {/* Activity text */}
                  {activityText}

                  {/* Separator */}
                  <span className="text-moon-grey-dark/50 text-[8px]">•</span>
                </Link>
              );
            })}
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll linear infinite;
        }
      `}</style>
    </div>
  );
};
