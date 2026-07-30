-- =======================================================
-- Update reward_catalog status check constraint & column width
-- Supports: 'active', 'upcoming', 'inactive', 'expired'
-- =======================================================

ALTER TABLE reward_catalog
  ALTER COLUMN status TYPE VARCHAR(20);

ALTER TABLE reward_catalog
  DROP CONSTRAINT IF EXISTS reward_catalog_status_check;

ALTER TABLE reward_catalog
  ADD CONSTRAINT reward_catalog_status_check
  CHECK (status IN ('active', 'upcoming', 'inactive', 'expired'));
