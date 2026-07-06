export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const PRESIGNED_URL_EXPIRES_SECONDS = 15 * 60;

export const PRODUCT_IMAGE_PREFIX = 'products/';
