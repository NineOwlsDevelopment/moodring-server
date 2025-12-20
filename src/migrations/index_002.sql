-- =====================================================
-- MIGRATION 002: Row Level Security (RLS)
-- =====================================================

-- Enable RLS on core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE moodring ENABLE ROW LEVEL SECURITY;
ALTER TABLE moodring_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_category_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jwt_revoked_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_sweeps ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user positions table
ALTER TABLE user_positions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on LP positions table
ALTER TABLE lp_positions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on liquidity alerts table
ALTER TABLE liquidity_alerts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on platform settings table
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on admin actions table
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on balance adjustment requests table
ALTER TABLE balance_adjustment_requests ENABLE ROW LEVEL SECURITY;

-- Enable RLS on live room tables
ALTER TABLE live_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_room_messages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on trade history table
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Enable RLS on suspicious trades table
ALTER TABLE suspicious_trades ENABLE ROW LEVEL SECURITY;

-- Enable RLS on withdrawals table
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- Enable RLS on activity feed table
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user statistics table
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Enable RLS on daily volume tracking table
ALTER TABLE daily_volume_tracking ENABLE ROW LEVEL SECURITY;

-- Enable RLS on comments table
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on comment votes table
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on referral codes table
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on referrals table
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Enable RLS on platform stats table
ALTER TABLE platform_stats ENABLE ROW LEVEL SECURITY;

-- Enable RLS on creator stats table
ALTER TABLE creator_stats ENABLE ROW LEVEL SECURITY;

-- Enable RLS on price snapshots tables
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_ohlc ENABLE ROW LEVEL SECURITY;

-- Enable RLS on wallet auth nonces table
ALTER TABLE wallet_auth_nonces ENABLE ROW LEVEL SECURITY;

-- Enable RLS on OTP attempts table
ALTER TABLE otp_attempts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on device fingerprinting table
ALTER TABLE user_device_fingerprints ENABLE ROW LEVEL SECURITY;

-- Enable RLS on copy trading tables
ALTER TABLE trader_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE copied_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_trade_queue ENABLE ROW LEVEL SECURITY;

-- Enable RLS on social feed tables
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Enable RLS on watchlist table
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Enable RLS on resolution system tables
ALTER TABLE resolution_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolution_time_locks ENABLE ROW LEVEL SECURITY;
