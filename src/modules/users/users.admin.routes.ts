import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { usersAdminController } from './users.admin.controller';
import { listUsersQuerySchema, updateUserSchema } from './users.validator';

const router = Router();

router.get(
  '/',
  ...adminOnly,
  validate(listUsersQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) => usersAdminController.list(req, res))
);

router.get(
  '/:id',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => usersAdminController.getById(req, res))
);

router.patch(
  '/:id',
  ...adminOnly,
  validate(updateUserSchema),
  asyncHandler<AuthRequest>((req, res) => usersAdminController.update(req, res))
);

export default router;
