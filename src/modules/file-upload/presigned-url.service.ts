import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/utils/errors';
import s3Client from '../../infrastructure/s3/s3.client';
import { buildS3ObjectUrl } from '../../infrastructure/s3/s3.object-url';
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  PartnerDocumentPurpose,
  PRESIGNED_URL_EXPIRES_SECONDS,
  ProfileUploadPurpose,
} from './file-upload.constants';
import {
  buildPartnerDocumentKey,
  buildUploadImageKey,
} from './product-image-key';
import { buildProfileUploadKey } from './profile-upload-key';

export interface PresignedUploadInput {
  fileName: string;
  contentType: (typeof ALLOWED_IMAGE_TYPES)[number];
  folder?: 'products' | 'rewards' | 'gifts';
}

export interface ProfilePresignedUploadInput {
  fileName: string;
  contentType: string;
  purpose: ProfileUploadPurpose;
}

export interface PartnerDocumentPresignedInput {
  fileName: string;
  contentType: string;
  purpose: PartnerDocumentPurpose;
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
    const key = buildUploadImageKey(input.fileName, input.folder || 'products');

    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: input.contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
      signableHeaders: new Set(['content-type']),
    });

    return {
      uploadUrl,
      imageUrl: buildS3ObjectUrl(key),
      key,
      expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
      maxSizeBytes: MAX_IMAGE_SIZE_BYTES,
    };
  }

  async createProfileUploadUrl(
    userId: string,
    input: ProfilePresignedUploadInput
  ): Promise<
    PresignedUploadResult & {
      purpose: ProfileUploadPurpose;
      fileUrl: string;
    }
  > {
    const isAvatar = input.purpose === 'avatar';
    const allowedTypes = isAvatar ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;
    if (!(allowedTypes as readonly string[]).includes(input.contentType)) {
      throw new BadRequestError(
        isAvatar
          ? 'Avatar must be JPEG, PNG, WebP, or GIF'
          : 'Document must be JPEG, PNG, WebP, GIF, or PDF',
        `createProfileUploadUrl: unsupported contentType=${input.contentType} purpose=${input.purpose}`
      );
    }

    const key = buildProfileUploadKey(userId, input.purpose, input.fileName);
    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: input.contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
      // Keep Content-Type in the signature so Flutter must send the same header.
      signableHeaders: new Set(['content-type']),
    });

    const fileUrl = buildS3ObjectUrl(key);

    return {
      uploadUrl,
      imageUrl: fileUrl,
      fileUrl,
      key,
      purpose: input.purpose,
      expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
      maxSizeBytes: isAvatar ? MAX_IMAGE_SIZE_BYTES : MAX_DOCUMENT_SIZE_BYTES,
    };
  }

  /** Admin upload Aadhaar/PAN before partner exists (no partner id needed). */
  async createPartnerDocumentUploadUrl(
    input: PartnerDocumentPresignedInput
  ): Promise<
    PresignedUploadResult & {
      purpose: PartnerDocumentPurpose;
      fileUrl: string;
    }
  > {
    if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(input.contentType)) {
      throw new BadRequestError(
        'Document must be JPEG, PNG, WebP, GIF, or PDF',
        `createPartnerDocumentUploadUrl: unsupported contentType=${input.contentType}`
      );
    }

    const key = buildPartnerDocumentKey(input.purpose, input.fileName);
    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: input.contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
      signableHeaders: new Set(['content-type']),
    });

    const fileUrl = buildS3ObjectUrl(key);

    return {
      uploadUrl,
      imageUrl: fileUrl,
      fileUrl,
      key,
      purpose: input.purpose,
      expiresIn: PRESIGNED_URL_EXPIRES_SECONDS,
      maxSizeBytes: MAX_DOCUMENT_SIZE_BYTES,
    };
  }
}

export const presignedUrlService = new PresignedUrlService();
