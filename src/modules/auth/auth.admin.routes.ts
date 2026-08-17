import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { authController } from './auth.controller';
import { AuthRequest } from './auth.types';
import { adminOnly } from './guards';
import {
  changePasswordSchema,
  createUserSchema,
  updateAdminProfileSchema,
} from './auth.validator';

const router = Router();

router.post(
  '/users',
  ...adminOnly,
  validate(createUserSchema),
  asyncHandler<AuthRequest>((req, res) => authController.createUser(req, res))
);

router.get(
  '/profile',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => authController.getAdminProfile(req, res))
);

router.patch(
  '/profile',
  ...adminOnly,
  validate(updateAdminProfileSchema),
  asyncHandler<AuthRequest>((req, res) => authController.updateAdminProfile(req, res))
);

router.post(
  '/change-password',
  ...adminOnly,
  validate(changePasswordSchema),
  asyncHandler<AuthRequest>((req, res) => authController.changePassword(req, res))
);

export default router;

