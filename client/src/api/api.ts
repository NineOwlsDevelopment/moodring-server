import api from "@/config/axios";
import { Market } from "@/types/market";
import { apiCache, CACHE_TTL } from "@/utils/cache";

// ============================================
// MARKETS
// ============================================
export interface FetchMarketsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sort?: string;
  order?: "asc" | "desc";
  status?: string;
  creator_type?: "platform" | "admin" | "user" | "all";
}

export interface MarketsApiResponse {
  markets: any[];
  pagination?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface MarketApiResponse {
  market: Market;
}

export const fetchMarkets = async (
  params: FetchMarketsParams = {}
): Promise<MarketsApiResponse> => {
  const cacheKey = `markets:${JSON.stringify(params)}`;

  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get<MarketsApiResponse>("/market", {
        params: {
          page: params.page ?? 1,
          limit: params.limit,
          category:
            params.category && params.category !== "all"
              ? params.category
              : undefined,
          search: params.search,
          sort: params.sort,
          order: params.order,
          status: params.status,
          creator_type:
            params.creator_type && params.creator_type !== "all"
              ? params.creator_type
              : undefined,
        },
      });
      return response.data;
    },
    CACHE_TTL.MARKETS
  );
};

export const fetchTrendingMarkets = async (
  limit?: number
): Promise<MarketsApiResponse> => {
  const cacheKey = `trendingMarkets:${limit ?? 12}`;

  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get<MarketsApiResponse>("/market/trending", {
        params: {
          limit: limit ?? 12,
        },
      });
      return response.data;
    },
    CACHE_TTL.MARKETS
  );
};

export const fetchMarket = async (id: string): Promise<MarketApiResponse> => {
  const cacheKey = `market:${id}`;

  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get<MarketApiResponse>(`/market/${id}`);
      return response.data;
    },
    CACHE_TTL.MARKET_DETAIL
  );
};

// Invalidate market cache after trade
export const invalidateMarketCache = (marketId: string) => {
  apiCache.invalidate(`market:${marketId}`);
  apiCache.invalidatePattern("markets:");
};

export const MARKETS_PAGE_SIZE = 20;

// ============================================
// NOTIFICATIONS
// ============================================
export interface Notification {
  id: string;
  type: "trade" | "market" | "resolution" | "referral" | "system";
  title: string;
  message: string;
  data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  email_trade_confirmations: boolean;
  email_market_resolutions: boolean;
  email_referral_signups: boolean;
  push_enabled: boolean;
}

export const fetchNotifications = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{ notifications: Notification[]; pagination?: any }> => {
  const response = await api.get("/notifications", { params });
  return response.data;
};

export const fetchUnreadCount = async (): Promise<{ count: number }> => {
  const response = await api.get("/notifications/unread-count");
  return response.data;
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  await api.post(`/notifications/${id}/read`);
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  await api.post("/notifications/read-all");
};

export const fetchNotificationPreferences =
  async (): Promise<NotificationPreferences> => {
    const response = await api.get("/notifications/preferences");
    return response.data;
  };

export const updateNotificationPreferences = async (
  prefs: Partial<NotificationPreferences>
): Promise<void> => {
  await api.put("/notifications/preferences", prefs);
};

// ============================================
// COMMENTS
// ============================================
export interface Comment {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  content: string;
  upvotes: number;
  downvotes: number;
  user_vote?: "up" | "down" | null;
  reply_count: number;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export const fetchMarketComments = async (
  marketId: string,
  params?: { page?: number; limit?: number; sort?: "top" | "new" }
): Promise<{ comments: Comment[]; pagination?: any }> => {
  const response = await api.get(`/comments/market/${marketId}`, { params });
  return response.data;
};

export const fetchCommentReplies = async (
  commentId: string,
  params?: { page?: number; limit?: number }
): Promise<{ replies: Comment[]; pagination?: any }> => {
  const response = await api.get(`/comments/${commentId}/replies`, { params });
  return response.data;
};

export const createComment = async (data: {
  market_id: string;
  content: string;
  parent_id?: string;
}): Promise<Comment> => {
  const response = await api.post("/comments", data);
  return response.data.comment || response.data;
};

export const updateComment = async (
  id: string,
  content: string
): Promise<Comment> => {
  const response = await api.put(`/comments/${id}`, { content });
  return response.data;
};

export const deleteComment = async (id: string): Promise<void> => {
  await api.delete(`/comments/${id}`);
};

export const voteComment = async (
  id: string,
  vote: "up" | "down" | "none"
): Promise<{ upvotes: number; downvotes: number }> => {
  const response = await api.post(`/comments/${id}/vote`, { vote });
  return response.data;
};

// ============================================
// ACTIVITY
// ============================================
export interface Activity {
  avatar_url?: string | null;
  id: string;
  type:
    | "trade"
    | "market_created"
    | "market_initialized"
    | "market_resolved"
    | "deposit"
    | "withdrawal"
    | "claim"
    | "liquidity_added"
    | "liquidity_removed"
    | "lp_rewards_claimed"
    | "comment"
    | "user_joined";
  user_id?: string;
  username?: string;
  market_id?: string;
  market_question?: string;
  metadata: any;
  created_at: string;
}

// Helper to transform backend activity to frontend format
const transformActivity = (activity: any): Activity => {
  // Parse metadata if it's a string
  let metadata = activity.metadata;
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = {};
    }
  }

  return {
    id: activity.id,
    type: activity.type || activity.activity_type || "unknown",
    user_id: activity.user_id,
    username: activity.username,
    avatar_url: activity.avatar_url || null,
    market_id:
      activity.market_id ||
      metadata?.market_id ||
      (activity.entity_type === "market" ? activity.entity_id : null),
    market_question:
      activity.market_question ||
      metadata?.market_question ||
      (activity.activity_type === "market_created" ? metadata?.question : null),
    metadata: metadata || {},
    created_at: activity.created_at,
  };
};

