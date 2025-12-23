-- =====================================================
-- MIGRATION 003: Add transaction_id to withdrawals table
-- =====================================================

-- Add transaction_id column to store Circle's transaction ID
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);
