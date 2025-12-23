-- =====================================================
-- MIGRATION 004: Add disputes table
-- =====================================================

-- Create disputes table to store dispute information
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  evidence TEXT,
  resolution_fee_paid BIGINT NOT NULL DEFAULT 0, -- Amount paid in micro-USDC
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at BIGINT NOT NULL DEFAULT 0,
  review_notes TEXT,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0
);

-- Create indexes for disputes table
CREATE INDEX IF NOT EXISTS idx_disputes_market_id ON disputes(market_id);
CREATE INDEX IF NOT EXISTS idx_disputes_option_id ON disputes(option_id);
CREATE INDEX IF NOT EXISTS idx_disputes_user_id ON disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_created_at ON disputes(created_at DESC);

-- Enable RLS on disputes table
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
