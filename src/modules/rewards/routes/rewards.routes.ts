import { Response, Router } from 'express';
import { authenticate, requireRoles } from '../../auth/middleware/auth.middleware';
import { UserRole } from '../../auth/models/user.model';
import { AuthRequest } from '../../auth/types/auth.types';
import { rewardsController } from '../controllers/rewards.controller';

const router = Router();

const asyncHandler =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

router.get(
  '/balance',
  authenticate,
  requireRoles(UserRole.USER),
  asyncHandler((req, res) => rewardsController.getBalance(req, res))
);

router.get(
  '/transactions',
  authenticate,
  requireRoles(UserRole.USER),
  asyncHandler((req, res) => rewardsController.getTransactions(req, res))
);

router.get(
  '/users/:userId',
  authenticate,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  asyncHandler((req, res) => rewardsController.getUserRewards(req, res))
);

export default router;
