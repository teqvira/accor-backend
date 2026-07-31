-- =======================================================
-- Campaigns & Multipliers
-- =======================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  campaign_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,

  product_id UUID NOT NULL REFERENCES products (id),

  multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.0,

  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,

  active BOOLEAN NOT NULL DEFAULT true,

  created_by UUID REFERENCES users (id),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_product ON campaigns (product_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns (active);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns (start_date, end_date);

CREATE TABLE IF NOT EXISTS campaign_batches (
  campaign_id UUID NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES qr_batches (id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_batches_batch ON campaign_batches (batch_id);

ALTER TABLE redemption_transactions
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns (id) ON DELETE SET NULL;

ALTER TABLE redemption_transactions
  ADD COLUMN IF NOT EXISTS multiplier_applied NUMERIC(4, 2) DEFAULT 1.0;
