import { Router } from 'express';
import multer from 'multer';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { authenticate, requireRoles } from '../auth/auth.middleware';
import { UserRole } from '../auth/index';
import { sendError } from '../../shared/utils/response';
import {
  createPresignedUploadUrl,
  createProfilePresignedUploadUrl,
  uploadImage,
} from './file-upload.controller';
import upload from './upload.middleware';
import {
  presignedUploadSchema,
  profilePresignedUploadSchema,
} from './file-upload.validator';

const router = Router();

const adminOnly = [authenticate, requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN)];
const userOnly = [authenticate, requireRoles(UserRole.USER)];

router.post(
  '/presigned-url',
  ...adminOnly,
  validate(presignedUploadSchema),
  asyncHandler(createPresignedUploadUrl)
);

router.post(
  '/profile-presigned-url',
  ...userOnly,
  validate(profilePresignedUploadSchema),
  asyncHandler(createProfilePresignedUploadUrl)
);

router.post(
  '/',
  authenticate,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          sendError(
            res,
            400,
            'File size is too large.',
            `Multer LIMIT_FILE_SIZE: ${err.message}`
          );
          return;
        }
        sendError(res, 400, 'Upload failed', `Multer error: ${err.message}`);
        return;
      }

      if (err instanceof Error) {
        sendError(res, 400, err.message, err.message);
        return;
      }

      next();
    });
  },
  uploadImage
);

export default router;
