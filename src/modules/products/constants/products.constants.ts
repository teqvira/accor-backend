export const PRODUCT_TYPES = [
  'engine_oil',
  'gear_oil',
  'grease',
  'coolant',
  'axle_oil',
  'other',
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TEXT_MAX_LENGTH = 10000;

export const PRODUCT_STATUSES = ['active', 'inactive'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
