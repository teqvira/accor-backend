export const PRODUCT_TYPES = [
  'engine_oil',
  'gear_oil',
  'grease',
  'coolant',
  'axle_oil',
  'other',
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_STATUSES = ['active', 'inactive'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_BRANDS = [
  'accor_premium',
  'aldor_gold',
  'accor_ultra_coolant',
  'other',
] as const;

export type ProductBrand = (typeof PRODUCT_BRANDS)[number];
