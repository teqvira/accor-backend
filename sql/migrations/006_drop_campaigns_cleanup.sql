-- Idempotent cleanup: remove legacy campaign table and columns
DROP INDEX IF EXISTS idx_products_campaign;

ALTER TABLE redemption_transactions
  DROP COLUMN IF EXISTS campaign_id;

ALTER TABLE qr_codes
  DROP COLUMN IF EXISTS campaign_id;

ALTER TABLE qr_batches
  DROP COLUMN IF EXISTS campaign_id;

ALTER TABLE products
  DROP COLUMN IF EXISTS campaign_id;

DROP TABLE IF EXISTS campaigns CASCADE;
