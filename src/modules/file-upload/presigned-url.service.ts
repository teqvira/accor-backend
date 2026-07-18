import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import s3Client from '../../infrastructure/s3/s3.client';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  PRESIGNED_URL_EXPIRES_SECONDS,
} from './file-upload.constants';
import { buildS3ObjectUrl } from '../../infrastructure/s3/s3.object-url';
import { buildProductImageKey } from './product-image-key';

export interface PresignedUploadInput {
  fileName: string;
  contentType: (typeof ALLOWED_IMAGE_TYPES)[number];
}

export interface PresignedUploadResult {
  uploadUrl: string;
  imageUrl: string;
  key: string;
  expiresIn: number;
  maxSizeBytes: number;
}

export class PresignedUrlService {
  async createProductImageUploadUrl(
    input: PresignedUploadInput
  ): Promise<PresignedUploadResult> {
    const key = buildProductImageKey(input.fileName);

    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: input.contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
    });

    return {
      uploadUrl,
      imageUrl: buildS3ObjectUrl(key),
      key,
      expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
      maxSizeBytes: MAX_IMAGE_SIZE_BYTES,
    };
  }
}

export const presignedUrlService = new PresignedUrlService();
