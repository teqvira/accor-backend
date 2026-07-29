-- =======================================================
-- Activity feed composite indexes
-- =======================================================

CREATE INDEX IF NOT EXISTS idx_redemption_tx_user_redeemed_at
  ON redemption_transactions (user_id, redeemed_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created_at
  ON wallet_transactions (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_reward_tx_user_created_at
  ON reward_transactions (user_id, created_at DESC, id DESC);
