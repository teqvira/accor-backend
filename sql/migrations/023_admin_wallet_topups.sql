-- =======================================================
-- Admin Wallet Top-ups & Settlement Tracking
-- =======================================================

CREATE TABLE IF NOT EXISTS admin_wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  admin_id UUID REFERENCES users (id),

  order_id VARCHAR(255) NOT NULL,
  payment_id VARCHAR(255),

  amount NUMERIC(12, 2) NOT NULL,
  net_amount NUMERIC(12, 2) NOT NULL,

  status VARCHAR(30) NOT NULL DEFAULT 'pending_settlement'
    CHECK (status IN ('pending_payment', 'pending_settlement', 'settled', 'failed')),

  settlement_date DATE,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_wallet_topups_status
  ON admin_wallet_topups (status);

CREATE INDEX IF NOT EXISTS idx_admin_wallet_topups_order
  ON admin_wallet_topups (order_id);
