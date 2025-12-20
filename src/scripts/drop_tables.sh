#!/bin/bash
source ../.env

echo "Dropping all database tables..."

# Drop tables in reverse dependency order, using CASCADE to handle foreign keys
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF

-- =====================================================
-- DROP MOODRING TABLES
-- =====================================================
DROP TABLE IF EXISTS moodring CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS wallet_deposits CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS market_category_links CASCADE;
DROP TABLE IF EXISTS market_options CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS market_categories CASCADE;
DROP TABLE IF EXISTS moodring_admins CASCADE;

-- =====================================================
-- DROP VIEWS
-- =====================================================
DROP VIEW IF EXISTS active_live_rooms_view CASCADE;

-- =====================================================
-- DROP TRIGGERS
-- =====================================================
DROP TRIGGER IF EXISTS trigger_live_room_updated ON live_rooms;

-- =====================================================
-- DROP FUNCTIONS
-- =====================================================
DROP FUNCTION IF EXISTS update_live_room_timestamp CASCADE;

-- =====================================================
-- DROP LIVE ROOM TABLES
-- =====================================================
DROP TABLE IF EXISTS live_room_messages CASCADE;
DROP TABLE IF EXISTS live_room_participants CASCADE;
DROP TABLE IF EXISTS live_rooms CASCADE;

-- =====================================================
-- DROP ADMIN & PLATFORM TABLES
-- =====================================================
DROP TABLE IF EXISTS admin_actions CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS platform_stats CASCADE;
DROP TABLE IF EXISTS creator_stats CASCADE;
DROP TABLE IF EXISTS balance_adjustment_requests CASCADE;

-- =====================================================
-- DROP REFERRAL TABLES
-- =====================================================
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS referral_codes CASCADE;

-- =====================================================
-- DROP COMMENT TABLES
-- =====================================================
DROP TABLE IF EXISTS comment_votes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;

-- =====================================================
-- DROP USER STATISTICS & NOTIFICATIONS
-- =====================================================
DROP TABLE IF EXISTS user_stats CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS daily_volume_tracking CASCADE;

-- =====================================================
-- DROP POSITION TABLES
-- =====================================================
DROP TABLE IF EXISTS user_positions CASCADE;
DROP TABLE IF EXISTS lp_positions CASCADE;

-- =====================================================
-- DROP LIQUIDITY MONITORING TABLES
-- =====================================================
DROP TABLE IF EXISTS liquidity_alerts CASCADE;

-- =====================================================
-- DROP TRADE & WITHDRAWAL TABLES
-- =====================================================
DROP TABLE IF EXISTS suspicious_trades CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS withdrawals CASCADE;
DROP TABLE IF EXISTS copy_trade_queue CASCADE;

-- =====================================================
-- DROP WALLET TABLES
-- =====================================================
DROP TABLE IF EXISTS wallet_sweeps CASCADE;
DROP TABLE IF EXISTS wallet_deposits CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;

-- =====================================================
-- DROP AUTHENTICATION TABLES
-- =====================================================
DROP TABLE IF EXISTS jwt_revoked_tokens CASCADE;
DROP TABLE IF EXISTS magic_links CASCADE;

-- =====================================================
-- DROP TRANSACTION TABLE
-- =====================================================
DROP TABLE IF EXISTS transactions CASCADE;

-- =====================================================
-- DROP MARKET TABLES
-- =====================================================
DROP TABLE IF EXISTS market_category_links CASCADE;
DROP TABLE IF EXISTS market_options CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS market_categories CASCADE;

-- =====================================================
-- DROP RESOLUTION SYSTEM TABLES
-- =====================================================
DROP TABLE IF EXISTS market_resolutions CASCADE;
DROP TABLE IF EXISTS resolution_submissions CASCADE;
DROP TABLE IF EXISTS resolution_time_locks CASCADE;

-- =====================================================
-- DROP WATCHLIST TABLE
-- =====================================================
DROP TABLE IF EXISTS watchlist CASCADE;

-- =====================================================
-- DROP PRICE SNAPSHOT TABLES
-- =====================================================
DROP TABLE IF EXISTS price_ohlc CASCADE;
DROP TABLE IF EXISTS price_snapshots CASCADE;

-- =====================================================
-- DROP SOCIAL/TRADER TABLES
-- =====================================================
DROP TABLE IF EXISTS user_follows CASCADE;
DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS copied_trades CASCADE;
DROP TABLE IF EXISTS trader_follows CASCADE;

-- =====================================================
-- DROP WALLET AUTH TABLES
-- =====================================================
DROP TABLE IF EXISTS otp_attempts CASCADE;
DROP TABLE IF EXISTS wallet_auth_nonces CASCADE;
DROP TABLE IF EXISTS user_device_fingerprints CASCADE;

-- =====================================================
-- DROP CORE TABLES
-- =====================================================
DROP TABLE IF EXISTS moodring CASCADE;
DROP TABLE IF EXISTS users CASCADE;

EOF

echo "All tables dropped successfully!"
