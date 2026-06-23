import { Response, Router } from 'express';
import { authenticate, requireRoles } from '../../auth/middleware/auth.middleware';
import { UserRole } from '../../auth';
import { AuthRequest } from '../../auth/types/auth.types';
import { transactionsController } from '../controllers/transactions.controller';

const router = Router();

const adminOnly = [authenticate, requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN)];

const asyncHandler =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

router.get(
  '/redemptions',
  ...adminOnly,
  asyncHandler((req, res) => transactionsController.listRedemptions(req, res))
);

router.get(
  '/activity',
  ...adminOnly,
  asyncHandler((req, res) => transactionsController.getActivity(req, res))
);

export default router;
