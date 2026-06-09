import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../auth/middleware/auth.middleware';
import { sendError } from '../../../shared/utils/response';
import { uploadImage } from '../controller/uploadController';
import upload from '../service/uploadService';

const router = Router();

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
