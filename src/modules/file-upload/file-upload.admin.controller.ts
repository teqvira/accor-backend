import { Response } from 'express';
import { AuthRequest } from '../auth/auth.types';
import { sendSuccess } from '../../shared/utils/response';
import {
  PresignedUploadInput,
  presignedUrlService,
} from './presigned-url.service';

export const createPresignedUploadUrl = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const result = await presignedUrlService.createProductImageUploadUrl(
    req.body as PresignedUploadInput
  );

  sendSuccess(res, 'Presigned upload URL generated successfully', result);
};
