import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import s3Client from './s3.client';

const VIEW_URL_EXPIRES_SECONDS = 60 * 60;

export function buildS3ObjectUrl(key: string): string {
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `https://${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${encodedKey}`;
}

export function extractS3ObjectKey(urlOrKey: string): string | null {
  const trimmed = urlOrKey.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('://')) {
    return trimmed.replace(/^\//, '');
  }

  try {
    const parsed = new URL(trimmed);
    const bucketHost = `${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com`;
    const legacyHost = `${env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com`;
    if (parsed.hostname !== bucketHost && parsed.hostname !== legacyHost) {
      return null;
    }
    return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  } catch {
    return null;
  }
}

/** Time-limited GET URL so private S3 objects can render in the admin app. */
export async function signS3ViewUrl(
  urlOrKey: string | null | undefined
): Promise<string | null> {
  if (!urlOrKey) return null;
  const key = extractS3ObjectKey(urlOrKey);
  if (!key) return urlOrKey;

  try {
    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
    });
    return await getSignedUrl(s3Client, command, {
      expiresIn: VIEW_URL_EXPIRES_SECONDS,
    });
  } catch (err) {
    console.error(
      '[s3] signS3ViewUrl failed:',
      err instanceof Error ? err.message : err
    );
    return urlOrKey;
  }
}
