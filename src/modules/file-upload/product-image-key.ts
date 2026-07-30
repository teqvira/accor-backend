import { randomUUID } from 'crypto';
import path from 'path';
import { env } from '../../config/env';
import { ALLOWED_IMAGE_EXTENSIONS } from './file-upload.constants';
import { sanitizeFilename } from './sanitize-filename';

export function buildProductImageKey(fileName: string): string {
  return buildUploadImageKey(fileName, 'products');
}

export function buildRewardImageKey(fileName: string): string {
  return buildUploadImageKey(fileName, 'rewards');
}

export function buildUploadImageKey(
  fileName: string,
  folder: 'products' | 'rewards' = 'products'
): string {
  const ext = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, ext);
  const safeName = sanitizeFilename(baseName);
  const safeExt = ALLOWED_IMAGE_EXTENSIONS.includes(
    ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number]
  )
    ? ext
    : '.jpg';

  return `${folder}/${randomUUID()}-${safeName}${safeExt}`;
}

export function isOwnBucketObjectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const bucketHost = `${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com`;
    const legacyHost = `${env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com`;

    return (
      (parsed.hostname === bucketHost || parsed.hostname === legacyHost) &&
      (parsed.pathname.startsWith('/products/') ||
        parsed.pathname.startsWith('/rewards/'))
    );
  } catch {
    return false;
  }
}

