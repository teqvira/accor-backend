-- =======================================================
-- Pincode targeting + garage owner / worker relationship
-- Idempotent (safe to re-run)
-- =======================================================

-- Users: registered pincode (campaign eligibility)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pincode VARCHAR(6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_pincode_format_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_pincode_format_check
      CHECK (pincode IS NULL OR pincode ~ '^[1-9][0-9]{5}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_pincode ON users (pincode);

-- Garage: Owner → Workers
CREATE TABLE IF NOT EXISTS garages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID UNIQUE REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garages_name ON garages (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_garages_owner ON garages (owner_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS garage_id UUID REFERENCES garages (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS garage_role VARCHAR(20),
  ADD COLUMN IF NOT EXISTS garage_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS garage_owner_name VARCHAR(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_garage_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_garage_role_check
      CHECK (garage_role IS NULL OR garage_role IN ('owner', 'worker'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_garage_id ON users (garage_id);
CREATE INDEX IF NOT EXISTS idx_users_garage_role ON users (garage_role);

-- Campaigns: all pincodes vs one specific pincode
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS pincode_scope VARCHAR(20) NOT NULL DEFAULT 'all';

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS pincode VARCHAR(6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_pincode_scope_check'
  ) THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT campaigns_pincode_scope_check
      CHECK (pincode_scope IN ('all', 'specific'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_pincode_target_check'
  ) THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT campaigns_pincode_target_check
      CHECK (
        (pincode_scope = 'all' AND pincode IS NULL)
        OR (pincode_scope = 'specific' AND pincode ~ '^[1-9][0-9]{5}$')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaigns_pincode ON campaigns (pincode);

-- Future owner/worker reward split: points may credit a different user than cash
ALTER TABLE redemption_transactions
  ADD COLUMN IF NOT EXISTS points_credited_to_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_redemption_points_credited
  ON redemption_transactions (points_credited_to_user_id);
