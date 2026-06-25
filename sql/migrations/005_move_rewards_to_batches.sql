ALTER TABLE qr_batches
  ADD COLUMN IF NOT EXISTS wallet_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

UPDATE qr_batches b
SET
  wallet_amount = COALESCE(NULLIF(b.wallet_amount, 0), p.wallet_amount, 0),
  reward_points = COALESCE(NULLIF(b.reward_points, 0), p.reward_points, 0),
  start_date = COALESCE(b.start_date, p.start_date),
  end_date = COALESCE(b.end_date, p.end_date)
FROM products p
WHERE b.product_id = p.id;

ALTER TABLE products
  DROP COLUMN IF EXISTS wallet_amount,
  DROP COLUMN IF EXISTS reward_points,
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date;
