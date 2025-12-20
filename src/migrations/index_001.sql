-- =====================================================
-- MIGRATION 001: Core Schema
-- =====================================================

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255),
  username VARCHAR(100) UNIQUE NOT NULL,
  avatar_url TEXT,
  display_name VARCHAR(100),
  display_name_changed_at TIMESTAMP,
  notification_preferences JSONB DEFAULT '{"email_market_resolved": true, "email_market_expiring": true, "email_trade_executed": false, "email_comment_reply": true, "push_enabled": true}'::jsonb,
  followers_count INT NOT NULL DEFAULT 0,
  following_count INT NOT NULL DEFAULT 0,
  posts_count INT NOT NULL DEFAULT 0,
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create moodring table
CREATE TABLE IF NOT EXISTS moodring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_markets INT NOT NULL DEFAULT 0,
  base_mint VARCHAR(255) NOT NULL,
  base_decimals INT NOT NULL DEFAULT 0,
  market_creation_fee INT NOT NULL DEFAULT 0,

  creator_fees_collected INT NOT NULL DEFAULT 0,
  protocol_fees_collected INT NOT NULL DEFAULT 0,

  total_value_locked INT NOT NULL DEFAULT 0,
  total_volume INT NOT NULL DEFAULT 0,

  pause_trading BOOLEAN NOT NULL DEFAULT FALSE,
  is_initialized BOOLEAN NOT NULL DEFAULT FALSE,

  lifetime_protocol_fees_earned BIGINT NOT NULL DEFAULT 0,
  current_protocol_fees_balance BIGINT NOT NULL DEFAULT 0,
  total_protocol_fees_withdrawn BIGINT NOT NULL DEFAULT 0,

  -- Admin Controls
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE, -- Platform-wide maintenance mode
  allow_user_registration BOOLEAN NOT NULL DEFAULT TRUE, -- Enable/disable new user registration
  allow_market_creation BOOLEAN NOT NULL DEFAULT TRUE, -- Enable/disable new market creation
  allow_trading BOOLEAN NOT NULL DEFAULT TRUE, -- Enable/disable all trading
  allow_withdrawals BOOLEAN NOT NULL DEFAULT TRUE, -- Enable/disable withdrawals
  allow_deposits BOOLEAN NOT NULL DEFAULT TRUE, -- Enable/disable deposits

  -- Prediction Market Trading Limits
  min_trade_amount BIGINT NOT NULL DEFAULT 1000000, -- Minimum trade amount in micro-USDC (1 USDC)
  max_trade_amount BIGINT NOT NULL DEFAULT 25000000000, -- Maximum trade amount in micro-USDC (25,000,000 USDC)
  max_position_per_market BIGINT NOT NULL DEFAULT 25000000000, -- Max position size per user per market (25,000,000 USDC)
  max_daily_user_volume BIGINT NOT NULL DEFAULT 100000000000, -- Max daily volume per user (100,000,000 USDC)

  -- Market Creation & Management Controls
  max_markets_per_user INT NOT NULL DEFAULT 10, -- Maximum markets a user can create
  max_open_markets_per_user INT NOT NULL DEFAULT 5, -- Maximum open markets per user
  min_market_duration_hours INT NOT NULL DEFAULT 24, -- Minimum market duration
  max_market_duration_days INT NOT NULL DEFAULT 365, -- Maximum market duration
  max_market_options INT NOT NULL DEFAULT 10, -- Maximum outcome options per market

  -- Market Resolution Controls
  auto_resolve_markets BOOLEAN NOT NULL DEFAULT FALSE, -- Enable automatic market resolution
  resolution_oracle_enabled BOOLEAN NOT NULL DEFAULT TRUE, -- Enable oracle-based resolution
  authority_resolution_enabled BOOLEAN NOT NULL DEFAULT TRUE, -- Enable admin authority resolution
  opinion_resolution_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- Enable community opinion resolution

  -- Liquidity & Pool Controls
  min_initial_liquidity BIGINT NOT NULL DEFAULT 100000000, -- Minimum initial liquidity (100 USDC)
  lp_fee_rate INT NOT NULL DEFAULT 100, -- 1% (100 basis points)
  protocol_fee_rate INT NOT NULL DEFAULT 50, -- 0.5% (50 basis points)
  creator_fee_rate INT NOT NULL DEFAULT 50, -- 0.5% (50 basis points)

  -- Anti-Manipulation & Risk Controls 
  max_market_volatility_threshold INT NOT NULL DEFAULT 5000, -- Max volatility threshold (basis points, 50%)
  suspicious_trade_threshold BIGINT NOT NULL DEFAULT 10000000000, -- Threshold for suspicious trades (10,000 USDC)
  circuit_breaker_threshold BIGINT NOT NULL DEFAULT 50000000000, -- Circuit breaker volume threshold (50,000 USDC)

  -- Dispute Resolution
  default_dispute_period_hours INT NOT NULL DEFAULT 2, -- Default dispute period
  required_dispute_bond BIGINT NOT NULL DEFAULT 100000000, -- Bond required for disputes (100 USDC)

  -- Social & Engagement Features
  enable_copy_trading BOOLEAN NOT NULL DEFAULT FALSE, -- Enable copy trading feature
  enable_social_feed BOOLEAN NOT NULL DEFAULT FALSE, -- Enable social feed feature
  enable_live_rooms BOOLEAN NOT NULL DEFAULT FALSE, -- Enable live rooms feature
  enable_referrals BOOLEAN NOT NULL DEFAULT FALSE, -- Enable referral system
  enable_notifications BOOLEAN NOT NULL DEFAULT TRUE, -- Enable notification system

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create moodring_admins table
CREATE TABLE IF NOT EXISTS moodring_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  balance_sol BIGINT NOT NULL DEFAULT 0,
  balance_usdc BIGINT NOT NULL DEFAULT 0,
  public_key VARCHAR(255),
  circle_wallet_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create wallet_deposits table
