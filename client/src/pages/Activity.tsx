import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import {
  fetchMyActivity,
  fetchActivityFeed,
  Activity as ActivityType,
} from "@/api/api";
import {
  formatUSDC,
  formatShares,
  formatDistanceToNow,
  capitalizeWords,
} from "@/utils/format";
import {
  BarChart3,
  ArrowDownToLine,
  Trophy,
  Activity as ActivityIcon,
  Wallet,
  TrendingUp,
  Clock,
  Filter,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";

// Helper to get activity type - handles both 'type' and 'activity_type' from API
const getType = (activity: any): string => {
  return activity.type || activity.activity_type || "unknown";
};

const ActivityItem = ({ activity }: { activity: ActivityType }) => {
  // Parse metadata safely
  const getMetadata = () => {
    if (!activity.metadata) return {};
    if (typeof activity.metadata === "string") {
      try {
        return JSON.parse(activity.metadata);
      } catch {
        return {};
      }
    }
    return activity.metadata;
  };

  const metadata = getMetadata();
  const activityType = getType(activity);

  const getActivityDescription = () => {
    switch (activityType) {
      case "trade":
        const side = metadata.side || metadata.option_side;
        const tradeType = metadata.trade_type || metadata.action;
        const quantity = metadata.quantity || metadata.shares || 0;
        const amount =
          metadata.amount || metadata.cost || metadata.total_cost || 0;

        return (
          <span className="flex flex-wrap items-center gap-1">
            <span
              className={`font-semibold ${
                side === "yes" ? "text-brand-success" : "text-brand-danger"
              }`}
            >
              {tradeType === "buy" ? "Bought" : "Sold"} {formatShares(quantity)}{" "}
              {side?.toUpperCase()}
            </span>
            <span className="text-moon-grey">shares</span>
            {amount > 0 && (
              <>
                <span className="text-moon-grey">for</span>
                <span className="font-semibold text-white">
                  {formatUSDC(amount)}
                </span>
              </>
            )}
          </span>
        );
      case "market_created":
      case "market_initialized":
        return <span className="text-moon-grey">Created a new market</span>;
      case "market_resolved":
        return (
          <span className="flex items-center gap-1 flex-wrap">
            <span className="text-moon-grey">Market resolved:</span>
            <span className="font-semibold text-neon-iris">
              {metadata.outcome || metadata.winning_side?.toUpperCase()}
            </span>
          </span>
        );
      case "deposit":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey">Deposited</span>
            <span className="font-semibold text-brand-success">
              {formatUSDC(metadata.amount || 0)}
            </span>
          </span>
        );
      case "withdrawal":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey">Withdrew</span>
            <span className="font-semibold text-amber-400">
              {formatUSDC(metadata.amount || 0)}
            </span>
          </span>
        );
      case "claim":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey">Claimed</span>
            <span className="font-semibold text-brand-success">
              {formatUSDC(metadata.payout || 0)}
            </span>
          </span>
        );
      case "lp_rewards_claimed":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey">Claimed LP rewards</span>
            <span className="font-semibold text-brand-success">
              {formatUSDC(metadata.usdc_payout || 0)}
            </span>
          </span>
        );
      case "liquidity_added":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey">Added liquidity:</span>
            <span className="font-semibold text-aqua-pulse">
              {formatUSDC(metadata.amount || 0)}
            </span>
          </span>
        );
      case "liquidity_removed":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey">Removed liquidity:</span>
            <span className="font-semibold text-amber-400">
              {formatUSDC(metadata.amount || 0)}
            </span>
          </span>
        );
      case "user_joined":
        return <span className="text-moon-grey">Joined the platform</span>;
      case "comment":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey">Commented on market</span>
          </span>
        );
      default:
        return (
          <span className="text-moon-grey capitalize">
            {activityType.replace(/_/g, " ")}
          </span>
        );
    }
  };

  // Get market info from activity, metadata, or entity_id
  const marketId =
    activity.market_id ||
    metadata.market_id ||
    (activityType === "market_created" &&
    (activity as any).entity_type === "market"
      ? (activity as any).entity_id
      : null);

  const marketQuestion =
    activity.market_question ||
    metadata.market_question ||
    (activityType === "market_created" ? metadata.question : null);

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-graphite-light/50 hover:bg-graphite-light transition-all duration-200  animate-fade-in">
      {/* User Avatar */}
      {activity.username && (
        <UserAvatar
          name={activity.username}
          imageUrl={activity.avatar_url}
          size="md"
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            {/* User & action */}
            <div className="text-sm leading-relaxed flex flex-wrap items-center gap-x-1">
              {activity.username && (
                <span className="font-semibold text-white truncate max-w-[120px] inline-block align-middle">
                  @{activity.username}
                </span>
              )}
              {getActivityDescription()}
            </div>

            {/* Market link */}
            {marketId && marketQuestion && (
              <Link
                to={`/market/${marketId}`}
                className="text-neon-iris hover:text-neon-iris-light text-sm font-medium line-clamp-1 mt-1.5 transition-colors block"
              >
                {capitalizeWords(marketQuestion)}
              </Link>
            )}
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-1.5 text-xs text-moon-grey-dark flex-shrink-0 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" />
            {formatDistanceToNow(Number(activity.created_at))}
          </div>
        </div>
      </div>
    </div>
  );
};

