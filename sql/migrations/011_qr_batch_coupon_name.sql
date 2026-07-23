-- =======================================================
-- Separate optional coupon name from human-readable batch code
-- `name` stays as BATCH-001 style; UUID remains primary key
-- =======================================================

ALTER TABLE qr_batches
  ADD COLUMN IF NOT EXISTS coupon_name VARCHAR(255);