CREATE TABLE IF NOT EXISTS wallet_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signature VARCHAR(255) NOT NULL UNIQUE,
  slot BIGINT,
  block_time TIMESTAMP,
  amount BIGINT NOT NULL,
  token_symbol VARCHAR(32) NOT NULL DEFAULT 'SOL',
  source VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  raw JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create wallet_sweeps table (records funds swept from user wallets to hot wallet)
CREATE TABLE IF NOT EXISTS wallet_sweeps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deposit_id UUID REFERENCES wallet_deposits(id) ON DELETE SET NULL,
  source_address VARCHAR(255) NOT NULL,
  destination_address VARCHAR(255) NOT NULL,
  amount BIGINT NOT NULL,
  token_symbol VARCHAR(32) NOT NULL DEFAULT 'USDC',
  transaction_signature VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create magic_links table
CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Market Categories table
CREATE TABLE IF NOT EXISTS market_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Market table (UUID id as primary key)
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_fees_collected BIGINT NOT NULL DEFAULT 0,
  protocol_fees_collected BIGINT NOT NULL DEFAULT 0,
  question VARCHAR(255) NOT NULL,
  market_description TEXT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  expiration_timestamp BIGINT NOT NULL DEFAULT 0,
  designated_resolver VARCHAR(255),
  total_options INT NOT NULL DEFAULT 0,
  total_volume BIGINT NOT NULL DEFAULT 0,
  resolved_options INT NOT NULL DEFAULT 0,
  total_open_interest BIGINT NOT NULL DEFAULT 0,
  shared_pool_liquidity BIGINT NOT NULL DEFAULT 0,
  shared_pool_vault VARCHAR(255) NOT NULL,
  total_shared_lp_shares BIGINT NOT NULL DEFAULT 0,
  accumulated_lp_fees BIGINT NOT NULL DEFAULT 0,
  liquidity_parameter BIGINT NOT NULL DEFAULT 0,
  base_liquidity_parameter BIGINT NOT NULL DEFAULT 0,
  lp_token_mint VARCHAR(255),
  is_binary BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  is_initialized BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  featured_order INT DEFAULT NULL,
  trending_score BIGINT DEFAULT 0,
  resolution_mode TEXT CHECK (resolution_mode IN ('ORACLE', 'AUTHORITY', 'OPINION')),
  bond_amount BIGINT NOT NULL DEFAULT 0,
  status TEXT CHECK (status IN ('OPEN', 'RESOLVING', 'RESOLVED', 'DISPUTED')) DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Market-Category junction table (uses market_id UUID)
CREATE TABLE IF NOT EXISTS market_category_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES market_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(market_id, category_id)
);

-- Create Market Options table (uses market_id UUID)
CREATE TABLE IF NOT EXISTS market_options (
  id UUId PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  option_label VARCHAR(255) NOT NULL,
  option_image_url VARCHAR(255),
  yes_quantity BIGINT NOT NULL DEFAULT 0,
  no_quantity BIGINT NOT NULL DEFAULT 0,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  winning_side INT,
  resolved_at TIMESTAMP,
  resolved_reason TEXT,
  resolved_by VARCHAR(255),
  dispute_deadline TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(255) NOT NULL UNIQUE,
  transaction_type VARCHAR(255) NOT NULL,
  transaction_amount INT NOT NULL
);

