CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  product_type VARCHAR(50) NOT NULL
    CHECK (product_type IN (
      'engine_oil',
      'gear_oil',
      'grease',
      'coolant',
      'axle_oil',
      'other'
    )),
  brand VARCHAR(100),
  coupon_code VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  description TEXT,
  image_url VARCHAR(2048),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku_code ON products(sku_code);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
