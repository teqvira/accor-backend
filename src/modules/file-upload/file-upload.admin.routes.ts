import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { adminOnly } from '../auth/guards';
import { createPresignedUploadUrl } from './file-upload.admin.controller';
import { presignedUploadSchema } from './file-upload.validator';

const router = Router();

router.post(
  '/presigned-url',
  ...adminOnly,
  validate(presignedUploadSchema),
  asyncHandler(createPresignedUploadUrl)
);

export default router;
