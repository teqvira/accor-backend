import { randomUUID } from 'crypto';
import path from 'path';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { env } from '../../config/env';
import { AuthRequest } from '../auth/auth.types';
import s3Client from '../../infrastructure/s3/s3.client';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from './file-upload.constants';
import { sanitizeFilename } from './sanitize-filename';

const ALLOWED_IMAGE_TYPE_SET = new Set<string>(ALLOWED_IMAGE_TYPES);
const ALLOWED_EXTENSION_SET = new Set<string>(ALLOWED_IMAGE_EXTENSIONS);

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata(req, _file, cb) {
      const userId = (req as AuthRequest).user?.sub;
      cb(null, userId ? { uploadedBy: userId } : {});
    },
    key(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const baseName = path.basename(file.originalname, ext);
      const safeName = sanitizeFilename(baseName);
      cb(null, `uploads/${randomUUID()}-${safeName}${ext}`);
    },
  }),
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ALLOWED_IMAGE_TYPE_SET.has(file.mimetype) && ALLOWED_EXTENSION_SET.has(ext)) {
      cb(null, true);
      return;
    }

    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  },
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
  },
});

export default upload;
