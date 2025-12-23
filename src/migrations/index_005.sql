-- =====================================================
-- MIGRATION 005: Add lifetime creator fees tracking
-- =====================================================

-- Add lifetime_creator_fees_generated column to track total creator fees generated over market lifetime
ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS lifetime_creator_fees_generated BIGINT NOT NULL DEFAULT 0;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_markets_lifetime_creator_fees ON markets(lifetime_creator_fees_generated DESC);
