import { randomUUID } from 'crypto';
import path from 'path';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { env } from '../../../config/env';
import { AuthRequest } from '../../auth/types/auth.types';
import s3Client from '../config/s3Config';
import { sanitizeFilename } from '../utils/sanitizeFilename';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

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

    if (ALLOWED_IMAGE_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
      return;
    }

    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default upload;
