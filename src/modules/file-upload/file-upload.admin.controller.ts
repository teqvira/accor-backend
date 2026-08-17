import { Response } from 'express';
import { AuthRequest } from '../auth/auth.types';
import { sendError, sendSuccess } from '../../shared/utils/response';
import {
  PartnerDocumentPresignedInput,
  PresignedUploadInput,
  ProfilePresignedUploadInput,
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

export const createPartnerDocumentPresignedUploadUrl = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const result = await presignedUrlService.createPartnerDocumentUploadUrl(
    req.body as PartnerDocumentPresignedInput
  );

  sendSuccess(res, 'Presigned upload URL generated successfully', result);
};

export const createProfilePresignedUploadUrl = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    sendError(res, 401, 'Please log in to continue', 'missing auth user');
    return;
  }

  const result = await presignedUrlService.createProfileUploadUrl(
    req.user.sub,
    req.body as ProfilePresignedUploadInput
  );

  sendSuccess(res, 'Presigned upload URL generated successfully', result);
};

