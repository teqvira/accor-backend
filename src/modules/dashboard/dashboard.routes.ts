import { Response, Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { authenticate, requireRoles } from '../auth/auth.middleware';
import { UserRole } from '../auth/index';
import { AuthRequest } from '../auth/auth.types';
import { dashboardController } from './dashboard.controller';
import { dashboardStatsQuerySchema } from './dashboard.validator';

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
  '/stats',
  ...adminOnly,
  validate(dashboardStatsQuerySchema, 'query'),
  asyncHandler((req, res) => dashboardController.getStats(req, res))
);

export default router;