-- Create jwt_revoked_tokens table for token revocation
CREATE TABLE IF NOT EXISTS jwt_revoked_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_type VARCHAR(20) NOT NULL, -- 'access' or 'refresh'
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TRADE HISTORY (uses market_id UUID)
-- =====================================================
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
  trade_type VARCHAR(20) NOT NULL, -- 'buy' or 'sell'
  side VARCHAR(10) NOT NULL, -- 'yes' or 'no'
  quantity BIGINT NOT NULL,
  price_per_share BIGINT NOT NULL, -- in USDC smallest units
  total_cost BIGINT NOT NULL, -- in USDC smallest units
  fees_paid BIGINT NOT NULL DEFAULT 0,
  transaction_signature VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SUSPICIOUS TRADES
-- =====================================================
CREATE TABLE IF NOT EXISTS suspicious_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL, -- Allow null if trade is deleted
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  option_id UUID REFERENCES market_options(id) ON DELETE SET NULL,
  trade_type VARCHAR(20) NOT NULL, -- 'buy' or 'sell'
  side VARCHAR(10), -- 'yes' or 'no' (null for circuit breaker triggers)
  quantity BIGINT,
  price_per_share BIGINT, -- in USDC smallest units
  total_amount BIGINT NOT NULL, -- in USDC smallest units (cost for buys, payout for sells)

  -- Detection reason and metadata
  detection_reason VARCHAR(50) NOT NULL, -- 'suspicious_trade_threshold', 'circuit_breaker', 'volatility_threshold'
  detection_metadata JSONB, -- Additional context (thresholds, ratios, etc.)

  -- Review status
  review_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'cleared', 'flagged'
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  -- Risk assessment
  risk_score INT DEFAULT 0, -- 0-100 scale for risk assessment
  automated_action_taken BOOLEAN DEFAULT FALSE,
  manual_action_required BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- WITHDRAWALS
-- =====================================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  destination_address VARCHAR(255) NOT NULL,
  amount BIGINT NOT NULL,
  token_symbol VARCHAR(32) NOT NULL DEFAULT 'USDC', -- 'SOL' or 'USDC'
  transaction_signature VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  failure_reason TEXT,
  idempotency_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- =====================================================
-- ACTIVITY FEED
-- =====================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL, -- 'trade', 'market_created', 'market_resolved', 'liquidity_added', 'liquidity_removed', 'comment', 'user_joined'
  entity_type VARCHAR(50), -- 'market', 'option', 'trade', 'user'
  entity_id VARCHAR(255), -- public_key or id of the entity
  metadata JSONB, -- Additional data about the activity
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'market_resolved', 'market_expiring', 'position_profit', 'position_loss', 'trade_executed', 'comment_reply', 'referral_bonus'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(50), -- 'market', 'option', 'trade', 'comment'
  entity_id VARCHAR(255),
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

-- =====================================================
-- USER STATISTICS
-- =====================================================
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_trades INT NOT NULL DEFAULT 0,
  winning_trades INT NOT NULL DEFAULT 0,
  losing_trades INT NOT NULL DEFAULT 0,
  total_volume BIGINT NOT NULL DEFAULT 0, -- in USDC smallest units
  total_profit_loss BIGINT NOT NULL DEFAULT 0, -- can be negative
  total_fees_paid BIGINT NOT NULL DEFAULT 0,
  markets_created INT NOT NULL DEFAULT 0,
  markets_participated INT NOT NULL DEFAULT 0,
  liquidity_provided BIGINT NOT NULL DEFAULT 0,
  referrals_count INT NOT NULL DEFAULT 0,
  referral_earnings BIGINT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_trade_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- COMMENTS (uses market_id UUID)
-- =====================================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For replies
  content TEXT NOT NULL,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  upvotes INT NOT NULL DEFAULT 0,
  downvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comment votes table (to track who voted)
CREATE TABLE IF NOT EXISTS comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type VARCHAR(10) NOT NULL, -- 'up' or 'down'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comment_id, user_id)
);

-- =====================================================
-- REFERRALS
-- =====================================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) UNIQUE NOT NULL,
  uses_count INT NOT NULL DEFAULT 0,
  total_earnings BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referrer_reward BIGINT NOT NULL DEFAULT 0,
  referred_reward BIGINT NOT NULL DEFAULT 0,
  is_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rewarded_at TIMESTAMP
);

-- =====================================================
-- PLATFORM ANALYTICS (Aggregated Stats)
-- =====================================================
CREATE TABLE IF NOT EXISTS platform_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  total_users INT NOT NULL DEFAULT 0,
  new_users INT NOT NULL DEFAULT 0,
  active_users INT NOT NULL DEFAULT 0, -- users with trades today
  total_markets INT NOT NULL DEFAULT 0,
  new_markets INT NOT NULL DEFAULT 0,
  total_trades INT NOT NULL DEFAULT 0,
  total_volume BIGINT NOT NULL DEFAULT 0,
  total_fees_collected BIGINT NOT NULL DEFAULT 0,
  total_liquidity BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MARKET CREATOR STATS
