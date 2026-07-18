import { Response, Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { authenticate, requireRoles } from '../auth/auth.middleware';
import { UserRole } from '../auth/index';
import { AuthRequest } from '../auth/auth.types';
import { usersController } from './users.controller';
import {
  listUsersQuerySchema,
  updateUserSchema,
} from './users.validator';

const router = Router();

const adminOnly = [
  authenticate,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
];

const asyncHandler =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

router.get(
  '/',
  ...adminOnly,
  validate(listUsersQuerySchema, 'query'),
  asyncHandler((req, res) => usersController.list(req, res))
);

router.get(
  '/:id',
  ...adminOnly,
  asyncHandler((req, res) => usersController.getById(req, res))
);

router.patch(
  '/:id',
  ...adminOnly,
  validate(updateUserSchema),
  asyncHandler((req, res) => usersController.update(req, res))
);

export default router;
