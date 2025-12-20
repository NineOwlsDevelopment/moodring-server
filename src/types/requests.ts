import { Request } from "express";
import { ActivityType } from "../models/Activity";
import { ResolutionMode } from "../models/Resolution";

/**
 * Base UserRequest interface that extends Express Request
 * Used for authenticated routes
 */
export interface UserRequest extends Request {
  id: string;
}

/**
 * Typed request interfaces for Activity Controller
 */
export interface GetActivityFeedRequest extends Request {
  query: {
    page?: string;
    limit?: string;
  };
}

export interface GetUserActivityRequest extends Request {
  params: {
    userId: string;
  };
  query: {
    page?: string;
    limit?: string;
  };
}

export interface GetMarketActivityRequest extends Request {
  params: {
    id: string;
  };
  query: {
    page?: string;
    limit?: string;
  };
}

export interface GetActivitiesByTypeRequest extends Request {
  params: {
    type: ActivityType;
  };
  query: {
    page?: string;
    limit?: string;
  };
}

export interface GetMyActivityRequest extends UserRequest {
  query: {
    page?: string;
    limit?: string;
    type?: string;
  };
}

/**
 * Typed request interfaces for Auth Controller
 */
export interface RequestMagicLinkRequest extends Request {
  body: {
    email: string;
  };
}

export interface VerifyMagicLinkRequest extends Request {
  body: {
    email: string;
    otp: string;
  };
}

export interface GenerateWalletNonceRequest extends Request {
  body: {
    wallet_address: string;
  };
}

export interface AuthenticateWithWalletRequest extends Request {
  body: {
    wallet_address: string;
    signature: string;
    message: string;
    nonce: string;
  };
}

export interface RefreshAccessTokenRequest extends Request {
  cookies: {
    refreshToken?: string;
  };
}

export interface GetCurrentUserRequest extends UserRequest {}

export interface LogoutRequest extends UserRequest {
  cookies: {
    accessToken?: string;
    refreshToken?: string;
  };
}

/**
 * Typed request interfaces for Market Controller
 */
export interface CreateMarketRequest extends UserRequest {
  body: {
    marketQuestion: string;
    marketDescription?: string;
    marketExpirationDate: string;
    isBinary: boolean;
    designatedResolver?: string;
    categoryIds?: string[];
    resolutionMode?: ResolutionMode;
  };
  file?: Express.Multer.File;
}

export interface CreateOptionRequest extends UserRequest {
  body: {
    market: string;
    optionLabel: string;
    description?: string;
  };
  file?: Express.Multer.File;
}

export interface GetMarketsRequest extends Request {
  query: {
    status?: string;
    category?: string;
    search?: string;
    sort?: string;
    order?: "asc" | "desc";
    page?: string;
    limit?: string;
    creator?: string;
    featured?: string;
  };
}

export interface GetFeaturedMarketsRequest extends Request {
  query: {
    limit?: string;
  };
}

export interface GetTrendingMarketsRequest extends Request {
  query: {
    limit?: string;
    timeframe?: string;
  };
}

export interface GetMyMarketsRequest extends UserRequest {
  query: {
    status?: string;
    page?: string;
    limit?: string;
  };
}

export interface GetMarketRequest extends Request {
  params: {
    id: string;
  };
}

export interface InitializeMarketRequest extends UserRequest {
  body: {
    market: string;
    initialLiquidity?: number;
  };
}

export interface ResolveMarketRequest extends UserRequest {
  body: {
    market: string;
    option: string;
    winningSide: string;
    reason?: string;
  };
}

export interface WithdrawCreatorFeeRequest extends UserRequest {
  body: {
    market: string;
  };
}

export interface GetFairValueRequest extends Request {
  params: {
    option: string;
  };
}

export interface EstimateBuyCostRequest extends Request {
  body: {
    option: string;
    buyYes?: number;
    buyNo?: number;
  };
}

export interface EstimateSellPayoutRequest extends Request {
  body: {
    option: string;
    sellYes?: number;
    sellNo?: number;
  };
}

export interface AddToWatchlistRequest extends UserRequest {
  params: {
    id: string;
  };
}

export interface RemoveFromWatchlistRequest extends UserRequest {
  params: {
    id: string;
  };
}

