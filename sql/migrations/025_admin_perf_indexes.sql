-- =======================================================
-- Admin list/dashboard query performance
-- Idempotent (safe to re-run)
-- =======================================================

CREATE INDEX IF NOT EXISTS idx_wallet_tx_type
  ON wallet_transactions (type);

CREATE INDEX IF NOT EXISTS idx_reward_tx_type
  ON reward_transactions (type);

CREATE INDEX IF NOT EXISTS idx_users_role_approval_active
  ON users (role, approval_status, is_active);

CREATE INDEX IF NOT EXISTS idx_users_role_created
  ON users (role, created_at DESC);
