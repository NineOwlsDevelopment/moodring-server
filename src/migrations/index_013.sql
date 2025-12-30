-- =====================================================
-- FRACTIONAL KEYS MIGRATION (index_013.sql)
-- =====================================================
-- This migration adds support for fractional keys
-- with 6 decimal precision (matching USDC)
-- =====================================================

-- Update keys_supply to support fractional keys (6 decimals)
ALTER TABLE users 
ALTER COLUMN keys_supply TYPE NUMERIC(20, 6) USING keys_supply::NUMERIC(20, 6);

-- Update user_keys quantity to support fractional keys
ALTER TABLE user_keys
ALTER COLUMN quantity TYPE NUMERIC(20, 6) USING quantity::NUMERIC(20, 6);

-- Update key_transactions to support fractional keys
ALTER TABLE key_transactions
ALTER COLUMN quantity TYPE NUMERIC(20, 6) USING quantity::NUMERIC(20, 6),
ALTER COLUMN supply_before TYPE NUMERIC(20, 6) USING supply_before::NUMERIC(20, 6),
ALTER COLUMN supply_after TYPE NUMERIC(20, 6) USING supply_after::NUMERIC(20, 6);

-- Update required_keys_to_follow to support fractional keys
ALTER TABLE users
ALTER COLUMN required_keys_to_follow TYPE NUMERIC(20, 6) USING required_keys_to_follow::NUMERIC(20, 6);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Keys now support fractional amounts with 6 decimal precision
-- =====================================================

