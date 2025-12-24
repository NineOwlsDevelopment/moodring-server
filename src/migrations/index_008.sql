-- =====================================================
-- SECURITY REMEDIATION MIGRATION (index_008.sql)
-- =====================================================
-- This migration implements database-level security fixes for all CRITICAL vulnerabilities:
-- 1. Resolution approval system (CVE-001)
-- 2. Reserved liquidity tracking (CVE-002)
-- 3. Admin sessions and MFA (CVE-003)
-- 4. Withdrawal job queue (CVE-004)
-- 5. Database constraints for negative balances (CVE-002, CVE-004)
-- =====================================================

-- =====================================================
-- 1. RESOLUTION APPROVAL SYSTEM (CVE-001)
-- =====================================================
-- Multi-admin approval for large market resolutions

CREATE TABLE IF NOT EXISTS resolution_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES resolution_submissions(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_hash TEXT, -- SHA256 hash of evidence for verification
  approval_signature TEXT, -- Cryptographic signature of approval
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  UNIQUE(market_id, submission_id, admin_user_id)
);

CREATE INDEX IF NOT EXISTS idx_resolution_approvals_market 
ON resolution_approvals(market_id, submission_id);

CREATE INDEX IF NOT EXISTS idx_resolution_approvals_admin 
ON resolution_approvals(admin_user_id, created_at DESC);

-- Add evidence validation fields to resolution_submissions
ALTER TABLE resolution_submissions 
ADD COLUMN IF NOT EXISTS evidence_hash TEXT,
ADD COLUMN IF NOT EXISTS evidence_signature TEXT,
ADD COLUMN IF NOT EXISTS evidence_source TEXT, -- e.g., 'chainlink', 'onchain', 'api'
ADD COLUMN IF NOT EXISTS evidence_timestamp BIGINT,
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;

-- =====================================================
-- 2. RESERVED LIQUIDITY TRACKING (CVE-002)
-- =====================================================
-- Track reserved liquidity for pending LP withdrawals

ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS reserved_liquidity BIGINT NOT NULL DEFAULT 0;

-- Add CHECK constraint to prevent negative pool liquidity
ALTER TABLE markets 
ADD CONSTRAINT IF NOT EXISTS chk_markets_pool_liquidity_non_negative 
CHECK (shared_pool_liquidity >= 0);

ALTER TABLE markets 
ADD CONSTRAINT IF NOT EXISTS chk_markets_reserved_liquidity_non_negative 
CHECK (reserved_liquidity >= 0);

ALTER TABLE markets 
ADD CONSTRAINT IF NOT EXISTS chk_markets_reserved_liquidity_bounds 
CHECK (reserved_liquidity <= shared_pool_liquidity);

-- =====================================================
-- 3. ADMIN SESSIONS AND MFA (CVE-003)
-- =====================================================
-- Session-based authentication and MFA for admin operations

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  last_used_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token 
ON admin_sessions(session_token) WHERE expires_at > EXTRACT(EPOCH FROM NOW())::BIGINT;

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin 
ON admin_sessions(admin_user_id, expires_at DESC);

-- MFA secrets for admins
CREATE TABLE IF NOT EXISTS admin_mfa_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL, -- Encrypted TOTP secret
  backup_codes TEXT[], -- Encrypted backup codes
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Admin audit log (immutable)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES admin_sessions(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- e.g., 'balance_adjustment', 'market_resolution', 'user_admin_toggle'
  target_type TEXT, -- e.g., 'user', 'market', 'withdrawal'
  target_id UUID,
  details JSONB NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin 
ON admin_audit_log(admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action 
ON admin_audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target 
ON admin_audit_log(target_type, target_id, created_at DESC);

-- =====================================================
-- 4. WITHDRAWAL JOB QUEUE (CVE-004)
-- =====================================================
-- Track withdrawal jobs for async processing

ALTER TABLE withdrawals 
ADD COLUMN IF NOT EXISTS job_id TEXT UNIQUE, -- Bull job ID
ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_retry_at BIGINT;

-- Add unique constraint to prevent duplicate withdrawals
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_unique_request 
ON withdrawals(user_id, destination_address, amount, created_at)
WHERE status IN ('pending', 'processing');

-- =====================================================
-- 5. DATABASE CONSTRAINTS FOR NEGATIVE BALANCES
-- =====================================================
-- Prevent negative balances at database level

ALTER TABLE wallets 
ADD CONSTRAINT IF NOT EXISTS chk_wallets_balance_usdc_non_negative 
CHECK (balance_usdc >= 0);

ALTER TABLE wallets 
ADD CONSTRAINT IF NOT EXISTS chk_wallets_balance_sol_non_negative 
CHECK (balance_sol >= 0);

-- =====================================================
-- 6. MARKET CREATION BOND TRACKING (CVE-008)
-- =====================================================
-- Track market creation bonds and fees

ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS creation_bond BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS creation_fee BIGINT NOT NULL DEFAULT 0;

-- =====================================================
-- 7. RATE LIMITING TRACKING (CVE-009)
-- =====================================================
-- Per-user rate limiting tracking

CREATE TABLE IF NOT EXISTS user_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  limit_type TEXT NOT NULL, -- e.g., 'trade', 'withdrawal', 'market_creation'
  window_start BIGINT NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  volume_usdc BIGINT NOT NULL DEFAULT 0, -- For daily volume limits
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  UNIQUE(user_id, limit_type, window_start)
);

CREATE INDEX IF NOT EXISTS idx_user_rate_limits_user 
ON user_rate_limits(user_id, limit_type, window_start DESC);

-- =====================================================
-- 8. CIRCUIT BREAKER STATE (Defense-in-Depth)
-- =====================================================
-- Track circuit breaker state for automatic pausing

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breaker_type TEXT NOT NULL UNIQUE, -- e.g., 'trading', 'withdrawals', 'deposits'
  is_open BOOLEAN NOT NULL DEFAULT FALSE, -- true = circuit open (paused)
  error_count INT NOT NULL DEFAULT 0,
  last_error_at BIGINT,
  opened_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- All security-related database changes are now in place.
-- These tables, columns, and constraints support:
-- - Multi-admin resolution approval (CVE-001)
-- - Atomic liquidity reservations (CVE-002)
-- - Admin MFA and session management (CVE-003)
-- - Withdrawal job queue (CVE-004)
-- - Negative balance prevention (CVE-002, CVE-004)
-- - Market creation bonds (CVE-008)
-- - Per-user rate limiting (CVE-009)
-- - Circuit breaker state tracking
-- =====================================================
