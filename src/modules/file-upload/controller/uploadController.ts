import { Response } from 'express';
import { AuthRequest } from '../../auth/types/auth.types';
import { sendError, sendSuccess } from '../../../shared/utils/response';

export const uploadImage = (req: AuthRequest, res: Response): void => {
  if (!req.file) {
    sendError(res, 400, 'No file uploaded', 'req.file is missing after multer processing');
    return;
  }

  const file = req.file as Express.MulterS3.File;

  sendSuccess(res, 'Image uploaded successfully', {
    imageUrl: file.location,
    key: file.key,
    bucket: file.bucket,
  });
};
