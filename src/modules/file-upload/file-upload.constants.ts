export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ...ALLOWED_IMAGE_EXTENSIONS,
  '.pdf',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const PRESIGNED_URL_EXPIRES_SECONDS = 15 * 60;

export const PRODUCT_IMAGE_PREFIX = 'products/';
export const PROFILE_UPLOAD_PREFIX = 'users/';
export const PARTNER_DOCUMENT_PREFIX = 'partners/';

export const PROFILE_UPLOAD_PURPOSES = ['avatar', 'aadhaar', 'pan'] as const;
export type ProfileUploadPurpose = (typeof PROFILE_UPLOAD_PURPOSES)[number];

export const PARTNER_DOCUMENT_PURPOSES = ['aadhaar', 'pan'] as const;
export type PartnerDocumentPurpose = (typeof PARTNER_DOCUMENT_PURPOSES)[number];