export interface GetWatchlistRequest extends UserRequest {
  query: {
    page?: string;
    limit?: string;
  };
}

export interface GetWatchlistStatusRequest extends UserRequest {
  params: {
    id: string;
  };
}

/**
 * Typed request interfaces for Trade Controller
 */
export interface BuySharesRequest extends UserRequest {
  body: {
    market: string;
    option: string;
    buyYes?: number;
    buyNo?: number;
    maxCost?: number;
    slippageBps?: number;
  };
}

export interface SellSharesRequest extends UserRequest {
  body: {
    market: string;
    option: string;
    sellYes?: number;
    sellNo?: number;
    minPayout?: number;
    slippageBps?: number;
  };
}

export interface ClaimWinningsRequest extends UserRequest {
  body: {
    market: string;
    option?: string;
  };
}

export interface GetPositionRequest extends UserRequest {
  params: {
    option: string;
  };
}

export interface GetAllPositionsRequest extends UserRequest {
  query: {
    market?: string;
    page?: string;
    limit?: string;
  };
}

export interface GetTradeHistoryRequest extends UserRequest {
  query: {
    market?: string;
    option?: string;
    page?: string;
    limit?: string;
  };
}

export interface GetRecentTradesRequest extends Request {
  query: {
    limit?: string;
  };
}

export interface GetMarketTradesRequest extends Request {
  params: {
    id: string;
  };
  query: {
    page?: string;
    limit?: string;
  };
}

export interface GetPriceHistoryRequest extends Request {
  params: {
    optionId: string;
  };
  query: {
    range?: string;
    limit?: string;
  };
}

export interface GetMarketPriceHistoryRequest extends Request {
  params: {
    marketId: string;
  };
  query: {
    range?: string;
    limit?: string;
  };
}

export interface GetOHLCDataRequest extends Request {
  params: {
    optionId: string;
  };
  query: {
    interval?: string;
    range?: string;
    limit?: string;
  };
}

/**
 * Typed request interfaces for Liquidity Controller
 */
export interface AddLiquidityRequest extends UserRequest {
  body: {
    market: string;
    amount: number;
  };
}

export interface RemoveLiquidityRequest extends UserRequest {
  body: {
    market: string;
    shares?: number;
  };
}

export interface GetLpPositionRequest extends UserRequest {
  params: {
    market: string;
  };
}

export interface CalculateLpShareValueRequest extends Request {
  params: {
    market: string;
  };
}

export interface GetAllLpPositionsRequest extends UserRequest {
  query: {
    page?: string;
    limit?: string;
  };
}

export interface ClaimLpRewardsRequest extends UserRequest {
  body: {
    market: string;
    shares?: number;
  };
}

export interface GetLpTokenBalanceRequest extends UserRequest {
  params: {
    market: string;
  };
}

/**
 * Typed request interfaces for Withdrawal Controller
 */
export interface RequestWithdrawalRequest extends UserRequest {
  body: {
    destination_address: string;
    amount: number;
    // Note: idempotency_key is generated server-side for security
    // Client-provided keys are not accepted to prevent manipulation
  };
}

export interface CancelWithdrawalRequest extends UserRequest {
  params: {
    id: string;
  };
}

export interface GetWithdrawalHistoryRequest extends UserRequest {
  query: {
    page?: string;
    limit?: string;
    status?: string;
  };
}

export interface GetWithdrawalRequest extends UserRequest {
  params: {
    id: string;
  };
}

export interface GetWithdrawalTotalsRequest extends UserRequest {}

/**
 * Typed request interfaces for Comment Controller
 */
export interface CreateCommentRequest extends UserRequest {
  body: {
    market_id: string;
    content: string;
    parent_id?: string;
  };
}

export interface GetMarketCommentsRequest extends UserRequest {
  params: {
    id: string;
  };
  query: {
    page?: string;
    limit?: string;
    sort?: string;
  };
}

export interface GetCommentRepliesRequest extends UserRequest {
  params: {
    id: string;
  };
  query: {
    page?: string;
    limit?: string;
  };
}

export interface UpdateCommentRequest extends UserRequest {
  params: {
    id: string;
  };
  body: {
    content: string;
  };
}

