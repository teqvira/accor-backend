-- =======================================================
-- QR Batches & QR Codes
-- =======================================================

CREATE TABLE IF NOT EXISTS qr_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  product_id UUID NOT NULL REFERENCES products (id),

  name VARCHAR(255) NOT NULL,

  wallet_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reward_points INTEGER NOT NULL DEFAULT 0,

  total_qrs INTEGER NOT NULL DEFAULT 0,
  generated_count INTEGER NOT NULL DEFAULT 0,

  start_date DATE,
  end_date DATE,

  active BOOLEAN NOT NULL DEFAULT true,

  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generated')),

  label_shape VARCHAR(20) NOT NULL DEFAULT 'cap'
    CHECK (label_shape IN ('cap', 'square')),

  label_color VARCHAR(40) NOT NULL DEFAULT 'performance_green'
    CHECK (
      label_color IN (
        'performance_green',
        'heavy_duty_blue',
        'industrial_bronze',
        'premium_gold',
        'professional_graphite',
        'signature_burgundy'
      )
    ),

  created_by UUID REFERENCES users (id),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_batches_product ON qr_batches (product_id);
CREATE INDEX IF NOT EXISTS idx_qr_batches_status ON qr_batches (status);
CREATE INDEX IF NOT EXISTS idx_qr_batches_active ON qr_batches (active);
CREATE INDEX IF NOT EXISTS idx_qr_batches_created_by ON qr_batches (created_by);

CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(100) UNIQUE NOT NULL,

  batch_id UUID NOT NULL REFERENCES qr_batches (id),
  product_id UUID NOT NULL REFERENCES products (id),

  redeemed BOOLEAN NOT NULL DEFAULT false,
  redeemed_by UUID REFERENCES users (id),
  redeemed_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes (code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_batch ON qr_codes (batch_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_product ON qr_codes (product_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_redeemed ON qr_codes (redeemed);
CREATE INDEX IF NOT EXISTS idx_qr_codes_redeemed_by ON qr_codes (redeemed_by);
