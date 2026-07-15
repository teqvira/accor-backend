-- =======================================================
-- Redemption / Wallet / Reward Ledgers
-- =======================================================

CREATE TABLE IF NOT EXISTS redemption_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users (id),
  qr_code_id UUID NOT NULL UNIQUE REFERENCES qr_codes (id),
  batch_id UUID NOT NULL REFERENCES qr_batches (id),
  product_id UUID NOT NULL REFERENCES products (id),

  wallet_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reward_points INTEGER NOT NULL DEFAULT 0,

  redeemed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redemption_tx_user ON redemption_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_redemption_tx_batch ON redemption_transactions (batch_id);
CREATE INDEX IF NOT EXISTS idx_redemption_tx_product ON redemption_transactions (product_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users (id),

  amount NUMERIC(12, 2) NOT NULL,

  type VARCHAR(10) NOT NULL
    CHECK (type IN ('credit', 'debit')),

  reference_type VARCHAR(40)
    CHECK (
      reference_type IS NULL
      OR reference_type IN ('qr_redemption', 'withdrawal', 'admin_adjustment')
    ),

  reference_id UUID,

  remarks TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference
  ON wallet_transactions (reference_type, reference_id);

CREATE TABLE IF NOT EXISTS reward_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users (id),

  points INTEGER NOT NULL,

  type VARCHAR(10) NOT NULL
    CHECK (type IN ('credit', 'debit')),

  reference_type VARCHAR(40)
    CHECK (
      reference_type IS NULL
      OR reference_type IN ('qr_redemption', 'reward_redeem', 'admin_adjustment')
    ),

  reference_id UUID,

  remarks TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_tx_user ON reward_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_reward_tx_reference
  ON reward_transactions (reference_type, reference_id);
