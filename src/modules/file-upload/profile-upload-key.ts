import { randomUUID } from 'crypto';
import path from 'path';
import { env } from '../../config/env';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_IMAGE_EXTENSIONS,
  PROFILE_UPLOAD_PREFIX,
  ProfileUploadPurpose,
} from './file-upload.constants';
import { sanitizeFilename } from './sanitize-filename';

export function buildProfileUploadKey(
  userId: string,
  purpose: ProfileUploadPurpose,
  fileName: string
): string {
  const ext = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, ext);
  const safeName = sanitizeFilename(baseName);

  const allowed =
    purpose === 'avatar' ? ALLOWED_IMAGE_EXTENSIONS : ALLOWED_DOCUMENT_EXTENSIONS;

  const safeExt = (allowed as readonly string[]).includes(ext) ? ext : '.jpg';

  return `${PROFILE_UPLOAD_PREFIX}${userId}/${purpose}/${randomUUID()}-${safeName}${safeExt}`;
}

export function isOwnProfileUploadUrl(
  url: string,
  userId: string,
  purpose?: ProfileUploadPurpose
): boolean {
  try {
    const parsed = new URL(url);
    const bucketHost = `${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com`;
    const legacyHost = `${env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com`;

    if (parsed.hostname !== bucketHost && parsed.hostname !== legacyHost) {
      return false;
    }

    const expectedPrefix = purpose
      ? `/${PROFILE_UPLOAD_PREFIX}${userId}/${purpose}/`
      : `/${PROFILE_UPLOAD_PREFIX}${userId}/`;

    return decodeURIComponent(parsed.pathname).startsWith(expectedPrefix);
  } catch {
    return false;
  }
}
