ALTER TABLE products
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);

ALTER TABLE qr_batches
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

CREATE INDEX IF NOT EXISTS idx_products_campaign ON products(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qr_batches_product ON qr_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_product ON qr_codes(product_id);