-- =====================================================
CREATE TABLE IF NOT EXISTS creator_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  markets_created INT NOT NULL DEFAULT 0,
  total_volume_generated BIGINT NOT NULL DEFAULT 0,
  total_fees_earned BIGINT NOT NULL DEFAULT 0,
  average_market_volume BIGINT NOT NULL DEFAULT 0,
  markets_resolved INT NOT NULL DEFAULT 0,
  markets_disputed INT NOT NULL DEFAULT 0,
  reputation_score BIGINT NOT NULL DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- LP POSITIONS (for tracking liquidity provider positions)
-- =====================================================
CREATE TABLE IF NOT EXISTS lp_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  shares BIGINT NOT NULL DEFAULT 0,
  deposited_amount BIGINT NOT NULL DEFAULT 0,
  lp_token_balance DECIMAL(20, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, market_id)
);

-- =====================================================
-- USER POSITIONS (for tracking share holdings per option)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
  yes_shares BIGINT NOT NULL DEFAULT 0,
  no_shares BIGINT NOT NULL DEFAULT 0,
  avg_yes_price BIGINT NOT NULL DEFAULT 0,
  avg_no_price BIGINT NOT NULL DEFAULT 0,
  total_yes_cost BIGINT NOT NULL DEFAULT 0,
  total_no_cost BIGINT NOT NULL DEFAULT 0,
  realized_pnl BIGINT NOT NULL DEFAULT 0,
  is_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, option_id)
);

-- =====================================================
-- PLATFORM SETTINGS (for configuration like pause flags)
-- =====================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ADMIN ACTIONS LOG (for audit trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(64) NOT NULL,
  target_user_id UUID REFERENCES users(id),
  target_market_id UUID REFERENCES markets(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- LIVE ROOMS (uses market_id UUID)
-- =====================================================
CREATE TABLE IF NOT EXISTS live_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  name VARCHAR(255) DEFAULT 'Market Live Room',
  is_active BOOLEAN DEFAULT true,
  max_participants INTEGER DEFAULT 100,
  current_participant_count INTEGER DEFAULT 0,
  allow_video BOOLEAN DEFAULT true,
  allow_screen_share BOOLEAN DEFAULT true,
  require_auth BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Live room participants
CREATE TABLE IF NOT EXISTS live_room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'listener' CHECK (role IN ('host', 'speaker', 'listener')),
  is_muted BOOLEAN DEFAULT true,
  is_video_on BOOLEAN DEFAULT false,
  is_screen_sharing BOOLEAN DEFAULT false,
  is_hand_raised BOOLEAN DEFAULT false,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP DEFAULT NULL
);

-- Live room chat messages (for text chat within the live room)
CREATE TABLE IF NOT EXISTS live_room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'emoji', 'gif', 'system')),
  reply_to_id UUID REFERENCES live_room_messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_jwt_revoked_tokens_token_hash ON jwt_revoked_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_jwt_revoked_tokens_user_id ON jwt_revoked_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_jwt_revoked_tokens_expires_at ON jwt_revoked_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);

