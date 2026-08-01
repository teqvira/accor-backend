import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { adminOnly } from '../auth/guards';
import {
  createPartnerDocumentPresignedUploadUrl,
  createPresignedUploadUrl,
} from './file-upload.admin.controller';
import {
  partnerDocumentPresignedUploadSchema,
  presignedUploadSchema,
} from './file-upload.validator';

const router = Router();

router.post(
  '/presigned-url',
  ...adminOnly,
  validate(presignedUploadSchema),
  asyncHandler(createPresignedUploadUrl)
);

/** Upload Aadhaar/PAN before creating partner (no partner id needed). */
router.post(
  '/partner-document-presigned-url',
  ...adminOnly,
  validate(partnerDocumentPresignedUploadSchema),
  asyncHandler(createPartnerDocumentPresignedUploadUrl)
);

export default router;
