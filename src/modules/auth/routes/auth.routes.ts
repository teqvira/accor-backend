import { Response, Router } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authController } from '../controllers/auth.controller';
import {
  authenticate,
  optionalAuthenticate,
  requireBearerToken,
  requireRoles,
} from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import {
  createUserSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resendMobileOtpSchema,
  resetPasswordWithCurrentSchema,
  resetPasswordWithTokenSchema,
  sendMobileOtpSchema,
  verifyMobileOtpSchema,
  verifyPasswordOtpSchema,
} from '../validators/auth.validator';

const router = Router();

const asyncHandler =
  (fn: (req: Parameters<typeof authController.login>[0], res: Response) => Promise<void>) =>
  (req: Parameters<typeof authController.login>[0], res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

router.post(
  '/users',
  authenticate,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate(createUserSchema),
  asyncHandler((req, res) => authController.createUser(req, res))
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler((req, res) => authController.login(req, res))
);

router.post(
  '/send-mobile-otp',
  optionalAuthenticate,
  validate(sendMobileOtpSchema),
  asyncHandler((req, res) => authController.sendMobileOtp(req, res))
);

router.post(
  '/resend-mobile-otp',
  optionalAuthenticate,
  validate(resendMobileOtpSchema),
  asyncHandler((req, res) => authController.resendMobileOtp(req, res))
);

router.post(
  '/verify-mobile-otp',
  optionalAuthenticate,
  validate(verifyMobileOtpSchema),
  asyncHandler((req, res) => authController.verifyMobileOtp(req, res))
);

router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  asyncHandler((req, res) => authController.refreshToken(req, res))
);

router.post(
  '/logout',
  requireBearerToken,
  asyncHandler((req, res) => authController.logout(req, res))
);

router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  asyncHandler((req, res) => authController.forgotPassword(req, res))
);

router.post(
  '/verify-otp',
  validate(verifyPasswordOtpSchema),
  asyncHandler((req, res) => authController.verifyPasswordOtp(req, res))
);

router.post(
  '/reset-password/otp',
  validate(resetPasswordWithTokenSchema),
  asyncHandler((req, res) => authController.resetPasswordWithToken(req, res))
);

router.post(
  '/reset-password',
  authenticate,
  validate(resetPasswordWithCurrentSchema),
  asyncHandler((req, res) => authController.resetPasswordWithCurrent(req, res))
);

export default router;
