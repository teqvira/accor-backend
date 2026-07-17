-- =======================================================
-- Product description + color
-- =======================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS color VARCHAR(100);
