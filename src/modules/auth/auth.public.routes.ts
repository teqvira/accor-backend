import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { authController } from './auth.controller';
import {
  optionalAuthenticate,
  requireBearerToken,
  authenticate,
} from './auth.middleware';
import { AuthRequest } from './auth.types';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerDeviceTokenSchema,
  resendMobileOtpSchema,
  resetPasswordWithCurrentSchema,
  resetPasswordWithTokenSchema,
  sendMobileOtpSchema,
  verifyMobileOtpSchema,
  verifyPasswordOtpSchema,
} from './auth.validator';

const router = Router();

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler<AuthRequest>((req, res) => authController.login(req, res))
);

router.post(
  '/send-mobile-otp',
  optionalAuthenticate,
  validate(sendMobileOtpSchema),
  asyncHandler<AuthRequest>((req, res) => authController.sendMobileOtp(req, res))
);

router.post(
  '/resend-mobile-otp',
  optionalAuthenticate,
  validate(resendMobileOtpSchema),
  asyncHandler<AuthRequest>((req, res) =>
    authController.resendMobileOtp(req, res)
  )
);

router.post(
  '/verify-mobile-otp',
  optionalAuthenticate,
  validate(verifyMobileOtpSchema),
  asyncHandler<AuthRequest>((req, res) =>
    authController.verifyMobileOtp(req, res)
  )
);

router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  asyncHandler<AuthRequest>((req, res) => authController.refreshToken(req, res))
);

router.post(
  '/logout',
  requireBearerToken,
  validate(logoutSchema),
  asyncHandler<AuthRequest>((req, res) => authController.logout(req, res))
);

router.post(
  '/device-token',
  authenticate,
  validate(registerDeviceTokenSchema),
  asyncHandler<AuthRequest>((req, res) =>
    authController.registerDeviceToken(req, res)
  )
);

router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  asyncHandler<AuthRequest>((req, res) =>
    authController.forgotPassword(req, res)
  )
);

router.post(
  '/verify-otp',
  validate(verifyPasswordOtpSchema),
  asyncHandler<AuthRequest>((req, res) =>
    authController.verifyPasswordOtp(req, res)
  )
);

router.post(
  '/reset-password/otp',
  validate(resetPasswordWithTokenSchema),
  asyncHandler<AuthRequest>((req, res) =>
    authController.resetPasswordWithToken(req, res)
  )
);

router.post(
  '/reset-password',
  authenticate,
  validate(resetPasswordWithCurrentSchema),
  asyncHandler<AuthRequest>((req, res) =>
    authController.resetPasswordWithCurrent(req, res)
  )
);

export default router;
