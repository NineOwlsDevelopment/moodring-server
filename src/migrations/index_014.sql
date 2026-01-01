-- Migration 014: Add last_signature to wallets for efficient deposit polling
-- This prevents redundant RPC calls by tracking the last processed signature per wallet

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS last_signature VARCHAR(128) DEFAULT NULL;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS last_signature_slot BIGINT DEFAULT NULL;

-- Index for faster lookups when polling (only wallets with signatures need full re-scan)
CREATE INDEX IF NOT EXISTS idx_wallets_last_signature ON wallets (last_signature) WHERE last_signature IS NOT NULL;

COMMENT ON COLUMN wallets.last_signature IS 'Last processed transaction signature for this wallet - used to optimize deposit polling';
COMMENT ON COLUMN wallets.last_signature_slot IS 'Slot of the last processed signature - used for age-based filtering';

