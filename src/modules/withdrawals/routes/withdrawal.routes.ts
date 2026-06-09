import { Response, Router } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate, requireRoles } from '../../auth/middleware/auth.middleware';
import { UserRole } from '../../auth/models/user.model';
import { AuthRequest } from '../../auth/types/auth.types';
import { withdrawalController } from '../controllers/withdrawal.controller';
import {
  createWithdrawalSchema,
  savePayoutProfileSchema,
} from '../validators/withdrawal.validator';

const router = Router();

const userOnly = [authenticate, requireRoles(UserRole.USER)];

const asyncHandler =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

router.post(
  '/payout-profile',
  ...userOnly,
  validate(savePayoutProfileSchema),
  asyncHandler((req, res) => withdrawalController.savePayoutProfile(req, res))
);

router.get(
  '/payout-profile',
  ...userOnly,
  asyncHandler((req, res) => withdrawalController.getPayoutProfile(req, res))
);

router.post(
  '/withdraw',
  ...userOnly,
  validate(createWithdrawalSchema),
  asyncHandler((req, res) => withdrawalController.withdraw(req, res))
);

router.get(
  '/withdrawals',
  ...userOnly,
  asyncHandler((req, res) => withdrawalController.listWithdrawals(req, res))
);

export default router;
