import { Router } from 'express';
import multer from 'multer';
import { validate } from '../../../shared/middleware/validate';
import { asyncHandler } from '../../../shared/middleware/asyncHandler';
import { authenticate, requireRoles } from '../../auth/middleware/auth.middleware';
import { UserRole } from '../../auth';
import { sendError } from '../../../shared/utils/response';
import { createPresignedUploadUrl, uploadImage } from '../controller/uploadController';
import upload from '../service/uploadService';
import { presignedUploadSchema } from '../validators/upload.validator';

const router = Router();

const adminOnly = [authenticate, requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN)];

router.post(
  '/presigned-url',
  ...adminOnly,
  validate(presignedUploadSchema),
  asyncHandler(createPresignedUploadUrl)
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
