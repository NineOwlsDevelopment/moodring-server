-- =====================================================
-- MIGRATION 006: Security Fixes
-- =====================================================

-- Add index to speed up duplicate withdrawal checks
-- The application logic enforces the 60-second window check
CREATE INDEX IF NOT EXISTS withdrawals_duplicate_check_idx 
ON withdrawals (user_id, destination_address, amount, status, created_at)
WHERE status IN ('pending', 'processing');

-- Note: idempotency_key already has UNIQUE constraint which prevents exact duplicates
-- This index helps with the time-window duplicate check in application code

-- Add auto_credit_status column to market_options to prevent double payouts
ALTER TABLE market_options 
ADD COLUMN IF NOT EXISTS auto_credit_status VARCHAR(20) DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN market_options.auto_credit_status IS 
'Status of auto-credit process: NULL = not started, in_progress = currently processing, completed = finished. Prevents concurrent processing race conditions.';

-- Add check constraint to ensure valid status values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_auto_credit_status'
    ) THEN
        ALTER TABLE market_options 
        ADD CONSTRAINT check_auto_credit_status 
        CHECK (auto_credit_status IS NULL OR auto_credit_status IN ('in_progress', 'completed'));
    END IF;
END $$;