const filters = [
  { id: "all", label: "All", icon: TrendingUp },
  { id: "trade", label: "Trades", icon: BarChart3 },
  { id: "deposit", label: "Deposits", icon: Wallet },
  { id: "withdrawal", label: "Withdrawals", icon: ArrowDownToLine },
  { id: "claim", label: "Claims", icon: Trophy },
];

export const Activity = () => {
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState<"my" | "global">(
    user ? "my" : "global"
  );
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadActivities();
  }, [activeTab, filter, user]);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "my" && user) {
        const { activities: data } = await fetchMyActivity({
          type: filter !== "all" ? filter : undefined,
        });
        setActivities(data);
      } else {
        const { activities: data } = await fetchActivityFeed();
        setActivities(data);
      }
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-neon-iris/5 via-transparent to-aqua-pulse/5 pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              Activity
            </h1>
            <p className="text-moon-grey text-sm">
              Track your transactions and platform activity
            </p>
          </div>

          {/* Tabs */}
          <div className="flex bg-graphite-light rounded-xl p-1 ">
            {user && (
              <button
                onClick={() => setActiveTab("my")}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 min-h-[40px] ${
                  activeTab === "my"
                    ? "bg-gradient-brand text-white shadow-neon-subtle"
                    : "text-moon-grey hover:text-white hover:bg-white/5"
                }`}
              >
                My Activity
              </button>
            )}
            <button
              onClick={() => setActiveTab("global")}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 min-h-[40px] ${
                activeTab === "global"
                  ? "bg-gradient-brand text-white shadow-neon-subtle"
                  : "text-moon-grey hover:text-white hover:bg-white/5"
              }`}
            >
              Global Feed
            </button>
          </div>
        </div>

        {/* Filters (only for My Activity) */}
        {activeTab === "my" && user && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-moon-grey-dark" />
              <span className="text-sm text-moon-grey-dark">Filter by</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 min-h-[40px] ${
                      filter === f.id
                        ? "bg-gradient-brand text-white shadow-neon-subtle"
                        : "bg-graphite-light text-moon-grey  hover:text-white "
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Activity List Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-success" />
              </span>
            </div>
            <h2 className="text-lg font-semibold text-white">
              {activeTab === "my" ? "Recent Transactions" : "Platform Activity"}
            </h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 bg-graphite-light rounded-xl skeleton-pulse"
                />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-graphite-light flex items-center justify-center mb-4">
                <ActivityIcon className="w-8 h-8 text-moon-grey-dark" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                No activity yet
              </h3>
              <p className="text-moon-grey text-center max-w-sm mb-6">
                {activeTab === "my"
                  ? "Start trading to see your transaction history here!"
                  : "No recent activity on the platform."}
              </p>
              {activeTab === "my" && (
                <Link to="/markets" className="btn btn-primary">
                  Browse Markets
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <ActivityItem activity={activity} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Load More */}
        {!isLoading && activities.length > 0 && (
          <div className="text-center mt-6">
            <button className="text-neon-iris hover:text-neon-iris-light text-sm font-medium transition-colors">
              Load more activity
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
