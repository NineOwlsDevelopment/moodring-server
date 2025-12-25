-- =====================================================
-- ADD OPTION SUB-LABELS MIGRATION (index_009.sql)
-- =====================================================
-- This migration adds support for sub-labels on market options
-- to allow additional context (e.g., "Republican", "Democratic")
-- =====================================================

-- Add option_sub_label column to market_options table
ALTER TABLE market_options 
ADD COLUMN IF NOT EXISTS option_sub_label VARCHAR(100);

-- Create index for faster queries on sub-labels (optional, but useful for filtering)
CREATE INDEX IF NOT EXISTS idx_market_options_sub_label 
ON market_options(option_sub_label) 
WHERE option_sub_label IS NOT NULL;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- The option_sub_label column is now available for storing
-- additional context labels for market options.
-- =====================================================

