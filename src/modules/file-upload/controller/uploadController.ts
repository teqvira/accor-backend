import { Response } from 'express';
import { AuthRequest } from '../../auth/types/auth.types';
import { sendError, sendSuccess } from '../../../shared/utils/response';

function isMulterS3File(
  file: Express.Multer.File
): file is Express.MulterS3.File {
  return (
    'location' in file &&
    'bucket' in file &&
    typeof file.location === 'string' &&
    typeof file.bucket === 'string'
  );
}

export const uploadImage = (req: AuthRequest, res: Response): void => {
  if (!req.file) {
    sendError(res, 400, 'No file uploaded', 'req.file is missing after multer processing');
    return;
  }

  if (!isMulterS3File(req.file)) {
    sendError(res, 500, 'Upload failed', 'Uploaded file metadata is invalid');
    return;
  }

  sendSuccess(res, 'Image uploaded successfully', {
    imageUrl: req.file.location,
    key: req.file.key,
    bucket: req.file.bucket,
  });
};