export interface DeleteCommentRequest extends UserRequest {
  params: {
    id: string;
  };
}

export interface VoteCommentRequest extends UserRequest {
  params: {
    id: string;
  };
  body: {
    vote?: "up" | "down" | "none" | null;
    vote_type?: "up" | "down" | "none" | null;
  };
}

/**
 * Typed request interfaces for Notification Controller
 */
export interface GetNotificationsRequest extends UserRequest {
  query: {
    page?: string;
    limit?: string;
    unread_only?: string;
    unread?: string;
  };
}

export interface GetUnreadCountRequest extends UserRequest {}

export interface MarkAsReadRequest extends UserRequest {
  params: {
    id: string;
  };
}

export interface MarkAllAsReadRequest extends UserRequest {}

export interface GetPreferencesRequest extends UserRequest {}

export interface UpdatePreferencesRequest extends UserRequest {
  body: {
    email_notifications?: boolean;
    push_notifications?: boolean;
    trade_notifications?: boolean;
    comment_notifications?: boolean;
    market_notifications?: boolean;
    email_market_resolved?: boolean;
    email_market_expiring?: boolean;
    email_trade_executed?: boolean;
    email_comment_reply?: boolean;
    push_enabled?: boolean;
  };
}

/**
 * Typed request interfaces for User Controller
 */
export interface GetPublicUserByIdRequest extends Request {
  params: {
    id: string;
  };
}

export interface GetUserProfileRequest extends Request {
  params: {
    id: string;
  };
}

export interface UpdateCurrentUserRequest extends UserRequest {
  body: {
    username?: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
  };
}

export interface UploadAvatarRequest extends UserRequest {
  file?: Express.Multer.File;
}

export interface DeleteCurrentUserRequest extends UserRequest {}

export interface GenerateWalletRequest extends UserRequest {}

/**
 * Typed request interfaces for Portfolio Controller
 */
export interface GetPortfolioRequest extends UserRequest {}

export interface GetPositionsRequest extends UserRequest {
  query: {
    market?: string;
    status?: string;
    page?: string;
    limit?: string;
  };
}

export interface GetPnLSummaryRequest extends UserRequest {}

export interface GetLiquidityPositionsRequest extends UserRequest {
  query: {
    page?: string;
    limit?: string;
  };
}

/**
 * Typed request interfaces for Resolution Controller
 */
export interface SubmitResolutionRequest extends UserRequest {
  body: {
    marketId: string;
    outcome: string;
    optionId?: string; // Optional: for option-level resolution
    evidence?: string;
    signature?: string;
  };
}

export interface FinalizeResolutionRequest extends UserRequest {
  body: {
    marketId: string;
  };
}

export interface GetResolutionRequest extends Request {
  params: {
    marketId: string;
  };
}

export interface DisputeResolutionRequest extends UserRequest {
  body: {
    marketId: string;
    optionId: string;
    reason: string;
    evidence?: string;
  };
}

export interface FinalizeOptionResolutionRequest extends UserRequest {
  body: {
    marketId: string;
    optionId: string;
    winningSide?: 1 | 2; // Optional: directly specify YES (1) or NO (2), otherwise use resolution engine
  };
}

/**
 * Typed request interfaces for Analytics Controller
 */
export interface GetPlatformStatsRequest extends Request {}

export interface GetPlatformStatsHistoryRequest extends Request {
  query: {
    days?: string;
  };
}

export interface GetVolumeLeaderboardRequest extends Request {
  query: {
    timeframe?: string;
    limit?: string;
  };
}

export interface GetProfitLeaderboardRequest extends Request {
  query: {
    timeframe?: string;
    limit?: string;
  };
}

export interface GetCreatorsLeaderboardRequest extends Request {
  query: {
    timeframe?: string;
    limit?: string;
  };
}

export interface GetUserStatsRequest extends Request {
  params: {
    userId: string;
  };
}

export interface GetMarketAnalyticsRequest extends Request {
  params: {
    id: string;
  };
}

export interface GetMyStatsRequest extends UserRequest {}

export interface HealthCheckRequest extends Request {}

/**
 * Typed request interfaces for Admin Controller
 */
