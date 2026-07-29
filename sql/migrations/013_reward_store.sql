-- =======================================================
-- Reward Store: catalog + redemptions
-- Idempotent (safe to re-run)
-- =======================================================

CREATE TABLE IF NOT EXISTS reward_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  category VARCHAR(30) NOT NULL DEFAULT 'other'
    CHECK (category IN ('electronics', 'vouchers', 'merchandise', 'other')),

  points_cost INTEGER NOT NULL CHECK (points_cost > 0),

  image_url VARCHAR(2048),

  -- NULL means unlimited
  stock_quantity INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0),

  status VARCHAR(10) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),

  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_catalog_status_sort
  ON reward_catalog (status, sort_order);

CREATE INDEX IF NOT EXISTS idx_reward_catalog_category
  ON reward_catalog (category);

-- =======================================================

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users (id),
  reward_id UUID NOT NULL REFERENCES reward_catalog (id),

  idempotency_key UUID NOT NULL,

  -- Snapshot at time of redemption
  reward_code VARCHAR(64) NOT NULL,
  reward_name VARCHAR(255) NOT NULL,
  reward_image_url VARCHAR(2048),

  points_spent INTEGER NOT NULL CHECK (points_spent > 0),
  points_balance_after INTEGER NOT NULL CHECK (points_balance_after >= 0),

  redeemed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_reward_redemptions_user_idempotency
    UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user
  ON reward_redemptions (user_id);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward
  ON reward_redemptions (reward_id);

-- One ledger debit per reward redemption. This protects the points ledger even
-- if a future caller accidentally retries outside the idempotent service flow.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_tx_reward_redeem_once
  ON reward_transactions (user_id, reference_id)
  WHERE reference_type = 'reward_redeem' AND type = 'debit';

-- =======================================================
-- Seed catalog (idempotent via ON CONFLICT DO NOTHING)
-- =======================================================

INSERT INTO reward_catalog (id, code, name, description, category, points_cost, image_url, stock_quantity, status, sort_order)
VALUES
  (
    '11111111-0000-0000-0000-000000000001',
    'GIFT_HAMPER_10K',
    'Gift Hamper',
    'A curated hamper with premium goodies and treats.',
    'merchandise',
    10000,
    NULL,
    NULL,
    'active',
    10
  ),
  (
    '11111111-0000-0000-0000-000000000002',
    'BT_SPEAKER_25K',
    'Bluetooth Speaker',
    'Portable wireless speaker with rich, full-range audio.',
    'electronics',
    25000,
    NULL,
    NULL,
    'active',
    20
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    'PREMIUM_TOOL_KIT_50K',
    'Premium Tool Kit',
    'Professional-grade tool kit for mechanics and enthusiasts.',
    'merchandise',
    50000,
    NULL,
    NULL,
    'active',
    30
  ),
  (
    '11111111-0000-0000-0000-000000000004',
    'SMARTPHONE_75K',
    'Smartphone',
    'Latest model smartphone with high-resolution camera and fast processor.',
    'electronics',
    75000,
    NULL,
    NULL,
    'active',
    40
  ),
  (
    '11111111-0000-0000-0000-000000000005',
    'MOTORCYCLE_100K',
    'Motorcycle',
    'Brand-new commuter motorcycle – the ultimate loyalty reward.',
    'other',
    100000,
    NULL,
    NULL,
    'active',
    50
  )
ON CONFLICT (code) DO NOTHING;
