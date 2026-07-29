import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { authController } from './auth.controller';
import { AuthRequest } from './auth.types';
import { adminOnly } from './guards';
import { createUserSchema } from './auth.validator';

const router = Router();

router.post(
  '/users',
  ...adminOnly,
  validate(createUserSchema),
  asyncHandler<AuthRequest>((req, res) => authController.createUser(req, res))
);

export default router;
