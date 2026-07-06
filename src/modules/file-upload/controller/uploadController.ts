import { Response } from 'express';
import { AuthRequest } from '../../auth/types/auth.types';
import { sendError, sendSuccess } from '../../../shared/utils/response';
import { presignedUrlService } from '../service/presignedUrl.service';
import { PresignedUploadInput } from '../service/presignedUrl.service';

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

export const createPresignedUploadUrl = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const result = await presignedUrlService.createProductImageUploadUrl(
    req.body as PresignedUploadInput
  );

  sendSuccess(res, 'Presigned upload URL generated successfully', result);
};