export const fetchActivityFeed = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{ activities: Activity[]; pagination?: any }> => {
  const response = await api.get("/activity/feed", { params });
  const activities = (response.data.activities || []).map(transformActivity);
  return { activities, pagination: response.data.pagination };
};

export const fetchMyActivity = async (params?: {
  page?: number;
  limit?: number;
  type?: string;
}): Promise<{ activities: Activity[]; pagination?: any }> => {
  const response = await api.get("/activity/my", { params });
  const activities = (response.data.activities || []).map(transformActivity);
  return { activities, pagination: response.data.pagination };
};

export const fetchMarketActivity = async (
  marketId: string,
  params?: { page?: number; limit?: number }
): Promise<{ activities: Activity[]; pagination?: any }> => {
  const response = await api.get(`/activity/market/${marketId}`, { params });
  const activities = (response.data.activities || []).map(transformActivity);
  return { activities, pagination: response.data.pagination };
};

// Referrals and Live Rooms features removed

// ============================================
// PORTFOLIO
// ============================================
export interface Position {
  id: string;
  market_id: string;
  market_question: string;
  option_id?: string;
  option_label?: string;
  side: "yes" | "no";
  shares: number;
  avg_price: number;
  current_price: number;
  pnl: number;
  pnl_percent: number;
  is_resolved: boolean;
  winning_outcome?: "yes" | "no";
}

export interface LiquidityPosition {
  id: string;
  market_id: string;
  market_question: string;
  liquidity_provided: number;
  shares: number; // LP shares (in micro-units)
  fees_earned: number;
  current_value: number;
  pnl: number;
  created_at: string;
}

export interface PortfolioSummary {
  total_value: number;
  positions_value: number;
  liquidity_value: number;
  cash_balance: number;
  total_pnl: number;
  total_pnl_percent: number;
  winning_trades: number;
  losing_trades: number;
}

export interface PnLSummary {
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  best_trade: { market: string; pnl: number } | null;
  worst_trade: { market: string; pnl: number } | null;
}

export const fetchPortfolio = async (): Promise<PortfolioSummary> => {
  const response = await api.get("/user/portfolio");
  return response.data;
};

export const fetchPositions = async (params?: {
  status?: "open" | "closed" | "all";
}): Promise<{ positions: Position[] }> => {
  const response = await api.get("/user/portfolio/positions", { params });
  return response.data;
};

export const fetchLiquidityPositions = async (): Promise<{
  positions: LiquidityPosition[];
}> => {
  const response = await api.get("/user/portfolio/liquidity");
  return response.data;
};

export const fetchPnLSummary = async (): Promise<PnLSummary> => {
  const response = await api.get("/user/portfolio/pnl");
  return response.data;
};

// ============================================
// TRADES
// ============================================
export interface Trade {
  id: string;
  market_id: string;
  market_question: string;
  option_id?: string;
  option_label?: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  shares: number;
  pricePerShare: number;
  amount: number;
  fee: number;
  created_at: string;
}

export const buyShares = async (data: {
  market: string;
  option: string;
  buyYes?: number;
  buyNo?: number;
  maxCost?: number;
  slippageBps?: number;
}): Promise<Trade> => {
  const response = await api.post("/trade/buy", data);
  // Invalidate market cache after trade
  invalidateMarketCache(data.market);
  return response.data;
};

export const sellShares = async (data: {
  market: string;
  option: string;
  sellYes?: number;
  sellNo?: number;
  minPayout?: number;
  slippageBps?: number;
}): Promise<Trade> => {
  const response = await api.post("/trade/sell", data);
  // Invalidate market cache after trade
  invalidateMarketCache(data.market);
  return response.data;
};

export const claimWinnings = async (
  market: string,
  option: string
): Promise<{ message: string; payout: number }> => {
  const response = await api.post("/trade/claim-winnings", {
    market,
    option,
  });
  // Invalidate market cache and positions after claiming
  invalidateMarketCache(market);
  return response.data;
};

export const fetchTradeHistory = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{ trades: Trade[]; pagination?: any }> => {
  const response = await api.get("/trade/history", { params });
  return response.data;
};

