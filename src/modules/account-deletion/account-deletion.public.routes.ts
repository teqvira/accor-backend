import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import {
  websiteConfirmDeletionSchema,
  websiteSendOtpSchema,
} from './account-deletion.validator';
import { accountDeletionPublicController } from './account-deletion.public.controller';

const router = Router();

router.post(
  '/send-otp',
  validate(websiteSendOtpSchema),
  asyncHandler((req, res) => accountDeletionPublicController.sendOtp(req, res))
);

router.post(
  '/confirm',
  validate(websiteConfirmDeletionSchema),
  asyncHandler((req, res) => accountDeletionPublicController.confirm(req, res))
);

export default router;
