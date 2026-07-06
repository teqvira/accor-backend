import { z } from 'zod';
import { ALLOWED_IMAGE_TYPES } from '../constants/upload.constants';

export const presignedUploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(255, 'File name is too long')
    .regex(/\.(jpe?g|png|webp|gif)$/i, 'File name must end with a supported image extension'),
  contentType: z.enum(ALLOWED_IMAGE_TYPES, {
    message: 'Only JPEG, PNG, WebP, and GIF images are allowed',
  }),
});
