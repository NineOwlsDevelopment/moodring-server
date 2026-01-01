import { useState, useEffect, memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useUserStore } from "@/stores/userStore";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreferences,
  fetchPortfolio,
  fetchPositions,
  fetchLiquidityPositions,
  PortfolioSummary,
  Position,
  LiquidityPosition,
  fetchMyActivity,
  Activity as ActivityType,
  updateUserProfile,
  uploadAvatar,
} from "@/api/api";
import {
  formatUSDC,
  formatProbability,
  formatShares,
  formatDistanceToNow,
} from "@/utils/format";
import { isReservedDisplayName } from "@/utils/reservedNames";
import { UserAvatar } from "@/components/UserAvatar";
import { compressAvatar } from "@/utils/imageCompression";
import {
  User,
  Briefcase,
  Activity as ActivityIcon,
  Bell,
  Shield,
  BarChart3,
  ArrowDownToLine,
  TrendingUp,
  Wallet,
  Clock,
  Droplets,
  Laptop,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

type Tab = "profile" | "notifications" | "security" | "portfolio" | "activity";
type PositionFilter = "open" | "closed" | "all";

// Animation variants matching Home page
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] },
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

export const Settings = () => {
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Notification state
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Portfolio state
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("open");
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [liquidityPositions, setLiquidityPositions] = useState<
    LiquidityPosition[]
  >([]);
  const [portfolioTab, setPortfolioTab] = useState<"positions" | "liquidity">(
    "positions"
  );

  // Activity state
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [activityFilter, setActivityFilter] = useState<string>("all");

  // Profile state
  const [displayName, setDisplayName] = useState<string>("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadPreferences();
      setDisplayName(user.display_name || "");
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === "portfolio") {
      loadPortfolioData();
    }
  }, [user, activeTab, positionFilter]);

  useEffect(() => {
    if (activeTab === "activity") {
      loadActivities();
    }
  }, [activeTab, activityFilter, user]);

  const loadPreferences = async () => {
    setIsLoading(true);
    try {
      const prefs = await fetchNotificationPreferences();
      setNotificationPrefs(prefs);
    } catch (error) {
      console.error("Failed to load preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPortfolioData = async () => {
    setIsLoading(true);
    try {
      const [portfolioData, positionsData, liquidityData] = await Promise.all([
        fetchPortfolio(),
        fetchPositions({ status: positionFilter }),
        fetchLiquidityPositions(),
      ]);
      setPortfolio(portfolioData);
      setPositions(positionsData.positions);
      setLiquidityPositions(liquidityData.positions);
    } catch (error) {
      console.error("Failed to load portfolio:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      if (user) {
        const { activities: data } = await fetchMyActivity({
          type: activityFilter !== "all" ? activityFilter : undefined,
        });
        setActivities(data);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationPreferences) => {
    if (!notificationPrefs) return;

    const newValue = !notificationPrefs[key];
    setNotificationPrefs({ ...notificationPrefs, [key]: newValue });

    try {
      await updateNotificationPreferences({ [key]: newValue });
      setSaveMessage("Preferences saved!");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error("Failed to update preferences:", error);
      setNotificationPrefs({ ...notificationPrefs, [key]: !newValue });
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setProfileError(null);
    setIsSavingProfile(true);

    const trimmedDisplayName = displayName.trim();

    // Validate reserved names
    if (trimmedDisplayName && isReservedDisplayName(trimmedDisplayName)) {
      setProfileError(
        "This display name is reserved and cannot be used. Please choose a different name."
      );
      setIsSavingProfile(false);
      return;
    }

    try {
      const response = await updateUserProfile({
        display_name: trimmedDisplayName || undefined,
      });

      // Update user store with new display name
      const { setUser } = useUserStore.getState();
      if (setUser && response.user && user) {
        setUser({ ...user, display_name: response.user.display_name });
      }

      setSaveMessage("Profile updated successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to update profile";
      setProfileError(errorMessage);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setProfileError(null);

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      setProfileError(
        "Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image."
      );
      e.target.value = "";
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setProfileError(
        "File size exceeds 10MB limit. Please choose a smaller image."
      );
      e.target.value = "";
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Compress image before upload
      const compressedFile = await compressAvatar(file);

      // Create preview from compressed file
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);

      const response = await uploadAvatar({ avatar: compressedFile });

      // Update user store with new avatar
      const { setUser } = useUserStore.getState();
      if (setUser && response.user && user) {
        setUser({ ...user, avatar_url: response.user.avatar_url });
      }

      setSaveMessage("Avatar uploaded successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
      setAvatarPreview(null);
    } catch (error: any) {
      console.error("Failed to upload avatar:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to upload avatar";
      setProfileError(errorMessage);
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-ink-black overflow-hidden">
        {/* Atmospheric background */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.1),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(33,246,210,0.06),transparent_50%)]" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 border border-white/10 mb-8">
              <User className="w-10 h-10 text-moon-grey/60" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white mb-4">
              Settings
            </h1>
            <p className="text-moon-grey/60 text-base sm:text-lg font-light">
              Connect your wallet to access settings
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "portfolio" as const, label: "Portfolio", icon: Briefcase },
    { id: "activity" as const, label: "Activity", icon: ActivityIcon },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "security" as const, label: "Security", icon: Shield },
  ];

  const Toggle = ({
    enabled,
    onToggle,
    label,
    description,
  }: {
    enabled: boolean;
    onToggle: () => void;
    label: string;
    description?: string;
  }) => (
    <div className="flex items-center justify-between py-5 border-b border-white/5 last:border-0">
      <div>
        <div className="text-sm sm:text-base font-light text-white">{label}</div>
        {description && (
          <div className="text-xs sm:text-sm text-moon-grey/50 mt-1 font-light">{description}</div>
        )}
      </div>
      <button
        onClick={onToggle}
        className={`relative w-12 h-6 transition-colors ${
          enabled ? "bg-neon-iris" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white transition-all ${
            enabled ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );

  const ActivityItem = ({ activity }: { activity: ActivityType }) => {
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
                  side === "yes" ? "text-aqua-pulse" : "text-danger-400"
                }`}
              >
                {tradeType === "buy" ? "Bought" : "Sold"}{" "}
                {formatShares(quantity)} {side?.toUpperCase()}
              </span>
              {amount > 0 && (
                <>
                  <span className="text-moon-grey/50">for</span>
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
              <span className="text-moon-grey/60">Resolved:</span>
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
        case "lp_rewards_claimed":
          return (
            <span className="flex items-center gap-1">
              <span className="text-moon-grey/60">Claimed</span>
              <span className="font-medium text-aqua-pulse">
                {formatUSDC(metadata.amount || metadata.rewards || 0)}
              </span>
            </span>
          );
        case "liquidity_added":
          return (
            <span className="flex items-center gap-1">
              <span className="text-moon-grey/60">Added liquidity</span>
            </span>
          );
        case "liquidity_removed":
          return (
            <span className="flex items-center gap-1">
              <span className="text-moon-grey/60">Removed liquidity</span>
            </span>
          );
        case "user_joined":
          return <span className="text-moon-grey/60">Joined the platform</span>;
        case "comment":
          return <span className="text-moon-grey/60">Commented on market</span>;
        default:
          return (
            <span className="text-moon-grey/60 capitalize">
              {activityType.replace(/_/g, " ")}
            </span>
          );
      }
    };

    const marketId = activity.market_id || metadata.market_id;
    const marketQuestion = activity.market_question || metadata.market_question;

    return (
      <motion.div
        className="flex items-start gap-3 p-4 sm:p-5 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300"
        variants={fadeInUp}
      >
        {activity.username && (
          <UserAvatar
            name={activity.username}
            imageUrl={activity.avatar_url}
            size="md"
          />
        )}

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="text-xs sm:text-sm leading-relaxed flex flex-wrap items-center gap-x-1">
                {activity.username && (
                  <span className="font-medium text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                    @{activity.username}
                  </span>
                )}
                <span className="min-w-0 break-words font-light">
                  {getActivityDescription()}
                </span>
              </div>

              {marketId && marketQuestion && (
                <Link
                  to={`/market/${marketId}`}
                  className="text-neon-iris/80 hover:text-neon-iris text-xs sm:text-sm font-light line-clamp-2 sm:line-clamp-1 mt-2 transition-colors block break-words"
                >
                  {marketQuestion}
                </Link>
              )}
            </div>

            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-moon-grey/40 flex-shrink-0 whitespace-nowrap ml-1">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span className="hidden sm:inline">
                {formatDistanceToNow(
                  new Date(activity.created_at).getTime() / 1000
                )}
              </span>
              <span className="sm:hidden">
                {
                  formatDistanceToNow(
                    new Date(activity.created_at).getTime() / 1000
                  ).split(" ")[0]
                }
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const activityFilters = [
    { id: "all", label: "All", icon: TrendingUp },
    { id: "trade", label: "Trades", icon: BarChart3 },
    { id: "deposit", label: "Deposits", icon: Wallet },
    { id: "withdrawal", label: "Withdrawals", icon: ArrowDownToLine },
  ];

  return (
    <div className="min-h-screen bg-ink-black overflow-hidden pb-20 md:pb-8">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(33,246,210,0.06),transparent_50%)]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02] hidden sm:block"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Gradient line accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/20 to-transparent" />

      <div className="relative z-10 section-container py-12 sm:py-16 lg:py-20">
        {/* Header */}
        <motion.div
          className="mb-8 sm:mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-neon-iris/80 font-medium mb-4">
            Account
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-tight text-white">
            Settings
          </h1>
        </motion.div>

        {/* Save Message */}
        {saveMessage && (
          <motion.div
            className="mb-6 px-5 py-4 bg-aqua-pulse/10 border border-aqua-pulse/20 text-aqua-pulse text-sm font-light"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {saveMessage}
          </motion.div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
          {/* Sidebar */}
          <motion.div
            className="lg:w-64 flex-shrink-0"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <nav className="flex flex-row lg:flex-col gap-2 lg:gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 text-left transition-all duration-300 whitespace-nowrap flex-shrink-0 lg:w-full ${
                      activeTab === tab.id
                        ? "bg-white text-ink-black"
                        : "text-moon-grey/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
                    }`}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="text-xs sm:text-sm tracking-[0.05em] uppercase font-medium">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </motion.div>

          {/* Content */}
          <motion.div
            className="flex-1 min-w-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="bg-graphite-deep/40 backdrop-blur-sm border border-white/5 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-light text-white mb-6 sm:mb-8">
                  Profile Settings
                </h2>
                
                {/* Avatar Section */}
                <div className="flex items-center gap-4 sm:gap-6 mb-8 pb-8 border-b border-white/5">
                  <div className="relative flex-shrink-0">
                    {user.avatar_url || avatarPreview ? (
                      <img
                        src={avatarPreview || user.avatar_url || ""}
                        alt="Avatar"
                        className="w-20 h-20 sm:w-24 sm:h-24 object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-neon-iris to-aqua-pulse flex items-center justify-center text-white text-2xl sm:text-3xl font-light">
                        {user.display_name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                    <label
                      htmlFor="avatar-upload"
                      className={`absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer transition-opacity hover:opacity-100 ${
                        isUploadingAvatar ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {isUploadingAvatar ? (
                        <div className="text-white text-xs font-medium tracking-wide">
                          Uploading...
                        </div>
                      ) : (
                        <div className="text-white text-xs font-medium tracking-wide">
                          Change
                        </div>
                      )}
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      disabled={isUploadingAvatar}
                      className="hidden"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-xl font-light text-white truncate">
                      {user.display_name}
                    </h3>
                    <p className="text-moon-grey/60 text-sm sm:text-base font-light truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-3">
                      Profile Picture
                    </label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <label
                        htmlFor="avatar-upload-button"
                        className="px-5 py-2.5 border border-white/10 text-white text-xs tracking-[0.1em] uppercase cursor-pointer hover:bg-white/5 hover:border-white/20 transition-all"
                      >
                        {isUploadingAvatar ? "Uploading..." : "Upload Avatar"}
                      </label>
                      <input
                        id="avatar-upload-button"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={handleAvatarUpload}
                        disabled={isUploadingAvatar}
                        className="hidden"
                      />
                      <p className="text-xs text-moon-grey/40 font-light">
                        JPEG, PNG, GIF, or WebP. Max 10MB.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-3">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        setProfileError(null);
                      }}
                      className="w-full bg-white/[0.02] border border-white/10 px-4 py-3 text-white font-light focus:outline-none focus:border-neon-iris/50 transition-colors"
                      placeholder="Your display name"
                      maxLength={50}
                    />
                    <p className="text-xs text-moon-grey/40 mt-2 font-light">
                      Display names must be unique and can only be changed once every 30 days
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-3">
                      Username
                    </label>
                    <input
                      type="text"
                      value={user.username}
                      className="w-full bg-white/[0.02] border border-white/5 px-4 py-3 text-moon-grey/40 font-light cursor-not-allowed"
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-moon-grey/40 mt-2 font-light">
                      Usernames cannot be changed
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-3">
                      Email
                    </label>
                    <input
                      type="email"
                      defaultValue={user.email || ""}
                      className="w-full bg-white/[0.02] border border-white/5 px-4 py-3 text-moon-grey/40 font-light cursor-not-allowed"
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-moon-grey/40 mt-2 font-light">
                      Used for notifications and account recovery
                    </p>
                  </div>

                  {profileError && (
                    <div className="p-4 bg-danger-400/10 border border-danger-400/20 text-danger-400 text-sm font-light">
                      {profileError}
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      onClick={handleSaveProfile}
                      disabled={
                        isSavingProfile ||
                        displayName.trim() === (user.display_name || "")
                      }
                      className="px-6 py-3 bg-white text-ink-black text-sm font-medium tracking-wide uppercase hover:bg-moon-grey-light transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSavingProfile ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Portfolio Tab */}
            {activeTab === "portfolio" && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <motion.div
                  className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  <PortfolioStatCard
                    label="Total Value"
                    value={formatUSDC(portfolio?.total_value || 0)}
                    index={0}
                  />
                  <PortfolioStatCard
                    label="Cash Balance"
                    value={formatUSDC(user?.wallet?.balance_usdc || 0)}
                    index={1}
                  />
                  <PortfolioStatCard
                    label="Positions"
                    value={formatUSDC(portfolio?.positions_value || 0)}
                    index={2}
                  />
                  <PortfolioStatCard
                    label="Total P&L"
                    value={`${(portfolio?.total_pnl || 0) >= 0 ? "+" : ""}${formatUSDC(portfolio?.total_pnl || 0)}`}
                    variant={(portfolio?.total_pnl || 0) >= 0 ? "success" : "danger"}
                    index={3}
                  />
                </motion.div>

                {/* Portfolio Tabs */}
                <div className="flex gap-2 border-b border-white/5 pb-2 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <button
                    onClick={() => setPortfolioTab("positions")}
                    className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 tracking-[0.1em] uppercase ${
                      portfolioTab === "positions"
                        ? "bg-white text-ink-black"
                        : "text-moon-grey/60 hover:text-white border border-white/10"
                    }`}
                  >
                    Positions ({positions.length})
                  </button>
                  <button
                    onClick={() => setPortfolioTab("liquidity")}
                    className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 tracking-[0.1em] uppercase ${
                      portfolioTab === "liquidity"
                        ? "bg-white text-ink-black"
                        : "text-moon-grey/60 hover:text-white border border-white/10"
                    }`}
                  >
                    Liquidity ({liquidityPositions.length})
                  </button>
                </div>

                {portfolioTab === "positions" && (
                  <div className="bg-graphite-deep/40 backdrop-blur-sm border border-white/5">
                    <div className="p-5 sm:p-6 border-b border-white/5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-lg font-light text-white">
                          Your Positions
                        </h2>
                        <div className="flex gap-2">
                          {(["open", "closed", "all"] as PositionFilter[]).map(
                            (filter) => (
                              <button
                                key={filter}
                                onClick={() => setPositionFilter(filter)}
                                className={`px-3 py-1.5 text-xs font-medium transition-all uppercase tracking-[0.1em] ${
                                  positionFilter === filter
                                    ? "bg-white text-ink-black"
                                    : "text-moon-grey/60 hover:text-white border border-white/10"
                                }`}
                              >
                                {filter}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6">
                      {isLoading ? (
                        <div className="space-y-3">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-24 bg-white/[0.02] border border-white/5 animate-pulse"
                            />
                          ))}
                        </div>
                      ) : positions.length === 0 ? (
                        <div className="text-center py-12 sm:py-16">
                          <div className="inline-flex items-center justify-center w-16 h-16 border border-white/10 mb-6">
                            <BarChart3 className="w-8 h-8 text-moon-grey/40" />
                          </div>
                          <p className="text-moon-grey/60 mb-6 font-light">
                            No positions yet. Start trading!
                          </p>
                          <Link
                            to="/markets"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-ink-black text-sm font-medium tracking-wide uppercase hover:bg-moon-grey-light transition-all"
                          >
                            Browse Markets
                          </Link>
                        </div>
                      ) : (
                        <motion.div
                          className="space-y-3"
                          variants={staggerContainer}
                          initial="initial"
                          animate="animate"
                        >
                          {positions.map((position) => (
                            <SettingsPositionCard key={position.id} position={position} />
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                {portfolioTab === "liquidity" && (
                  <div className="bg-graphite-deep/40 backdrop-blur-sm border border-white/5">
                    <div className="p-5 sm:p-6 border-b border-white/5">
                      <h2 className="text-lg font-light text-white">
                        Liquidity Positions
                      </h2>
                    </div>
                    <div className="p-5 sm:p-6">
                      {liquidityPositions.length === 0 ? (
                        <div className="text-center py-12 sm:py-16">
                          <div className="inline-flex items-center justify-center w-16 h-16 border border-white/10 mb-6">
                            <Droplets className="w-8 h-8 text-moon-grey/40" />
                          </div>
                          <p className="text-moon-grey/60 mb-6 font-light">
                            No liquidity positions yet
                          </p>
                          <Link
                            to="/markets"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-ink-black text-sm font-medium tracking-wide uppercase hover:bg-moon-grey-light transition-all"
                          >
                            Explore Markets
                          </Link>
                        </div>
                      ) : (
                        <motion.div
                          className="space-y-3"
                          variants={staggerContainer}
                          initial="initial"
                          animate="animate"
                        >
                          {liquidityPositions.map((position) => (
                            <SettingsLiquidityCard key={position.id} position={position} />
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === "activity" && (
              <div className="space-y-6">
                {user && (
                  <div className="flex flex-wrap gap-2 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-2 sm:pb-0">
                    {activityFilters.map((f) => {
                      const Icon = f.icon;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setActivityFilter(f.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 tracking-[0.1em] uppercase ${
                            activityFilter === f.id
                              ? "bg-white text-ink-black"
                              : "text-moon-grey/60 hover:text-white border border-white/10"
                          }`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="bg-graphite-deep/40 backdrop-blur-sm border border-white/5 p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="relative">
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full bg-aqua-pulse opacity-75" />
                        <span className="relative inline-flex h-2 w-2 bg-aqua-pulse" />
                      </span>
                    </div>
                    <h2 className="text-lg font-light text-white">
                      Recent Transactions
                    </h2>
                  </div>

                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-20 bg-white/[0.02] border border-white/5 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-12 sm:py-16">
                      <div className="inline-flex items-center justify-center w-16 h-16 border border-white/10 mb-6">
                        <ActivityIcon className="w-8 h-8 text-moon-grey/40" />
                      </div>
                      <p className="text-moon-grey/60 font-light">No activity yet</p>
                    </div>
                  ) : (
                    <motion.div
                      className="space-y-3"
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                    >
                      {activities.map((activity) => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <div className="bg-graphite-deep/40 backdrop-blur-sm border border-white/5 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-light text-white mb-6 sm:mb-8">
                  Notification Preferences
                </h2>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 bg-white/[0.02] border border-white/5 animate-pulse"
                      />
                    ))}
                  </div>
                ) : notificationPrefs ? (
                  <div>
                    <h3 className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-4">
                      Email Notifications
                    </h3>
                    <Toggle
                      enabled={notificationPrefs.email_trade_confirmations}
                      onToggle={() => handleToggle("email_trade_confirmations")}
                      label="Trade Confirmations"
                      description="Receive email when your trades are executed"
                    />
                    <Toggle
                      enabled={notificationPrefs.email_market_resolutions}
                      onToggle={() => handleToggle("email_market_resolutions")}
                      label="Market Resolutions"
                      description="Get notified when markets you traded on resolve"
                    />
                    <h3 className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mt-8 mb-4">
                      Push Notifications
                    </h3>
                    <Toggle
                      enabled={notificationPrefs.push_enabled}
                      onToggle={() => handleToggle("push_enabled")}
                      label="Enable Push Notifications"
                      description="Receive browser push notifications"
                    />
                  </div>
                ) : (
                  <p className="text-moon-grey/60 font-light">
                    Failed to load preferences. Please try again.
                  </p>
                )}
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="bg-graphite-deep/40 backdrop-blur-sm border border-white/5 p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-light text-white mb-6 sm:mb-8">
                  Security Settings
                </h2>
                
                <div className="mb-8 pb-8 border-b border-white/5">
                  <h3 className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-4">
                    Connected Wallet
                  </h3>
                  <div className="flex items-center justify-between p-4 sm:p-5 bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neon-iris/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-neon-iris" />
                      </div>
                      <div>
                        <p className="font-light text-white text-sm sm:text-base">Solana Wallet</p>
                        <p className="text-xs sm:text-sm text-moon-grey/50 font-mono">
                          {user.wallet?.publicKey?.toString().slice(0, 8)}...
                          {user.wallet?.publicKey?.toString().slice(-8)}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-aqua-pulse/10 text-aqua-pulse text-[10px] tracking-[0.1em] uppercase">
                      Connected
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/50 mb-4">
                    Active Sessions
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 sm:p-5 bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/5 flex items-center justify-center">
                          <Laptop className="w-5 h-5 sm:w-6 sm:h-6 text-moon-grey/60" />
                        </div>
                        <div>
                          <p className="font-light text-white text-sm sm:text-base">Current Session</p>
                          <p className="text-xs sm:text-sm text-moon-grey/50 font-light">
                            Chrome on macOS • Now
                          </p>
                        </div>
                      </div>
                      <span className="text-aqua-pulse text-xs sm:text-sm">Active</span>
                    </div>
                  </div>
                  <button className="mt-6 text-danger-400 hover:text-danger-400/70 text-xs sm:text-sm font-medium transition-colors tracking-wide">
                    Sign out of all other sessions
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// ===== HELPER COMPONENTS =====

const PortfolioStatCard = memo(
  ({
    label,
    value,
    variant = "default",
    index,
  }: {
    label: string;
    value: string;
    variant?: "default" | "success" | "danger";
    index: number;
  }) => {
    const valueColor =
      variant === "success"
        ? "text-aqua-pulse"
        : variant === "danger"
        ? "text-danger-400"
        : "text-white";

    return (
      <motion.div
        className="bg-graphite-deep/60 backdrop-blur-sm border border-white/5 p-4 sm:p-5"
        variants={fadeInUp}
        custom={index}
      >
        <div className="text-[10px] sm:text-xs tracking-[0.15em] uppercase text-moon-grey/50 mb-2 truncate">
          {label}
        </div>
        <div className={`text-lg sm:text-xl lg:text-2xl font-light ${valueColor} tabular-nums truncate`}>
          {value}
        </div>
      </motion.div>
    );
  }
);
PortfolioStatCard.displayName = "PortfolioStatCard";

const SettingsPositionCard = memo(({ position }: { position: Position }) => {
  const isPositivePnl = position.pnl >= 0;

  return (
    <motion.div variants={fadeInUp}>
      <Link
        to={`/market/${position.market_id}`}
        className="block p-4 sm:p-5 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
      >
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-light text-white mb-1 text-sm sm:text-base truncate group-hover:text-neon-iris transition-colors">
              {position.market_question}
            </h3>
            {position.option_label && (
              <p className="text-xs sm:text-sm text-neon-iris/70 mb-2 truncate">
                {position.option_label}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
              <span
                className={`font-medium ${
                  position.side === "yes" ? "text-aqua-pulse" : "text-danger-400"
                }`}
              >
                {position.side.toUpperCase()}
              </span>
              <span className="text-moon-grey/50 font-light">
                {formatShares(position.shares)} @ {formatProbability(position.avg_price)}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-light text-white text-sm sm:text-base tabular-nums">
              {formatUSDC(position.shares * position.current_price)}
            </div>
            <div
              className={`text-xs sm:text-sm font-medium flex items-center justify-end gap-1 ${
                isPositivePnl ? "text-aqua-pulse" : "text-danger-400"
              }`}
            >
              {isPositivePnl ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {isPositivePnl ? "+" : ""}
              {formatUSDC(position.pnl)}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
});
SettingsPositionCard.displayName = "SettingsPositionCard";

const SettingsLiquidityCard = memo(({ position }: { position: LiquidityPosition }) => {
  const isPositivePnl = position.pnl >= 0;

  return (
    <motion.div variants={fadeInUp}>
      <Link
        to={`/market/${position.market_id}`}
        className="block p-4 sm:p-5 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
      >
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-light text-white mb-1 truncate group-hover:text-neon-iris transition-colors">
              {position.market_question}
            </h3>
            <div className="flex flex-wrap items-center gap-4 text-sm text-moon-grey/50 font-light">
              <span>Provided: {formatUSDC(position.liquidity_provided)}</span>
              <span>
                Fees: <span className="text-aqua-pulse">+{formatUSDC(position.fees_earned)}</span>
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-light text-white tabular-nums">
              {formatUSDC(position.current_value)}
            </div>
            <div
              className={`text-sm font-medium flex items-center justify-end gap-1 ${
                isPositivePnl ? "text-aqua-pulse" : "text-danger-400"
              }`}
            >
              {isPositivePnl ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {isPositivePnl ? "+" : ""}
              {formatUSDC(position.pnl)}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
});
SettingsLiquidityCard.displayName = "SettingsLiquidityCard";