export const fetchMarketTrades = async (
  marketId: string,
  params?: { page?: number; limit?: number }
): Promise<{ trades: Trade[]; pagination?: any }> => {
  const response = await api.get(`/trade/market/${marketId}`, { params });
  // Transform snake_case backend fields to camelCase frontend fields
  const trades = (response.data.trades || []).map((t: any) => ({
    id: t.id,
    market_id: t.market_id,
    market_question: t.market_question,
    option_id: t.option_id,
    option_label: t.option_label,
    side: t.side,
    action: t.trade_type,
    shares: t.quantity,
    // Backend stores price_per_share in micro-USDC (e.g., 500000 = $0.50)
    // Convert to decimal (0-1 range) by dividing by 1,000,000
    pricePerShare: t.price_per_share ? t.price_per_share / 1_000_000 : 0,
    amount: t.total_cost,
    fee: t.fees_paid,
    created_at: t.created_at,
  }));
  return { trades, pagination: response.data.pagination };
};

// ============================================
// PRICE HISTORY (for charts)
// ============================================
export type TimeRange = "1H" | "24H" | "7D" | "30D" | "ALL";

export interface PriceHistoryPoint {
  timestamp: number;
  yesPrice: number;
  noPrice: number;
  volume?: number;
}

export interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const fetchPriceHistory = async (
  optionId: string,
  timeRange: TimeRange = "24H"
): Promise<{ history: PriceHistoryPoint[]; count: number }> => {
  const cacheKey = `priceHistory:${optionId}:${timeRange}`;

  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get(`/trade/price-history/${optionId}`, {
        params: { range: timeRange },
      });
      return {
        history: response.data.history || [],
        count: response.data.count || 0,
      };
    },
    CACHE_TTL.SHORT // Short cache for real-time data
  );
};

export const fetchMarketPriceHistory = async (
  marketId: string,
  timeRange: TimeRange = "24H"
): Promise<{ history: Record<string, PriceHistoryPoint[]> }> => {
  const cacheKey = `marketPriceHistory:${marketId}:${timeRange}`;

  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get(
        `/trade/price-history/market/${marketId}`,
        {
          params: { range: timeRange },
        }
      );
      return { history: response.data.history || {} };
    },
    CACHE_TTL.SHORT
  );
};

export const fetchOHLCData = async (
  optionId: string,
  interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d" = "1h",
  timeRange: TimeRange = "7D"
): Promise<{ ohlc: OHLCPoint[]; count: number }> => {
  const cacheKey = `ohlc:${optionId}:${interval}:${timeRange}`;

  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get(`/trade/ohlc/${optionId}`, {
        params: { interval, range: timeRange },
      });
      return {
        ohlc: response.data.ohlc || [],
        count: response.data.count || 0,
      };
    },
    CACHE_TTL.SHORT
  );
};

// ============================================
// ANALYTICS / LEADERBOARD
// ============================================
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  total_pnl: number;
  total_volume?: number;
  win_rate: number;
  total_trades: number;
}

export const fetchLeaderboard = async (params?: {
  metric?: "profit" | "volume";
  limit?: number;
}): Promise<{
  leaderboard: LeaderboardEntry[];
  metric: "profit" | "volume";
}> => {
  const metric = params?.metric ?? "profit";
  const limit = params?.limit ?? 100;
  const cacheKey = `leaderboard:${metric}:${limit}`;

  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get(`/analytics/leaderboard/${metric}`, {
        params: { limit },
      });
      const leaderboard =
        response.data.leaderboard?.map((entry: any) => ({
          rank: entry.rank,
          user_id: entry.user_id,
          username: entry.username,
          display_name: entry.display_name,
          total_pnl:
            entry.total_pnl ??
            entry.total_profit_loss ??
            entry.total_profit ??
            0,
          total_volume: entry.total_volume ?? 0,
          total_trades: entry.total_trades ?? 0,
          win_rate: Number(entry.win_rate ?? 0),
        })) ?? [];

      return {
        leaderboard,
        metric,
      };
    },
    CACHE_TTL.MEDIUM
  );
};

export interface PlatformStats {
  total_volume: number;
  total_markets: number;
  active_markets: number;
  total_users: number;
  total_trades: number;
}

export const fetchPlatformStats = async (): Promise<PlatformStats> => {
  const cacheKey = "platformStats";

  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get("/analytics/platform");
      const stats = response.data.stats;
      return {
        total_volume: stats.total_volume,
        total_markets: stats.total_markets,
        active_markets: stats.markets_active,
        total_users: stats.total_users,
        total_trades: stats.total_trades,
      };
    },
    CACHE_TTL.STATS
  );
};

// ============================================
// MARKET CREATION
// ============================================
export interface CreateMarketParams {
  base: string;
  marketQuestion: string;
  marketDescription: string;
  marketExpirationDate: number;
  usdcMint: string;
  isBinary: boolean;
  categoryIds?: string[];
  image: File;
  resolutionMode: string;
}

