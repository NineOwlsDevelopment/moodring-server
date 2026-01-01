import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useUserStore } from "@/stores/userStore";
import {
  fetchMyActivity,
  Activity as ActivityType,
} from "@/api/api";
import {
  formatUSDC,
  formatShares,
  formatDistanceToNow,
} from "@/utils/format";
import {
  BarChart3,
  ArrowDownToLine,
  Trophy,
  Activity as ActivityIcon,
  Wallet,
  TrendingUp,
  Clock,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";

// Animation variants matching Home page
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

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
              className={`font-medium ${
                side === "yes" ? "text-aqua-pulse" : "text-rose-400"
              }`}
            >
              {tradeType === "buy" ? "Bought" : "Sold"} {formatShares(quantity)}{" "}
              {side?.toUpperCase()}
            </span>
            <span className="text-moon-grey/60">shares</span>
            {amount > 0 && (
              <>
                <span className="text-moon-grey/60">for</span>
                <span className="font-medium text-white">
                  {formatUSDC(amount)}
                </span>
              </>
            )}
          </span>
        );
      case "market_created":
      case "market_initialized":
        return <span className="text-moon-grey/60">Created a new market</span>;
      case "market_resolved":
        return (
          <span className="flex items-center gap-1 flex-wrap">
            <span className="text-moon-grey/60">Market resolved:</span>
            <span className="font-medium text-neon-iris">
              {metadata.outcome || metadata.winning_side?.toUpperCase()}
            </span>
          </span>
        );
      case "deposit":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey/60">Deposited</span>
            <span className="font-medium text-aqua-pulse">
              {formatUSDC(metadata.amount || 0)}
            </span>
          </span>
        );
      case "withdrawal":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey/60">Withdrew</span>
            <span className="font-medium text-amber-400">
              {formatUSDC(metadata.amount || 0)}
            </span>
          </span>
        );
      case "claim":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey/60">Claimed</span>
            <span className="font-medium text-aqua-pulse">
              {formatUSDC(metadata.payout || 0)}
            </span>
          </span>
        );
      case "lp_rewards_claimed":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey/60">Claimed LP rewards</span>
            <span className="font-medium text-aqua-pulse">
              {formatUSDC(metadata.usdc_payout || 0)}
            </span>
          </span>
        );
      case "liquidity_added":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey/60">Added liquidity:</span>
            <span className="font-medium text-aqua-pulse">
              {formatUSDC(metadata.amount || 0)}
            </span>
          </span>
        );
      case "liquidity_removed":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey/60">Removed liquidity:</span>
            <span className="font-medium text-amber-400">
              {formatUSDC(metadata.amount || 0)}
            </span>
          </span>
        );
      case "user_joined":
        return <span className="text-moon-grey/60">Joined the platform</span>;
      case "comment":
        return (
          <span className="flex items-center gap-1">
            <span className="text-moon-grey/60">Commented on market</span>
          </span>
        );
      default:
        return (
          <span className="text-moon-grey/60 capitalize">
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
    <motion.div
      variants={fadeInUp}
      className="flex items-start gap-4 p-5 bg-graphite-deep/50 border border-white/5 hover:border-white/10 transition-colors duration-300"
    >
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
            <div className="text-sm leading-relaxed flex flex-wrap items-center gap-x-1.5">
              {activity.username && (
                <span className="font-medium text-white truncate max-w-[140px] inline-block align-middle">
                  @{activity.username}
                </span>
              )}
              {getActivityDescription()}
            </div>

            {/* Market link */}
            {marketId && marketQuestion && (
              <Link
                to={`/market/${marketId}`}
                className="text-neon-iris/80 hover:text-neon-iris text-sm font-light line-clamp-1 mt-2 transition-colors block"
              >
                {marketQuestion}
              </Link>
            )}
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-1.5 text-[10px] tracking-[0.1em] uppercase text-moon-grey/50 flex-shrink-0 whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(Number(activity.created_at))}
          </div>
        </div>
      </div>
    </motion.div>
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
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadActivities();
  }, [filter, user]);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      if (user) {
        const { activities: data } = await fetchMyActivity({
          type: filter !== "all" ? filter : undefined,
        });
        setActivities(data);
      } else {
        // If user is not logged in, show empty state
        setActivities([]);
      }
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-black pb-20 md:pb-8">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(33,246,210,0.05),transparent_50%)]" />
      </div>

      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/20 to-transparent" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12"
        >
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-8 sm:w-12 bg-gradient-to-r from-transparent to-neon-iris/60" />
            <span className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-moon-grey/70 font-medium">
              Transaction History
            </span>
            <div className="h-px w-8 sm:w-12 bg-gradient-to-l from-transparent to-neon-iris/60" />
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white mb-3">
            Activity
          </h1>
          <p className="text-moon-grey/60 text-base font-light">
            Track your transactions and trading history
          </p>
        </motion.div>

        {/* Filters */}
        {user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-10"
          >
            <div className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 mb-4 font-medium">
              Filter by type
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs tracking-wide uppercase font-medium transition-all duration-300 border ${
                      filter === f.id
                        ? "bg-white text-ink-black border-white"
                        : "bg-transparent text-moon-grey/60 border-white/10 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Activity List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-graphite-deep/30 border border-white/5"
        >
          {/* Section Header */}
          <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
            <div className="relative">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aqua-pulse opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-aqua-pulse" />
              </span>
            </div>
            <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
              Recent Transactions
            </h2>
          </div>

          {/* Content */}
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 bg-graphite-deep/50 border border-white/5 animate-pulse"
                  />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 border border-white/10 flex items-center justify-center mb-6">
                  <ActivityIcon className="w-7 h-7 text-moon-grey/40" />
                </div>
                <h3 className="text-xl font-light text-white mb-3">
                  No activity yet
                </h3>
                <p className="text-moon-grey/60 text-center max-w-sm mb-8 font-light">
                  {user
                    ? "Start trading to see your transaction history here."
                    : "Please log in to view your activity."}
                </p>
                {user && (
                  <Link
                    to="/markets"
                    className="group px-6 py-3 text-sm font-medium tracking-wide uppercase bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 inline-flex items-center gap-3"
                  >
                    <span>Browse Markets</span>
                    <svg
                      className="w-4 h-4 transition-transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </Link>
                )}
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-2"
              >
                {activities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Load More */}
        {!isLoading && activities.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-8"
          >
            <button className="text-xs tracking-[0.2em] uppercase text-moon-grey/50 hover:text-white transition-colors duration-300 font-medium">
              Load more activity
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
