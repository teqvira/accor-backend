-- Legacy migration: move rewards off campaigns onto products (then 005 moves them to batches)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaigns'
  ) THEN
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS wallet_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS start_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = 'campaign_id'
    ) THEN
      UPDATE products p
      SET
        wallet_amount = COALESCE(p.wallet_amount, c.wallet_amount, 0),
        reward_points = COALESCE(p.reward_points, c.reward_points, 0),
        start_date = COALESCE(p.start_date, c.start_date),
        end_date = COALESCE(p.end_date, c.end_date)
      FROM campaigns c
      WHERE p.campaign_id = c.id;
    END IF;
  END IF;
END $$;

ALTER TABLE redemption_transactions
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

UPDATE redemption_transactions rt
SET product_id = qc.product_id
FROM qr_codes qc
WHERE rt.qr_code_id = qc.id
  AND rt.product_id IS NULL
  AND qc.product_id IS NOT NULL;

ALTER TABLE redemption_transactions
  DROP COLUMN IF EXISTS campaign_id;

ALTER TABLE qr_codes
  DROP COLUMN IF EXISTS campaign_id;

ALTER TABLE qr_batches
  DROP COLUMN IF EXISTS campaign_id;

ALTER TABLE products
  DROP COLUMN IF EXISTS campaign_id;

DROP INDEX IF EXISTS idx_products_campaign;

DROP TABLE IF EXISTS campaigns;