export interface CreateOptionParams {
  market: string;
  optionLabel: string;
  optionSubLabel?: string;
  image?: File;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface MarketCreationFeeResponse {
  creation_fee: number;
  creation_fee_display: number;
  currency: string;
}

export const getMarketCreationFee =
  async (): Promise<MarketCreationFeeResponse> => {
    const response = await api.get("/market/creation-fee");
    return response.data;
  };

export const createMarket = async (
  params: CreateMarketParams
): Promise<{
  market: string;
  creation_fee: number;
  creation_fee_display: number;
}> => {
  const formData = new FormData();
  formData.append("base", params.base);
  formData.append("marketQuestion", params.marketQuestion);
  formData.append("marketDescription", params.marketDescription);
  formData.append(
    "marketExpirationDate",
    params.marketExpirationDate.toString()
  );
  formData.append("usdcMint", params.usdcMint);
  formData.append("isBinary", params.isBinary.toString());
  if (params.categoryIds) {
    formData.append("categoryIds", JSON.stringify(params.categoryIds));
  }
  formData.append("image", params.image);
  formData.append("resolutionMode", params.resolutionMode);

  const response = await api.post("/market/create", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  // Invalidate markets cache
  apiCache.invalidatePattern("markets:");
  return response.data;
};

export const createOption = async (
  params: CreateOptionParams
): Promise<{ option: string }> => {
  const formData = new FormData();
  formData.append("market", params.market);
  formData.append("optionLabel", params.optionLabel);
  if (params.optionSubLabel !== undefined) {
    formData.append("optionSubLabel", params.optionSubLabel);
  }
  if (params.image) {
    formData.append("image", params.image);
  }

  const response = await api.post("/market/option/create", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export interface UpdateMarketParams {
  marketId: string;
  marketQuestion?: string;
  marketDescription?: string;
  marketExpirationDate?: number;
  categoryIds?: string[];
  image?: File;
}

export interface UpdateOptionParams {
  optionId: string;
  optionLabel?: string;
  optionSubLabel?: string | null;
  image?: File;
}

export const updateMarket = async (
  params: UpdateMarketParams
): Promise<{ market: any }> => {
  const formData = new FormData();
  if (params.marketQuestion !== undefined) {
    formData.append("marketQuestion", params.marketQuestion);
  }
  if (params.marketDescription !== undefined) {
    formData.append("marketDescription", params.marketDescription);
  }
  if (params.marketExpirationDate !== undefined) {
    formData.append(
      "marketExpirationDate",
      params.marketExpirationDate.toString()
    );
  }
  if (params.categoryIds !== undefined) {
    formData.append("categoryIds", JSON.stringify(params.categoryIds));
  }
  if (params.image) {
    formData.append("image", params.image);
  }

  const response = await api.put(`/market/${params.marketId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  // Invalidate market cache
  apiCache.invalidate(`market:${params.marketId}`);
  apiCache.invalidatePattern("markets:");
  return response.data;
};

export const updateOption = async (
  params: UpdateOptionParams
): Promise<{ option: any }> => {
  const formData = new FormData();
  if (params.optionLabel !== undefined) {
    formData.append("optionLabel", params.optionLabel);
  }
  if (params.optionSubLabel !== undefined) {
    if (params.optionSubLabel === null || params.optionSubLabel === "") {
      formData.append("optionSubLabel", "");
    } else {
      formData.append("optionSubLabel", params.optionSubLabel);
    }
  }
  if (params.image) {
    formData.append("image", params.image);
  }

  const response = await api.put(
    `/market/option/${params.optionId}`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return response.data;
};

export const deleteOption = async (
  optionId: string
): Promise<{ message: string }> => {
  const response = await api.delete(`/market/option/${optionId}`);
  return response.data;
};

export const deleteMarket = async (
  marketId: string
): Promise<{ message: string }> => {
  const response = await api.delete(`/market/${marketId}`);
  return response.data;
};

export interface InitializeMarketResponse {
  message: string;
  initial_liquidity: number;
  lp_shares: number;
  liquidity_parameter: number;
}

export const initializeMarket = async (
  market: string,
  initialLiquidity: number
): Promise<InitializeMarketResponse> => {
  const response = await api.post("/market/initialize", {
    market,
    initialLiquidity,
  });
  return response.data;
};

// ============================================
// RESOLUTION SYSTEM
// ============================================
export interface SubmitResolutionParams {
  marketId: string;
  outcome: string;
  optionId?: string; // Required: the option ID to resolve
  winningSide?: 1 | 2; // Optional: 1 = YES (wins), 2 = NO (loses). If provided, overrides resolution engine
  evidence?: any;
  signature?: string;
}

export interface SubmitResolutionResponse {
  submission: {
    id: string;
    market_id: string;
    resolver_id: string;
    outcome: string;
    evidence: any;
    submitted_at: string;
  };
  resolved?: boolean; // true if option was automatically resolved
  option?: {
    id: string;
    is_resolved: boolean;
    winning_side: number | null;
    resolved_at: string | null;
  };
  resolution_trace?: any;
}

export const submitResolution = async (
  params: SubmitResolutionParams
): Promise<SubmitResolutionResponse> => {
  const response = await api.post("/resolution/submit", params);
  apiCache.invalidate(`market:${params.marketId}`);
  return response.data;
};

export interface FinalizeResolutionParams {
  marketId: string;
}

export interface FinalizeResolutionResponse {
  resolution: {
    market_id: string;
    final_outcome: string;
    resolution_mode: string;
    resolver_summary: any;
    resolution_trace: any;
    canonical_hash: string;
    resolved_at: string;
  };
}

// DEPRECATED: Markets now auto-resolve when all options are resolved
// This function is kept for backwards compatibility but does nothing
export const finalizeResolution = async (
  _params: FinalizeResolutionParams
): Promise<FinalizeResolutionResponse> => {
  // Markets now auto-resolve when all options are resolved
  // No manual finalization needed
  throw new Error(
    "Market finalization is no longer needed. Markets auto-resolve when all options are resolved."
  );
};

export interface DisputeResolutionParams {
  marketId: string;
  optionId: string;
  reason: string;
  evidence?: any;
}

export interface DisputeResolutionResponse {
  message: string;
}

export const disputeResolution = async (
  params: DisputeResolutionParams
): Promise<DisputeResolutionResponse> => {
  const response = await api.post("/resolution/dispute", params);
  apiCache.invalidate(`market:${params.marketId}`);
  return response.data;
};

export interface GetResolutionResponse {
  market: {
    id: string;
    question: string;
    resolution_mode: string;
    bond_amount: number;
    status: string;
  };
  resolution: {
    market_id: string;
    final_outcome: string;
    resolution_mode: string;
    resolver_summary: any;
    resolution_trace: any;
    canonical_hash: string;
    resolved_at: string;
  } | null;
  submissions: Array<{
    id: string;
    resolver_id: string;
    outcome: string;
    evidence: any;
    signature: string | null;
    submitted_at: string;
  }>;
  resolvers: Array<{
    resolver_id: string;
    role: string;
    bond_committed: number;
    resolver: {
      id: string;
      name: string;
      type: string;
      bond_balance: number;
      reputation_score: number;
    };
  }>;
}

export const getResolution = async (
  marketId: string
): Promise<GetResolutionResponse> => {
  const response = await api.get(`/resolution/${marketId}`);
  return response.data;
};

export const fetchCategories = async (): Promise<{
  categories: Category[];
}> => {
  const cacheKey = "categories";

  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get("/market/categories");
      return response.data;
    },
    CACHE_TTL.CATEGORIES
  );
};

// ============================================
// MY MARKETS
// ============================================
export type MyMarketStatus =
  | "all"
  | "pending"
  | "active"
  | "resolved"
  | "expired";

export interface MyMarketsResponse {
  markets: any[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  statusCounts: {
    total: number;
    pending: number;
    active: number;
    resolved: number;
    expired: number;
  };
  currentFilter: MyMarketStatus;
}

export const fetchMyMarkets = async (params?: {
  page?: number;
  limit?: number;
  status?: MyMarketStatus;
}): Promise<MyMarketsResponse> => {
  const response = await api.get("/market/my-markets", { params });
  return response.data;
};

export const withdrawCreatorFee = async (
  market: string
): Promise<{ message: string; amount: number }> => {
  const response = await api.post("/market/withdraw-creator-fee", { market });
  // Invalidate market cache
  invalidateMarketCache(market);
  return response.data;
};

// ============================================
// WATCHLIST
// ============================================
export const addToWatchlist = async (
  marketId: string
): Promise<{ message: string; watchlist: any }> => {
  const response = await api.post(`/market/${marketId}/watchlist`);
  // Invalidate watchlist cache
  apiCache.invalidatePattern("watchlist:");
  return response.data;
};

export const removeFromWatchlist = async (
  marketId: string
): Promise<{ message: string }> => {
  const response = await api.delete(`/market/${marketId}/watchlist`);
  // Invalidate watchlist cache
  apiCache.invalidatePattern("watchlist:");
  return response.data;
};

export const getWatchlistStatus = async (
  marketId: string
): Promise<{ is_watched: boolean }> => {
  const cacheKey = `watchlist:status:${marketId}`;
  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get(`/market/${marketId}/watchlist/status`);
      return response.data;
    },
    CACHE_TTL.SHORT
  );
};

export const fetchWatchlist = async (params?: {
  page?: number;
  limit?: number;
}): Promise<MarketsApiResponse> => {
  const cacheKey = `watchlist:${JSON.stringify(params)}`;
  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get("/market/watchlist", { params });
      return response.data;
    },
    CACHE_TTL.MARKETS
  );
};

// ============================================
// LIQUIDITY PROVIDER
// ============================================
export interface ClaimLpRewardsParams {
  market: string;
  shares?: number; // Optional: claim specific amount, or all if not specified
}

export interface ClaimLpRewardsResponse {
  message: string;
  shares_burned: number;
  payout: number;
  breakdown: {
    liquidity_returned: number;
    fees_earned: number;
    original_deposit: number;
    pnl: number;
  };
  remaining_shares: number;
  burn_signature?: string | null;
}

export const claimLpRewards = async (
  params: ClaimLpRewardsParams
): Promise<ClaimLpRewardsResponse> => {
  const response = await api.post("/liquidity/claim", params);
  // Invalidate market cache and portfolio
  invalidateMarketCache(params.market);
  return response.data;
};

export interface AddLiquidityParams {
  market: string;
  amount: number; // Amount in regular USDC (will be converted to micro-USDC before sending)
}

export interface AddLiquidityResponse {
  message: string;
  shares_minted: number;
  amount_deposited: number;
  new_pool_liquidity: number;
}

export const addLiquidity = async (
  params: AddLiquidityParams
): Promise<AddLiquidityResponse> => {
  // Convert regular USDC to micro-USDC (multiply by 1,000,000)
  const amountInMicroUSDC = Math.floor(params.amount * 1_000_000);

  const response = await api.post("/liquidity/add", {
    market: params.market,
    amount: amountInMicroUSDC,
  });
  // Invalidate market cache and portfolio
  invalidateMarketCache(params.market);
  return response.data;
};

export interface RemoveLiquidityParams {
  market: string;
  shares: number; // LP shares to remove (in micro-USDC)
}

export interface RemoveLiquidityResponse {
  message: string;
  usdc_returned: number;
  fees_earned: number;
  shares_burned: number;
}

export const removeLiquidity = async (
  params: RemoveLiquidityParams
): Promise<RemoveLiquidityResponse> => {
  const response = await api.post("/liquidity/remove", {
    market: params.market,
    shares: params.shares,
  });
  // Invalidate market cache and portfolio
  invalidateMarketCache(params.market);
  return response.data;
};

// ============================================
// POSTS
// ============================================
export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  market_id: string | null;
  parent_post_id: string | null;
  created_at: string;
  updated_at: string;
  username?: string;
  display_name?: string | null;
  likes_count: number;
  comments_count: number;
  replies_count: number;
  is_liked?: boolean;
  is_following?: boolean;
  market_question?: string | null;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
}

export const getUserPosts = async (
  userId: string,
  params?: { limit?: number; offset?: number }
): Promise<{ posts: Post[] }> => {
  const response = await api.get(`/user/${userId}/posts`, { params });
  return response.data;
};

export const togglePostLike = async (
  postId: string
): Promise<{ liked: boolean; likes_count: number }> => {
  const response = await api.post(`/posts/${postId}/like`);
  return response.data;
};

export const getComments = async (
  postId: string,
  params?: { limit?: number; offset?: number }
): Promise<{ comments: PostComment[] }> => {
  const response = await api.get(`/posts/${postId}/comments`, { params });
  return response.data;
};

export const createPostComment = async (data: {
  post_id: string;
  content: string;
  parent_comment_id?: string;
}): Promise<PostComment> => {
  const response = await api.post("/posts/comments", data);
  return response.data.comment || response.data;
};

// ============================================
// USER FOLLOWS
// ============================================
export const getFollowStatus = async (
  userId: string
): Promise<{ is_following: boolean }> => {
  const response = await api.get(`/user/${userId}/follow-status`);
  return response.data;
};

export const followUser = async (userId: string): Promise<void> => {
  await api.post(`/user/${userId}/follow`);
};

export const unfollowUser = async (userId: string): Promise<void> => {
  await api.post(`/user/${userId}/unfollow`);
};

// ============================================
// USER PROFILE
// ============================================
export interface UpdateUserProfileParams {
  display_name?: string;
}

export interface UpdateUserProfileResponse {
  message: string;
  user: {
    id: string;
    email: string;
    username: string;
    display_name: string;
    created_at: string;
    updated_at: string;
    display_name_changed_at?: string;
  };
}

export const updateUserProfile = async (
  params: UpdateUserProfileParams
): Promise<UpdateUserProfileResponse> => {
  const response = await api.put("/user/me", params);
  return response.data;
};

export interface UploadAvatarParams {
  avatar: File;
}

export interface UploadAvatarResponse {
  message: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
    created_at: string;
    updated_at: string;
  };
}

export const uploadAvatar = async (
  params: UploadAvatarParams
): Promise<UploadAvatarResponse> => {
  const formData = new FormData();
  formData.append("avatar", params.avatar);

  const response = await api.post("/user/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

// ============================================
// WITHDRAWALS
// ============================================
export interface RequestWithdrawalParams {
  destination_address: string;
  amount: number; // Amount in micro-USDC (6 decimals)
}

export interface RequestWithdrawalResponse {
  message: string;
  withdrawal: {
    id: string;
    amount: number;
    token_symbol: string;
    transaction_signature: string;
    status: string;
  };
}

export const requestWithdrawal = async (
  params: RequestWithdrawalParams
): Promise<RequestWithdrawalResponse> => {
  const response = await api.post("/withdrawal/request", params);
  return response.data;
};

// Copy Trading and Social Feed features removed

// ============================================
// ADMIN API
// ============================================

// Admin Stats
export interface AdminStats {
  users: {
    total: number;
    new_24h: number;
    new_7d: number;
  };
  markets: {
    total: number;
    active: number;
    resolved: number;
    featured: number;
  };
  trades: {
    total: number;
    total_volume: number;
    trades_24h: number;
    volume_24h: number;
  };
  pending_withdrawals: number;
}

export const fetchAdminStats = async (): Promise<AdminStats> => {
  const response = await api.get("/admin/stats");
  return response.data;
};

// Admin Settings
export interface AdminSettings {
  admin_controls: {
    maintenance_mode: boolean;
    allow_user_registration: boolean;
    allow_market_creation: boolean;
    allow_trading: boolean;
    allow_withdrawals: boolean;
    allow_deposits: boolean;
  };
  trading_limits: {
    min_trade_amount: number;
    max_trade_amount: number;
    max_position_per_market: number;
    max_daily_user_volume: number;
  };
  market_controls: {
    max_markets_per_user: number;
    max_open_markets_per_user: number;
    min_market_duration_hours: number;
    max_market_duration_days: number;
    max_market_options: number;
  };
  resolution_controls: {
    auto_resolve_markets: boolean;
    resolution_oracle_enabled: boolean;
    authority_resolution_enabled: boolean;
    opinion_resolution_enabled: boolean;
  };
  liquidity_controls: {
    min_initial_liquidity: number;
  };
  risk_controls: {
    max_market_volatility_threshold: number;
    suspicious_trade_threshold: number;
    circuit_breaker_threshold: number;
  };
  dispute_controls: {
    default_dispute_period_hours: number;
    required_dispute_bond: number;
  };
  feature_flags: {
    enable_copy_trading: boolean;
    enable_social_feed: boolean;
    enable_live_rooms: boolean;
    enable_referrals: boolean;
    enable_notifications: boolean;
  };
  platform_fees: {
    lp_fee_rate: number;
    protocol_fee_rate: number;
    creator_fee_rate: number;
  };
}

export const fetchAdminSettings = async (): Promise<{
  settings: AdminSettings;
}> => {
  const response = await api.get("/admin/settings");
  return response.data;
};

export const updateAdminSettings = async (
  settings: Partial<AdminSettings>
): Promise<{ message: string; updated_fields: string[] }> => {
  const response = await api.put("/admin/settings", settings);
  return response.data;
};

// Pause Flags
export interface PauseFlags {
  pause_trading: boolean;
}

export const fetchPauseFlags = async (): Promise<{ flags: PauseFlags }> => {
  const response = await api.get("/admin/pause");
  return response.data;
};

export const updatePauseFlags = async (
  flags: Partial<PauseFlags>
): Promise<{ message: string }> => {
  const response = await api.post("/admin/pause", flags);
  return response.data;
};

// Protocol Fees
export interface ProtocolFees {
  protocol_fees: {
    lifetime_earned: number;
    current_balance: number;
    total_withdrawn: number;
  };
  other_fees: {
    creator_fees: number;
    lp_fees: number;
  };
}

export const fetchProtocolFees = async (): Promise<ProtocolFees> => {
  const response = await api.get("/admin/fees");
  return response.data;
};

export const withdrawProtocolFees = async (params?: {
  amount?: number;
}): Promise<{
  message: string;
  amount: number;
  current_balance: number;
  lifetime_earned: number;
  total_withdrawn: number;
}> => {
  const response = await api.post("/admin/fees/withdraw", params ?? {});
  return response.data;
};

// Users
export interface AdminUser {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  wallet_public_key: string | null;
  balance_sol: number;
  balance_usdc: number;
  is_admin?: boolean;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export const fetchAdminUsers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<AdminUsersResponse> => {
  const response = await api.get("/admin/users", { params });
  return response.data;
};

export const adjustUserBalance = async (
  userId: string,
  params: {
    amount: number;
    token_symbol: "SOL" | "USDC";
    reason?: string;
  }
): Promise<{
  message: string;
  new_balance: number;
  adjustment: number;
}> => {
  const response = await api.post(`/admin/user/${userId}/balance`, params);
  return response.data;
};

export const toggleUserAdmin = async (
  userId: string,
  isAdmin: boolean
): Promise<{
  message: string;
  is_admin: boolean;
}> => {
  const response = await api.post(`/admin/user/${userId}/admin`, {
    is_admin: isAdmin,
  });
  return response.data;
};

// Hot Wallet
export interface HotWalletStatus {
  status: "operational" | "not_configured" | "rpc_unavailable";
  address?: string;
  message?: string;
  balances?: {
    usdc: number;
    usdc_formatted: string;
    sol: number;
    sol_formatted: string;
  };
  liabilities?: {
    total_usdc: number;
    total_usdc_formatted: string;
    total_sol: number;
    total_wallets: number;
  };
  reserve_ratio?: {
    usdc: string;
    status: "healthy" | "warning" | "critical";
  };
}

export const fetchHotWalletStatus = async (): Promise<HotWalletStatus> => {
  const response = await api.get("/admin/hot-wallet");
  return response.data;
};

// Circle Hot Wallets
export interface CircleHotWallet {
  id: string;
  address: string;
  name?: string | null;
}

export const createCircleHotWallet = async (
  name?: string
): Promise<{
  message: string;
  wallet: CircleHotWallet;
}> => {
  const response = await api.post("/admin/circle-hot-wallet", { name });
  return response.data;
};

export const withdrawToColdStorage = async (params: {
  passcode: string;
  amount: number;
  destination_address: string;
}): Promise<{
  message: string;
  transaction_id: string;
  transaction_hash: string | null;
  amount: number;
  amount_usdc: number;
  destination_address: string;
  hot_wallet_balance_before: number;
  hot_wallet_balance_after: number;
}> => {
  const response = await api.post(
    "/admin/hot-wallet/withdraw-to-cold-storage",
    params
  );
  return response.data;
};

// Withdrawals
export interface PendingWithdrawal {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  token_symbol: string;
  destination_address: string;
  status: string;
  transaction_signature: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  email?: string;
  username?: string;
}

export const fetchPendingWithdrawals = async (): Promise<{
  withdrawals: PendingWithdrawal[];
}> => {
  const response = await api.get("/admin/withdrawals/pending");
  return response.data;
};

export const processWithdrawal = async (
  withdrawalId: string,
  params: {
    status: "completed" | "failed";
    transaction_signature?: string;
    failure_reason?: string;
  }
): Promise<{
  message: string;
  withdrawal: PendingWithdrawal;
}> => {
  const response = await api.post(
    `/admin/withdrawal/${withdrawalId}/process`,
    params
  );
  return response.data;
};

// Categories
export const fetchAdminCategories = async (): Promise<{
  categories: Category[];
}> => {
  const response = await api.get("/admin/categories");
  return response.data;
};

export const createAdminCategory = async (
  name: string
): Promise<{ message: string; category: Category }> => {
  const response = await api.post("/admin/categories", { name });
  return response.data;
};

export const deleteAdminCategory = async (
  categoryId: string
): Promise<{ message: string }> => {
  const response = await api.delete(`/admin/categories/${categoryId}`);
  return response.data;
};

// Suspicious Trades
export interface SuspiciousTrade {
  id: string;
  trade_id: string;
  user_id: string;
  market_id: string;
  risk_score: number;
  flags: string[];
  review_status: "pending" | "reviewed" | "cleared" | "flagged";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  manual_action_required: boolean | null;
  created_at: string;
}

export interface SuspiciousTradesResponse {
  suspicious_trades: SuspiciousTrade[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export const fetchSuspiciousTrades = async (params?: {
  limit?: number;
  page?: number;
}): Promise<SuspiciousTradesResponse> => {
  const response = await api.get("/admin/suspicious-trades", {
    params: params ?? {},
  });
  return response.data;
};

export const reviewSuspiciousTrade = async (
  tradeId: string,
  params: {
    review_status: "pending" | "reviewed" | "cleared" | "flagged";
    review_notes?: string;
    risk_score?: number;
    manual_action_required?: boolean;
  }
): Promise<{
  suspicious_trade: SuspiciousTrade;
  message: string;
}> => {
  const response = await api.post(
    `/admin/suspicious-trades/${tradeId}/review`,
    params
  );
  return response.data;
};

// Disputes
export interface Dispute {
  id: string;
  market_id: string;
  option_id: string;
  user_id: string;
  reason: string;
  evidence: string | null;
  resolution_fee_paid: number;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  reviewed_by: string | null;
  reviewed_at: number;
  review_notes: string | null;
  created_at: number;
  updated_at: number;
  market_question?: string;
  option_label?: string;
  user_username?: string;
  user_display_name?: string;
  reviewer_username?: string;
  reviewer_display_name?: string;
}

export interface DisputesResponse {
  disputes: Dispute[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface DisputeResponse {
  dispute: Dispute;
}

export const fetchDisputes = async (params?: {
  page?: number;
  limit?: number;
  status?: "pending" | "reviewed" | "resolved" | "dismissed";
  market_id?: string;
}): Promise<DisputesResponse> => {
  const response = await api.get("/admin/disputes", {
    params: params ?? {},
  });
  return response.data;
};

export const fetchDispute = async (
  disputeId: string
): Promise<DisputeResponse> => {
  const response = await api.get(`/admin/disputes/${disputeId}`);
  return response.data;
};

export const resolveDispute = async (
  disputeId: string,
  params: {
    status: "resolved" | "dismissed";
    review_notes?: string;
  }
): Promise<{
  dispute: Dispute;
  message: string;
}> => {
  const response = await api.post(
    `/admin/disputes/${disputeId}/resolve`,
    params
  );
  return response.data;
};

// Admin Market Management
export const toggleMarketFeatured = async (
  marketId: string,
  params: {
    is_featured?: boolean;
    featured_order?: number | null;
  }
): Promise<{
  message: string;
  market: any;
}> => {
  const response = await api.post(`/admin/market/${marketId}/feature`, params);
  apiCache.invalidate(`market:${marketId}`);
  apiCache.invalidatePattern("markets:");
  return response.data;
};

export const toggleMarketVerified = async (
  marketId: string,
  params: {
    is_verified?: boolean;
  }
): Promise<{
  message: string;
  market: any;
}> => {
  const response = await api.post(`/admin/market/${marketId}/verify`, params);
  apiCache.invalidate(`market:${marketId}`);
  apiCache.invalidatePattern("markets:");
  return response.data;
};

export const updateMarketCategories = async (
  marketId: string,
  categoryIds: string[]
): Promise<{
  message: string;
  categories: Category[];
}> => {
  const response = await api.post(`/admin/market/${marketId}/categories`, {
    category_ids: categoryIds,
  });
  apiCache.invalidate(`market:${marketId}`);
  apiCache.invalidatePattern("markets:");
  return response.data;
};
