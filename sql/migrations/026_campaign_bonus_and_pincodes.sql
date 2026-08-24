-- =======================================================
-- Campaign Bonus Type (Cash / Reward / Both) + Multi-Pincode Support
-- Idempotent (safe to re-run)
-- =======================================================

-- 1. Apply Bonus To: 'cash' | 'reward' | 'both'
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS apply_bonus_to VARCHAR(20) NOT NULL DEFAULT 'both';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_apply_bonus_to_check'
  ) THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT campaigns_apply_bonus_to_check
      CHECK (apply_bonus_to IN ('cash', 'reward', 'both'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaigns_apply_bonus_to ON campaigns (apply_bonus_to);

-- 2. Multi-Pincode targeting: array of 6-digit pincodes
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS pincodes VARCHAR(6)[] DEFAULT '{}';

-- Migrate single legacy pincode to pincodes array if present
UPDATE campaigns
SET pincodes = ARRAY[pincode]
WHERE pincode IS NOT NULL AND (pincodes IS NULL OR cardinality(pincodes) = 0);

-- Update check constraint on pincode targeting
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_pincode_target_check'
  ) THEN
    ALTER TABLE campaigns DROP CONSTRAINT campaigns_pincode_target_check;
  END IF;

  ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_pincode_target_check
    CHECK (
      (pincode_scope = 'all' AND (pincode IS NULL AND (pincodes IS NULL OR cardinality(pincodes) = 0)))
      OR (pincode_scope = 'specific' AND (pincode IS NOT NULL OR cardinality(pincodes) > 0))
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_campaigns_pincodes_gin ON campaigns USING GIN (pincodes);
