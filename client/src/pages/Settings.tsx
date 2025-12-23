import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  fetchActivityFeed,
  Activity as ActivityType,
  updateUserProfile,
  uploadAvatar,
} from "@/api/api";
import {
  formatUSDC,
  formatProbability,
  formatShares,
  formatDistanceToNow,
  capitalizeWords,
} from "@/utils/format";
import { isReservedDisplayName } from "@/utils/reservedNames";
import { UserAvatar } from "@/components/UserAvatar";
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
} from "lucide-react";

type Tab = "profile" | "notifications" | "security" | "portfolio" | "activity";
type PositionFilter = "open" | "closed" | "all";

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
  const [activityTab, setActivityTab] = useState<"my" | "global">("my");
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
  }, [activeTab, activityTab, activityFilter, user]);

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
      if (activityTab === "my" && user) {
        const { activities: data } = await fetchMyActivity({
          type: activityFilter !== "all" ? activityFilter : undefined,
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
      e.target.value = ""; // Reset input
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setProfileError(
        "File size exceeds 10MB limit. Please choose a smaller image."
      );
      e.target.value = ""; // Reset input
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploadingAvatar(true);

    try {
      const response = await uploadAvatar({ avatar: file });

      // Update user store with new avatar
      const { setUser } = useUserStore.getState();
      if (setUser && response.user && user) {
        setUser({ ...user, avatar_url: response.user.avatar_url });
      }

      setSaveMessage("Avatar uploaded successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
      setAvatarPreview(null); // Clear preview after successful upload
    } catch (error: any) {
      console.error("Failed to upload avatar:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to upload avatar";
      setProfileError(errorMessage);
      setAvatarPreview(null); // Clear preview on error
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = ""; // Reset input
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 rounded-full bg-graphite-light flex items-center justify-center mb-6">
          <User className="w-10 h-10 text-moon-grey-dark" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Settings</h1>
        <p className="text-moon-grey text-center">
          Connect your wallet to access settings
        </p>
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
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
      <div>
        <div className="font-medium text-white">{label}</div>
        {description && (
          <div className="text-sm text-moon-grey mt-0.5">{description}</div>
        )}
      </div>
      <button
        onClick={onToggle}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          enabled ? "bg-neon-iris" : "bg-graphite-hover"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
            enabled ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );

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
                {tradeType === "buy" ? "Bought" : "Sold"}{" "}
                {formatShares(quantity)} {side?.toUpperCase()}
              </span>
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
              <span className="text-moon-grey">Resolved:</span>
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
        case "lp_rewards_claimed":
          return (
            <span className="flex items-center gap-1">
              <span className="text-moon-grey">Claimed</span>
              <span className="font-semibold text-brand-success">
                {formatUSDC(metadata.amount || metadata.rewards || 0)}
              </span>
            </span>
          );
        case "liquidity_added":
          return (
            <span className="flex items-center gap-1">
              <span className="text-moon-grey">Added liquidity</span>
            </span>
          );
        case "liquidity_removed":
          return (
            <span className="flex items-center gap-1">
              <span className="text-moon-grey">Removed liquidity</span>
            </span>
          );
        case "user_joined":
          return <span className="text-moon-grey">Joined the platform</span>;
        case "comment":
          return <span className="text-moon-grey">Commented on market</span>;
        default:
          return (
            <span className="text-moon-grey capitalize">
              {activityType.replace(/_/g, " ")}
            </span>
          );
      }
    };

    // Get market info from metadata or activity directly
    const marketId = activity.market_id || metadata.market_id;
    const marketQuestion = activity.market_question || metadata.market_question;

    return (
      <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-graphite-light/50 hover:bg-graphite-light transition-all duration-200">
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
              <div className="text-xs sm:text-sm leading-relaxed flex flex-wrap items-center gap-x-1">
                {activity.username && (
                  <span className="font-semibold text-white truncate max-w-[80px] sm:max-w-[100px] inline-block align-middle">
                    @{activity.username}
                  </span>
                )}
                <span className="min-w-0 break-words">
                  {getActivityDescription()}
                </span>
              </div>

              {/* Market link */}
              {marketId && marketQuestion && (
                <Link
                  to={`/market/${marketId}`}
                  className="text-neon-iris hover:text-neon-iris-light text-xs sm:text-sm font-medium line-clamp-2 sm:line-clamp-1 mt-1 transition-colors block break-words"
                >
                  {capitalizeWords(marketQuestion)}
                </Link>
              )}
            </div>

            {/* Timestamp */}
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-moon-grey-dark flex-shrink-0 whitespace-nowrap ml-1">
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
      </div>
    );
  };

  const activityFilters = [
    { id: "all", label: "All", icon: TrendingUp },
    { id: "trade", label: "Trades", icon: BarChart3 },
    { id: "deposit", label: "Deposits", icon: Wallet },
    { id: "withdrawal", label: "Withdrawals", icon: ArrowDownToLine },
  ];

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-neon-iris/5 via-transparent to-aqua-pulse/5 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6">
          Settings
        </h1>

        {/* Save Message */}
        {saveMessage && (
          <div className="mb-6 px-4 py-3 bg-brand-success/20  rounded-xl text-brand-success text-sm animate-fade-in">
            {saveMessage}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <nav className="flex flex-row lg:flex-col gap-2 lg:gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-3 sm:-mx-4 lg:mx-0 px-3 sm:px-4 lg:px-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left transition-all duration-200 min-h-[44px] sm:min-h-[48px] whitespace-nowrap flex-shrink-0 lg:w-full ${
                      activeTab === tab.id
                        ? "bg-gradient-brand text-white shadow-neon-subtle"
                        : "text-moon-grey hover:text-white hover:bg-graphite-light"
                    }`}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="font-medium text-sm sm:text-base">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="card">
                <h2 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">
                  Profile Settings
                </h2>
                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-white/5">
                  <div className="relative flex-shrink-0">
                    {user.avatar_url || avatarPreview ? (
                      <img
                        src={avatarPreview || user.avatar_url || ""}
                        alt="Avatar"
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-white/10"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-brand flex items-center justify-center text-white text-2xl sm:text-3xl font-bold">
                        {user.display_name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                    <label
                      htmlFor="avatar-upload"
                      className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center cursor-pointer transition-opacity hover:opacity-100 ${
                        isUploadingAvatar ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {isUploadingAvatar ? (
                        <div className="text-white text-xs font-medium">
                          Uploading...
                        </div>
                      ) : (
                        <div className="text-white text-xs font-medium">
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
                    <h3 className="font-semibold text-white text-base sm:text-lg truncate">
                      {user.display_name}
                    </h3>
                    <p className="text-moon-grey text-sm sm:text-base truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-moon-grey mb-2">
                      Profile Picture
                    </label>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="avatar-upload-button"
                        className="btn btn-secondary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <p className="text-xs text-moon-grey-dark">
                        JPEG, PNG, GIF, or WebP. Max 10MB. Images are moderated
                        for inappropriate content.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-moon-grey mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        setProfileError(null);
                      }}
                      className="input w-full"
                      placeholder="Your display name"
                      maxLength={50}
                    />
                    <p className="text-xs text-moon-grey-dark mt-1">
                      Display names must be unique and can only be changed once
                      every 30 days
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-moon-grey mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={user.username}
                      className="input w-full bg-graphite-light/50 cursor-not-allowed opacity-60"
                      placeholder="Your username"
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-moon-grey-dark mt-1">
                      Usernames cannot be changed
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-moon-grey mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      defaultValue={user.email || ""}
                      className="input w-full"
                      placeholder="your@email.com"
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-moon-grey-dark mt-1">
                      Used for notifications and account recovery
                    </p>
                  </div>
                  {profileError && (
                    <div className="p-3 bg-brand-danger/20 border border-brand-danger/30 rounded-xl text-brand-danger text-sm">
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
                      className="btn btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                  <div className="card bg-gradient-to-br from-graphite-deep to-ink">
                    <div className="text-xs sm:text-sm text-moon-grey mb-1 truncate">
                      Total Value
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                      {formatUSDC(portfolio?.total_value || 0)}
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-xs sm:text-sm text-moon-grey mb-1 truncate">
                      Cash Balance
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                      {formatUSDC(user?.wallet?.balance_usdc || 0)}
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-xs sm:text-sm text-moon-grey mb-1 truncate">
                      Positions Value
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                      {formatUSDC(portfolio?.positions_value || 0)}
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-xs sm:text-sm text-moon-grey mb-1 truncate">
                      Total P&L
                    </div>
                    <div
                      className={`text-lg sm:text-xl lg:text-2xl font-bold truncate ${
                        (portfolio?.total_pnl || 0) >= 0
                          ? "text-brand-success"
                          : "text-brand-danger"
                      }`}
                    >
                      {(portfolio?.total_pnl || 0) >= 0 ? "+" : ""}
                      {formatUSDC(portfolio?.total_pnl || 0)}
                    </div>
                  </div>
                </div>

                {/* Portfolio Tabs */}
                <div className="flex gap-2 border-b border-white/5 pb-2 overflow-x-auto -mx-3 sm:-mx-0 px-3 sm:px-0">
                  <button
                    onClick={() => setPortfolioTab("positions")}
                    className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all min-h-[36px] sm:min-h-[40px] whitespace-nowrap flex-shrink-0 ${
                      portfolioTab === "positions"
                        ? "bg-gradient-brand text-white"
                        : "bg-graphite-light text-moon-grey hover:text-white"
                    }`}
                  >
                    Positions ({positions.length})
                  </button>
                  <button
                    onClick={() => setPortfolioTab("liquidity")}
                    className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all min-h-[36px] sm:min-h-[40px] whitespace-nowrap flex-shrink-0 ${
                      portfolioTab === "liquidity"
                        ? "bg-gradient-brand text-white"
                        : "bg-graphite-light text-moon-grey hover:text-white"
                    }`}
                  >
                    Liquidity ({liquidityPositions.length})
                  </button>
                </div>

                {portfolioTab === "positions" && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-white">
                        Your Positions
                      </h2>
                      <div className="flex gap-2">
                        {(["open", "closed", "all"] as PositionFilter[]).map(
                          (filter) => (
                            <button
                              key={filter}
                              onClick={() => setPositionFilter(filter)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all min-h-[36px] ${
                                positionFilter === filter
                                  ? "bg-neon-iris text-white"
                                  : "bg-graphite-light text-moon-grey hover:text-white"
                              }`}
                            >
                              {filter.charAt(0).toUpperCase() + filter.slice(1)}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {isLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-24 bg-graphite-light rounded-xl skeleton-pulse"
                          />
                        ))}
                      </div>
                    ) : positions.length === 0 ? (
                      <div className="text-center py-8 sm:py-12">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-graphite-light flex items-center justify-center mx-auto mb-4">
                          <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-moon-grey-dark" />
                        </div>
                        <p className="text-moon-grey mb-4 text-sm sm:text-base">
                          No positions yet. Start trading!
                        </p>
                        <Link
                          to="/markets"
                          className="btn btn-primary text-sm sm:text-base"
                        >
                          Browse Markets
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {positions.map((position) => (
                          <Link
                            key={position.id}
                            to={`/market/${position.market_id}`}
                            className="block p-3 sm:p-4 rounded-xl bg-graphite-light/50 hover:bg-graphite-light transition-all"
                          >
                            <div className="flex items-start justify-between gap-2 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-white mb-1 text-sm sm:text-base truncate">
                                  {capitalizeWords(position.market_question)}
                                </h3>
                                {position.option_label && (
                                  <p className="text-xs sm:text-sm text-neon-iris mb-2 truncate">
                                    {capitalizeWords(position.option_label)}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                                  <span
                                    className={`font-medium ${
                                      position.side === "yes"
                                        ? "text-brand-success"
                                        : "text-brand-danger"
                                    }`}
                                  >
                                    {position.side.toUpperCase()}
                                  </span>
                                  <span className="text-moon-grey break-words">
                                    {formatShares(position.shares)} shares @{" "}
                                    {formatProbability(position.avg_price)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-semibold text-white text-sm sm:text-base">
                                  {formatUSDC(
                                    position.shares * position.current_price
                                  )}
                                </div>
                                <div
                                  className={`text-xs sm:text-sm font-medium ${
                                    position.pnl >= 0
                                      ? "text-brand-success"
                                      : "text-brand-danger"
                                  }`}
                                >
                                  {position.pnl >= 0 ? "+" : ""}
                                  {formatUSDC(position.pnl)} (
                                  {position.pnl_percent >= 0 ? "+" : ""}
                                  {position.pnl_percent.toFixed(1)}%)
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {portfolioTab === "liquidity" && (
                  <div className="card">
                    <h2 className="text-lg font-semibold text-white mb-6">
                      Liquidity Positions
                    </h2>
                    {liquidityPositions.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-graphite-light flex items-center justify-center mx-auto mb-4">
                          <Droplets className="w-8 h-8 text-moon-grey-dark" />
                        </div>
                        <p className="text-moon-grey mb-4">
                          No liquidity positions yet
                        </p>
                        <Link to="/markets" className="btn btn-primary">
                          Explore Markets
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {liquidityPositions.map((position) => (
                          <Link
                            key={position.id}
                            to={`/market/${position.market_id}`}
                            className="block p-4 rounded-xl bg-graphite-light/50 hover:bg-graphite-light transition-all "
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-white mb-1 truncate">
                                  {capitalizeWords(position.market_question)}
                                </h3>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-moon-grey">
                                  <span>
                                    Provided:{" "}
                                    {formatUSDC(position.liquidity_provided)}
                                  </span>
                                  <span>
                                    Fees:{" "}
                                    <span className="text-brand-success">
                                      +{formatUSDC(position.fees_earned)}
                                    </span>
                                  </span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-semibold text-white">
                                  {formatUSDC(position.current_value)}
                                </div>
                                <div
                                  className={`text-sm font-medium ${
                                    position.pnl >= 0
                                      ? "text-brand-success"
                                      : "text-brand-danger"
                                  }`}
                                >
                                  {position.pnl >= 0 ? "+" : ""}
                                  {formatUSDC(position.pnl)}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === "activity" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex bg-graphite-light rounded-xl p-1 ">
                    <button
                      onClick={() => setActivityTab("my")}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[40px] ${
                        activityTab === "my"
                          ? "bg-gradient-brand text-white"
                          : "text-moon-grey hover:text-white"
                      }`}
                    >
                      My Activity
                    </button>
                    <button
                      onClick={() => setActivityTab("global")}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[40px] ${
                        activityTab === "global"
                          ? "bg-gradient-brand text-white"
                          : "text-moon-grey hover:text-white"
                      }`}
                    >
                      Global Feed
                    </button>
                  </div>
                </div>

                {activityTab === "my" && (
                  <div className="flex flex-wrap gap-2 overflow-x-auto -mx-3 sm:-mx-0 px-3 sm:px-0 pb-2 sm:pb-0">
                    {activityFilters.map((f) => {
                      const Icon = f.icon;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setActivityFilter(f.id)}
                          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all min-h-[36px] sm:min-h-[40px] whitespace-nowrap flex-shrink-0 ${
                            activityFilter === f.id
                              ? "bg-gradient-brand text-white"
                              : "bg-graphite-light text-moon-grey  hover:text-white"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="card">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="relative">
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-success" />
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-white">
                      {activityTab === "my"
                        ? "Recent Transactions"
                        : "Platform Activity"}
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
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-graphite-light flex items-center justify-center mx-auto mb-4">
                        <ActivityIcon className="w-8 h-8 text-moon-grey-dark" />
                      </div>
                      <p className="text-moon-grey">No activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((activity) => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <div className="card">
                <h2 className="text-xl font-semibold text-white mb-6">
                  Notification Preferences
                </h2>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 bg-graphite-light rounded-xl skeleton-pulse"
                      />
                    ))}
                  </div>
                ) : notificationPrefs ? (
                  <div>
                    <h3 className="text-sm font-medium text-moon-grey-dark uppercase tracking-wide mb-4">
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
                    <h3 className="text-sm font-medium text-moon-grey-dark uppercase tracking-wide mt-8 mb-4">
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
                  <p className="text-moon-grey">
                    Failed to load preferences. Please try again.
                  </p>
                )}
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="card">
                <h2 className="text-xl font-semibold text-white mb-6">
                  Security Settings
                </h2>
                <div className="mb-6 pb-6 border-b border-white/5">
                  <h3 className="text-sm font-medium text-moon-grey-dark uppercase tracking-wide mb-4">
                    Connected Wallet
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-graphite-light rounded-xl ">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neon-iris/20 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-neon-iris" />
                      </div>
                      <div>
                        <p className="font-medium text-white">Solana Wallet</p>
                        <p className="text-sm text-moon-grey font-mono">
                          {user.wallet?.publicKey?.toString().slice(0, 8)}...
                          {user.wallet?.publicKey?.toString().slice(-8)}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-brand-success/20 text-brand-success text-xs rounded-full ">
                      Connected
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-moon-grey-dark uppercase tracking-wide mb-4">
                    Active Sessions
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-graphite-light rounded-xl ">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-graphite-hover flex items-center justify-center">
                          <Laptop className="w-5 h-5 text-moon-grey" />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            Current Session
                          </p>
                          <p className="text-sm text-moon-grey">
                            Chrome on macOS • Now
                          </p>
                        </div>
                      </div>
                      <span className="text-brand-success text-sm">Active</span>
                    </div>
                  </div>
                  <button className="mt-4 text-brand-danger hover:text-brand-danger/80 text-sm font-medium transition-colors">
                    Sign out of all other sessions
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
