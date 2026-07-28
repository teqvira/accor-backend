import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env';

/**
 * Disable flexible checksums on every request so presigned PUT URLs stay
 * mobile/browser-friendly (Flutter must not send x-amz-checksum-* headers).
 */
const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export default s3Client;
