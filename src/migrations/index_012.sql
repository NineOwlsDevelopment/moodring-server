-- =====================================================
-- USER KEYS MIGRATION (index_012.sql)
-- =====================================================
-- This migration adds support for influencer/trader keys
-- with bonding curve pricing (friend.tech style)
-- =====================================================

-- Add keys_supply and required_keys_to_follow to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS keys_supply INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS required_keys_to_follow INT NOT NULL DEFAULT 1;

-- Initialize all existing users with 1 key (the unsellable founder key)
UPDATE users SET keys_supply = 1 WHERE keys_supply = 0;

-- Create user_keys table to track key ownership
CREATE TABLE IF NOT EXISTS user_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  UNIQUE(trader_id, holder_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_keys_trader ON user_keys(trader_id);
CREATE INDEX IF NOT EXISTS idx_user_keys_holder ON user_keys(holder_id);
CREATE INDEX IF NOT EXISTS idx_user_keys_trader_holder ON user_keys(trader_id, holder_id);

-- Create key_transactions table to track buy/sell history
CREATE TABLE IF NOT EXISTS key_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  quantity INT NOT NULL,
  price_per_key BIGINT NOT NULL, -- in micro-USDC (6 decimals)
  total_cost BIGINT NOT NULL, -- in micro-USDC (6 decimals)
  supply_before INT NOT NULL,
  supply_after INT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT 0
);

-- Create indexes for key transactions
CREATE INDEX IF NOT EXISTS idx_key_transactions_trader ON key_transactions(trader_id);
CREATE INDEX IF NOT EXISTS idx_key_transactions_buyer ON key_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_key_transactions_created ON key_transactions(created_at DESC);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- The user_keys system is now available for
-- buying/selling influencer/trader keys with bonding curve pricing.
-- =====================================================

