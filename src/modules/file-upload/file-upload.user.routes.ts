import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../auth/auth.middleware';
import { createProfilePresignedUploadUrl } from './file-upload.user.controller';
import { profilePresignedUploadSchema } from './file-upload.validator';

const router = Router();

router.post(
  '/profile-presigned-url',
  authenticate,
  validate(profilePresignedUploadSchema),
  asyncHandler(createProfilePresignedUploadUrl)
);

export default router;

