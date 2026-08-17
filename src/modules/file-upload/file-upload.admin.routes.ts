import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { adminOnly } from '../auth/guards';
import {
  createPartnerDocumentPresignedUploadUrl,
  createPresignedUploadUrl,
  createProfilePresignedUploadUrl,
} from './file-upload.admin.controller';
import {
  partnerDocumentPresignedUploadSchema,
  presignedUploadSchema,
  profilePresignedUploadSchema,
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

/** Upload Admin avatar (purpose: avatar). */
router.post(
  '/profile-presigned-url',
  ...adminOnly,
  validate(profilePresignedUploadSchema),
  asyncHandler(createProfilePresignedUploadUrl)
);

export default router;