-- Display name unique index (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name_unique 
ON users(LOWER(display_name)) 
WHERE display_name IS NOT NULL;

-- Email unique index (only when not null, allows multiple nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
ON users(email) 
WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_markets_id ON markets(id);
CREATE INDEX IF NOT EXISTS idx_markets_creator_id ON markets(creator_id);
CREATE INDEX IF NOT EXISTS idx_market_options_id ON market_options(id);
CREATE INDEX IF NOT EXISTS idx_market_options_market_id ON market_options(market_id);
CREATE INDEX IF NOT EXISTS idx_market_options_dispute_deadline 
ON market_options(dispute_deadline) 
WHERE dispute_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_deposits_wallet_id ON wallet_deposits(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_deposits_user_id ON wallet_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_deposits_status ON wallet_deposits(status);
CREATE INDEX IF NOT EXISTS idx_wallets_circle_wallet_id ON wallets(circle_wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_wallet_id ON wallet_sweeps(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_user_id ON wallet_sweeps(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_status ON wallet_sweeps(status);
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_deposit_id ON wallet_sweeps(deposit_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_created_at ON wallet_sweeps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_category_links_market_id ON market_category_links(market_id);
CREATE INDEX IF NOT EXISTS idx_market_category_links_category ON market_category_links(category_id);
CREATE INDEX IF NOT EXISTS idx_moodring_admins_user_id ON moodring_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_moodring_admins_created_at ON moodring_admins(created_at DESC);

-- Market indexes
CREATE INDEX IF NOT EXISTS idx_markets_featured ON markets(is_featured, featured_order) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_markets_trending ON markets(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_markets_volume ON markets(total_volume DESC);

-- Trade indexes
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_option_id ON trades(option_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_type ON trades(trade_type);

-- Withdrawal indexes
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_idempotency_key ON withdrawals(idempotency_key);

-- Activity indexes
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_public ON activities(is_public, created_at DESC);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- User stats indexes
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_volume ON user_stats(total_volume DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_profit ON user_stats(total_profit_loss DESC);

-- Comment indexes
CREATE INDEX IF NOT EXISTS idx_comments_market_id ON comments(market_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_votes_comment ON comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_user ON comment_votes(user_id);

-- Referral indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);

-- Platform stats indexes
CREATE INDEX IF NOT EXISTS idx_platform_stats_date ON platform_stats(stat_date DESC);

-- Creator stats indexes
CREATE INDEX IF NOT EXISTS idx_creator_stats_user ON creator_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_stats_reputation ON creator_stats(reputation_score DESC);

-- LP positions indexes
CREATE INDEX IF NOT EXISTS idx_lp_positions_user ON lp_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_lp_positions_market_id ON lp_positions(market_id);
CREATE INDEX IF NOT EXISTS idx_lp_positions_shares ON lp_positions(shares) WHERE shares > 0;
CREATE INDEX IF NOT EXISTS idx_lp_positions_token_balance ON lp_positions(lp_token_balance) WHERE lp_token_balance > 0;

-- Market LP token mint index
CREATE INDEX IF NOT EXISTS idx_markets_lp_token_mint ON markets(lp_token_mint) WHERE lp_token_mint IS NOT NULL;

-- User positions indexes
CREATE INDEX IF NOT EXISTS idx_user_positions_user ON user_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_positions_market_id ON user_positions(market_id);
CREATE INDEX IF NOT EXISTS idx_user_positions_option_id ON user_positions(option_id);
CREATE INDEX IF NOT EXISTS idx_user_positions_active ON user_positions(user_id) WHERE yes_shares > 0 OR no_shares > 0;

-- Admin actions indexes
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);

-- Live room indexes
CREATE INDEX IF NOT EXISTS idx_live_rooms_market_id ON live_rooms(market_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_active ON live_rooms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_live_room_participants_room ON live_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_live_room_participants_user ON live_room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_live_room_participants_active ON live_room_participants(room_id, left_at) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_live_room_messages_room ON live_room_messages(room_id, created_at DESC);


-- Wallet sweeps indexes
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_wallet_id ON wallet_sweeps(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_user_id ON wallet_sweeps(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_status ON wallet_sweeps(status);
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_deposit_id ON wallet_sweeps(deposit_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sweeps_created_at ON wallet_sweeps(created_at DESC);

-- Unique constraint: only one active participation per user per room
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_room_participants_unique_active 
ON live_room_participants(room_id, user_id) 
WHERE left_at IS NULL;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_live_room_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_live_room_updated ON live_rooms;
CREATE TRIGGER trigger_live_room_updated
    BEFORE UPDATE ON live_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_live_room_timestamp();

-- =====================================================
-- VIEWS
-- =====================================================

-- View for active rooms with market info
CREATE OR REPLACE VIEW active_live_rooms_view AS
SELECT 
    lr.id,
    lr.market_id,
    lr.name,
    lr.current_participant_count,
    lr.max_participants,
    lr.allow_video,
    lr.allow_screen_share,
    lr.created_at,
    m.question as market_question,
    m.image_url as market_image
FROM live_rooms lr
JOIN markets m ON lr.market_id = m.id
WHERE lr.is_active = true AND lr.current_participant_count > 0
ORDER BY lr.current_participant_count DESC;

-- =====================================================
-- ALTER TABLE STATEMENTS (Non-RLS)
-- =====================================================

-- Add referral_code_id to users (after referral_codes table exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code_id UUID REFERENCES referral_codes(id);

-- =====================================================
-- ADDITIONAL TABLES
-- =====================================================

-- =====================================================
-- PRICE SNAPSHOTS TABLE
-- =====================================================
-- This table stores time-series price data for efficient charting.
-- Snapshots are created on every trade and can be aggregated by time buckets.
CREATE TABLE IF NOT EXISTS price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  
  -- Price data (stored as decimal 0-1 representing probability)
  yes_price DECIMAL(10, 8) NOT NULL,
  no_price DECIMAL(10, 8) NOT NULL,
  
  -- Quantity state at this snapshot
  yes_quantity BIGINT NOT NULL,
  no_quantity BIGINT NOT NULL,
  
  -- Volume in this snapshot period (in micro-USDC)
  volume BIGINT NOT NULL DEFAULT 0,
  
  -- Number of trades in this snapshot
  trade_count INT NOT NULL DEFAULT 1,
  
  -- Source of this snapshot
  snapshot_type VARCHAR(20) NOT NULL DEFAULT 'trade', -- 'trade', 'periodic', 'initialization'
  
  -- Reference to the trade that triggered this snapshot (if trade-based)
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  
  -- Timestamp for time-series queries
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- OHLC AGGREGATED TABLE (for candlestick charts)
-- =====================================================
-- This table stores pre-aggregated OHLC data for different time intervals
CREATE TABLE IF NOT EXISTS price_ohlc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  
  -- Time bucket info
  interval_type VARCHAR(10) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
  bucket_start TIMESTAMP WITH TIME ZONE NOT NULL,
  bucket_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- OHLC data for YES price
  open_price DECIMAL(10, 8) NOT NULL,
  high_price DECIMAL(10, 8) NOT NULL,
  low_price DECIMAL(10, 8) NOT NULL,
  close_price DECIMAL(10, 8) NOT NULL,
  
  -- Volume and trade count in this bucket
  volume BIGINT NOT NULL DEFAULT 0,
  trade_count INT NOT NULL DEFAULT 0,
  
  -- Closing quantities
  close_yes_quantity BIGINT NOT NULL,
  close_no_quantity BIGINT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure uniqueness per option per interval per bucket
  UNIQUE(option_id, interval_type, bucket_start)
);

-- =====================================================
-- WALLET AUTH NONCES TABLE
-- =====================================================
-- Stores nonces for wallet signature verification
-- Prevents replay attacks by ensuring each nonce is used only once
CREATE TABLE IF NOT EXISTS wallet_auth_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce VARCHAR(64) NOT NULL UNIQUE,
  wallet_address VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- OTP ATTEMPT TRACKING TABLE
-- =====================================================
-- Tracks OTP verification attempts per email to prevent brute force
CREATE TABLE IF NOT EXISTS otp_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  locked_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email)
);

-- =====================================================
-- COPY TRADING
-- =====================================================

-- Table to track which users follow which traders
CREATE TABLE IF NOT EXISTS trader_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auto_copy BOOLEAN NOT NULL DEFAULT FALSE, -- Automatically copy all trades
  copy_percentage INT NOT NULL DEFAULT 100, -- Percentage of trade size to copy (1-100)
  max_trade_amount BIGINT, -- Maximum amount per copied trade (in micro-USDC, NULL = no limit)
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, trader_id)
);

-- Table to track copied trades
CREATE TABLE IF NOT EXISTS copied_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  copied_trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  copy_percentage INT NOT NULL, -- Percentage that was copied
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SOCIAL FEED
-- =====================================================

-- Table for user posts (Twitter-like feed)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT, -- Optional image attachment
  market_id UUID REFERENCES markets(id) ON DELETE SET NULL, -- Optional market reference
  parent_post_id UUID REFERENCES posts(id) ON DELETE CASCADE, -- For replies/threads
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for post likes
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

-- Table for post comments (separate from replies - for nested discussions)
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE, -- For nested replies
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for user follows (for social feed)
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id) -- Can't follow yourself
);

-- =====================================================
-- WATCHLIST FEATURE
-- =====================================================

-- Table to track user watchlists (saved/favorite markets)
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, market_id)
);

-- =====================================================
-- UNIVERSAL RESOLUTION SYSTEM
-- =====================================================

-- Create resolution_submissions table
CREATE TABLE IF NOT EXISTS resolution_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  evidence JSONB,
  signature TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create market_resolutions table
CREATE TABLE IF NOT EXISTS market_resolutions (
  market_id UUID PRIMARY KEY REFERENCES markets(id) ON DELETE CASCADE,
  final_outcome TEXT NOT NULL,
  resolution_mode TEXT NOT NULL,
  resolver_summary JSONB NOT NULL,
  resolution_trace JSONB NOT NULL,
  canonical_hash TEXT NOT NULL UNIQUE,
  resolved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SECURITY & MONITORING TABLES
-- =====================================================

-- Add shared pool liquidity monitoring table
CREATE TABLE IF NOT EXISTS liquidity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 'low_liquidity', 'insolvency_risk', 'circuit_breaker'
  current_liquidity BIGINT NOT NULL,
  required_liquidity BIGINT NOT NULL,
  reserve_ratio DECIMAL(10, 4) NOT NULL, -- Percentage (e.g., 95.5)
  severity VARCHAR(20) NOT NULL, -- 'warning', 'critical'
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add admin approval tracking for balance adjustments
CREATE TABLE IF NOT EXISTS balance_adjustment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  amount BIGINT NOT NULL,
  token_symbol VARCHAR(10) NOT NULL CHECK (token_symbol IN ('SOL', 'USDC')),
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  approvals_required INT NOT NULL DEFAULT 2,
  approvals_received INT NOT NULL DEFAULT 0,
  approved_by UUID[], -- Array of admin user IDs who approved
  expires_at TIMESTAMP NOT NULL,
  executed_at TIMESTAMP,
  executed_by UUID REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add resolution time-lock table
CREATE TABLE IF NOT EXISTS resolution_time_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
  resolved_at TIMESTAMP NOT NULL,
  unlock_at TIMESTAMP NOT NULL, -- resolved_at + time_lock_duration
  time_lock_hours INT NOT NULL DEFAULT 24, -- Default 24 hour lock
  is_locked BOOLEAN NOT NULL DEFAULT TRUE,
  unlocked_at TIMESTAMP,
  unlocked_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add copy trade queue for sequential processing
CREATE TABLE IF NOT EXISTS copy_trade_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
  trade_type VARCHAR(10) NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  side VARCHAR(10) NOT NULL CHECK (side IN ('yes', 'no')),
  original_quantity BIGINT NOT NULL,
  original_total_cost BIGINT NOT NULL,
  original_price_per_share BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rejected')),
  error_message TEXT,
  price_slippage_bps INT, -- Price change in basis points since original trade
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Prevent duplicate copy trades for same original trade + follower
  UNIQUE(original_trade_id, follower_id)
);

-- Add device fingerprinting for multi-account detection
CREATE TABLE IF NOT EXISTS user_device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint_hash VARCHAR(255) NOT NULL, -- SHA256 hash of device fingerprint
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, fingerprint_hash)
);

-- Add daily volume tracking with IP/device correlation
CREATE TABLE IF NOT EXISTS daily_volume_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint_hash VARCHAR(255),
  ip_address INET,
  date DATE NOT NULL,
  volume_usdc BIGINT NOT NULL DEFAULT 0,
  trade_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

-- =====================================================
-- ADDITIONAL INDEXES
-- =====================================================

-- Price snapshots indexes
CREATE INDEX IF NOT EXISTS idx_price_snapshots_option_id ON price_snapshots(option_id);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_market_id ON price_snapshots(market_id);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_created_at ON price_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_option_time ON price_snapshots(option_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_market_time ON price_snapshots(market_id, created_at DESC);

-- OHLC indexes for efficient time-range queries
CREATE INDEX IF NOT EXISTS idx_price_ohlc_option_interval ON price_ohlc(option_id, interval_type, bucket_start DESC);
CREATE INDEX IF NOT EXISTS idx_price_ohlc_market_interval ON price_ohlc(market_id, interval_type, bucket_start DESC);
CREATE INDEX IF NOT EXISTS idx_price_ohlc_bucket_start ON price_ohlc(bucket_start DESC);

-- Wallet auth nonces indexes
CREATE INDEX IF NOT EXISTS idx_wallet_auth_nonces_nonce ON wallet_auth_nonces(nonce);
CREATE INDEX IF NOT EXISTS idx_wallet_auth_nonces_wallet_address ON wallet_auth_nonces(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_auth_nonces_expires_at ON wallet_auth_nonces(expires_at);
CREATE INDEX IF NOT EXISTS idx_wallet_auth_nonces_created_at ON wallet_auth_nonces(created_at);

-- User positions is_claimed index
CREATE INDEX IF NOT EXISTS idx_user_positions_is_claimed ON user_positions(is_claimed) WHERE is_claimed = FALSE;

-- OTP attempts indexes
CREATE INDEX IF NOT EXISTS idx_otp_attempts_email ON otp_attempts(email);
CREATE INDEX IF NOT EXISTS idx_otp_attempts_locked_until ON otp_attempts(locked_until);

-- Copy trading indexes
CREATE INDEX IF NOT EXISTS idx_trader_follows_follower ON trader_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_trader_follows_trader ON trader_follows(trader_id);
CREATE INDEX IF NOT EXISTS idx_copied_trades_follower ON copied_trades(follower_id);
CREATE INDEX IF NOT EXISTS idx_copied_trades_trader ON copied_trades(trader_id);
CREATE INDEX IF NOT EXISTS idx_copied_trades_original ON copied_trades(original_trade_id);

-- Social feed indexes
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_market ON posts(market_id);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_not_deleted ON posts(created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created ON post_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- Watchlist indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_market ON watchlist(market_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_created ON watchlist(created_at DESC);

-- Resolution system indexes
CREATE INDEX IF NOT EXISTS idx_resolution_submissions_market ON resolution_submissions(market_id);
CREATE INDEX IF NOT EXISTS idx_resolution_submissions_user ON resolution_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_market_resolutions_hash ON market_resolutions(canonical_hash);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_resolution_mode ON markets(resolution_mode);

-- Suspicious trades indexes
CREATE INDEX IF NOT EXISTS idx_suspicious_trades_user ON suspicious_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_trades_market ON suspicious_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_trades_option ON suspicious_trades(option_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_trades_trade ON suspicious_trades(trade_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_trades_status ON suspicious_trades(review_status);
CREATE INDEX IF NOT EXISTS idx_suspicious_trades_reason ON suspicious_trades(detection_reason);
CREATE INDEX IF NOT EXISTS idx_suspicious_trades_created ON suspicious_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_trades_risk_score ON suspicious_trades(risk_score DESC);

-- Security & monitoring indexes
CREATE INDEX IF NOT EXISTS idx_liquidity_alerts_market ON liquidity_alerts(market_id);
CREATE INDEX IF NOT EXISTS idx_liquidity_alerts_unresolved ON liquidity_alerts(is_resolved) WHERE is_resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_balance_adjustment_requests_status ON balance_adjustment_requests(status);
CREATE INDEX IF NOT EXISTS idx_balance_adjustment_requests_target_user ON balance_adjustment_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_resolution_time_locks_option ON resolution_time_locks(option_id);
CREATE INDEX IF NOT EXISTS idx_resolution_time_locks_unlock_at ON resolution_time_locks(unlock_at) WHERE is_locked = TRUE;
CREATE INDEX IF NOT EXISTS idx_copy_trade_queue_status ON copy_trade_queue(status);
CREATE INDEX IF NOT EXISTS idx_copy_trade_queue_created_at ON copy_trade_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_user_device_fingerprints_hash ON user_device_fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_user_device_fingerprints_user ON user_device_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_volume_tracking_date ON daily_volume_tracking(date);
CREATE INDEX IF NOT EXISTS idx_daily_volume_tracking_fingerprint ON daily_volume_tracking(fingerprint_hash, date);

-- =====================================================
-- ADDITIONAL FUNCTIONS
-- =====================================================

-- Helper Function: Get bucket start time for a given interval
CREATE OR REPLACE FUNCTION get_bucket_start(ts TIMESTAMP WITH TIME ZONE, interval_type VARCHAR(10))
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  CASE interval_type
    WHEN '1m' THEN RETURN date_trunc('minute', ts);
    WHEN '5m' THEN RETURN date_trunc('hour', ts) + (EXTRACT(minute FROM ts)::int / 5) * INTERVAL '5 minutes';
    WHEN '15m' THEN RETURN date_trunc('hour', ts) + (EXTRACT(minute FROM ts)::int / 15) * INTERVAL '15 minutes';
    WHEN '1h' THEN RETURN date_trunc('hour', ts);
    WHEN '4h' THEN RETURN date_trunc('day', ts) + (EXTRACT(hour FROM ts)::int / 4) * INTERVAL '4 hours';
    WHEN '1d' THEN RETURN date_trunc('day', ts);
    ELSE RETURN date_trunc('hour', ts);
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper Function: Get bucket end time for a given interval
CREATE OR REPLACE FUNCTION get_bucket_end(bucket_start TIMESTAMP WITH TIME ZONE, interval_type VARCHAR(10))
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  CASE interval_type
    WHEN '1m' THEN RETURN bucket_start + INTERVAL '1 minute';
    WHEN '5m' THEN RETURN bucket_start + INTERVAL '5 minutes';
    WHEN '15m' THEN RETURN bucket_start + INTERVAL '15 minutes';
    WHEN '1h' THEN RETURN bucket_start + INTERVAL '1 hour';
    WHEN '4h' THEN RETURN bucket_start + INTERVAL '4 hours';
    WHEN '1d' THEN RETURN bucket_start + INTERVAL '1 day';
    ELSE RETURN bucket_start + INTERVAL '1 hour';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- DATA INITIALIZATION
-- =====================================================

-- Initialize current balance from existing protocol_fees_collected if any
-- This migrates existing fees to the new tracking system
UPDATE moodring
SET 
  current_protocol_fees_balance = COALESCE((
    SELECT SUM(protocol_fees_collected)::BIGINT
    FROM markets
    WHERE protocol_fees_collected > 0
  ), 0),
  lifetime_protocol_fees_earned = COALESCE((
    SELECT SUM(protocol_fees_collected)::BIGINT
    FROM markets
    WHERE protocol_fees_collected > 0
  ), 0)
WHERE id IN (SELECT id FROM moodring LIMIT 1);


-- Create partial unique index that only enforces uniqueness when email is not null
-- This allows multiple users to have null emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
ON users(email) 
WHERE email IS NOT NULL;