export interface SetPauseFlagsRequest extends Request {
  body: {
    pauseTrading?: boolean;
  };
}

export interface GetPauseFlagsRequest extends Request {}

export interface GetProtocolFeesRequest extends Request {}

export interface WithdrawProtocolFeesRequest extends UserRequest {
  body: {
    amount?: number;
    destination?: string;
  };
}

export interface CreateCategoryRequest extends Request {
  body: {
    name: string;
    description?: string;
    icon?: string;
  };
}

export interface GetCategoriesRequest extends Request {}

export interface DeleteCategoryRequest extends Request {
  params: {
    id: string;
  };
}

export interface ToggleMarketFeaturedRequest extends Request {
  params: {
    id: string;
  };
  body: {
    is_featured: boolean;
    featured_order?: number;
  };
}

export interface ToggleMarketVerifiedRequest extends Request {
  params: {
    id: string;
  };
  body: {
    is_verified: boolean;
  };
}

export interface UpdateMarketCategoriesRequest extends Request {
  params: {
    id: string;
  };
  body: {
    category_ids: string[];
  };
}

export interface ProcessWithdrawalRequest extends Request {
  params: {
    id: string;
  };
  body: {
    status: "completed" | "failed";
    transaction_signature?: string;
    failure_reason?: string;
  };
}

export interface GetPendingWithdrawalsRequest extends Request {
  query: {
    page?: string;
    limit?: string;
  };
}

export interface GetAdminStatsRequest extends Request {}

export interface GetUsersRequest extends Request {
  query: {
    page?: string;
    limit?: string;
    search?: string;
  };
}

export interface AdjustUserBalanceRequest extends UserRequest {
  params: {
    id: string;
  };
  body: {
    amount: number;
    token_symbol: "SOL" | "USDC";
    reason: string;
  };
}

export interface ToggleUserAdminRequest extends UserRequest {
  params: {
    id: string;
  };
  body: {
    is_admin: boolean;
  };
}

export interface GetHotWalletStatusRequest extends Request {}

export interface CreateCircleHotWalletRequest extends UserRequest {
  body: {
    name?: string;
  };
}

export interface GetAdminSettingsRequest extends UserRequest {}

export interface UpdateAdminSettingsRequest extends UserRequest {
  body: {
    admin_controls?: {
      maintenance_mode?: boolean;
      allow_user_registration?: boolean;
      allow_market_creation?: boolean;
      allow_trading?: boolean;
      allow_withdrawals?: boolean;
      allow_deposits?: boolean;
    };
    trading_limits?: {
      min_trade_amount?: number;
      max_trade_amount?: number;
      max_position_per_market?: number;
      max_daily_user_volume?: number;
    };
    market_controls?: {
      max_markets_per_user?: number;
      max_open_markets_per_user?: number;
      min_market_duration_hours?: number;
      max_market_duration_days?: number;
      max_market_options?: number;
    };
    resolution_controls?: {
      auto_resolve_markets?: boolean;
      resolution_oracle_enabled?: boolean;
      authority_resolution_enabled?: boolean;
      opinion_resolution_enabled?: boolean;
    };
    liquidity_controls?: {
      min_initial_liquidity?: number;
    };
    risk_controls?: {
      max_market_volatility_threshold?: number;
      suspicious_trade_threshold?: number;
      circuit_breaker_threshold?: number;
    };
    dispute_controls?: {
      default_dispute_period_hours?: number;
      required_dispute_bond?: number;
    };
    feature_flags?: {
      enable_copy_trading?: boolean;
      enable_social_feed?: boolean;
      enable_live_rooms?: boolean;
      enable_referrals?: boolean;
      enable_notifications?: boolean;
    };
    platform_fees?: {
      lp_fee_rate?: number;
      protocol_fee_rate?: number;
      creator_fee_rate?: number;
    };
  };
}

export interface GetAdminSettingsGroupRequest extends UserRequest {
  params: {
    group:
      | "admin_controls"
      | "trading_limits"
      | "market_controls"
      | "resolution_controls"
      | "liquidity_controls"
      | "risk_controls"
      | "dispute_controls"
      | "feature_flags"
      | "platform_fees";
  };
}
