import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
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

export default router;
