import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import {
  accountDeletionUserController,
  appDeleteAccountSchema,
} from '../account-deletion/index';
import { AuthRequest } from '../auth/auth.types';
import { userOnly } from '../auth/guards';
import { usersUserController } from './users.user.controller';
import { completeProfileSchema } from './users.validator';

const router = Router();

router.get(
  '/me',
  ...userOnly,
  asyncHandler<AuthRequest>((req, res) => usersUserController.getMe(req, res))
);

router.patch(
  '/me',
  ...userOnly,
  validate(completeProfileSchema),
  asyncHandler<AuthRequest>((req, res) =>
    usersUserController.completeProfile(req, res)
  )
);

/** Soft-delete own account immediately (Play Store / App Store). */
router.delete(
  '/me',
  ...userOnly,
  validate(appDeleteAccountSchema),
  asyncHandler<AuthRequest>((req, res) =>
    accountDeletionUserController.deleteMe(req, res)
  )
);

export default router;
