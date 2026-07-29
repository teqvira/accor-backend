import { Router } from 'express';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { withdrawLimiter } from '../../../shared/middleware/rate-limiters';
import { validate } from '../../../shared/middleware/validate';
import { AuthRequest } from '../../auth/auth.types';
import { userOnly } from '../../auth/guards';
import { withdrawalController } from '../controllers/withdrawal.controller';
import {
  createWithdrawalSchema,
  savePayoutProfileSchema,
} from '../withdrawal.validator';

const router = Router();

router.post(
  '/payout-profile',
  withdrawLimiter,
  ...userOnly,
  validate(savePayoutProfileSchema),
  asyncHandler<AuthRequest>((req, res) =>
    withdrawalController.savePayoutProfile(req, res)
  )
);

router.get(
  '/payout-profile',
  withdrawLimiter,
  ...userOnly,
  asyncHandler<AuthRequest>((req, res) =>
    withdrawalController.getPayoutProfile(req, res)
  )
);

router.post(
  '/withdraw',
  withdrawLimiter,
  ...userOnly,
  validate(createWithdrawalSchema),
  asyncHandler<AuthRequest>((req, res) =>
    withdrawalController.withdraw(req, res)
  )
);

router.get(
  '/withdrawals',
  withdrawLimiter,
  ...userOnly,
  asyncHandler<AuthRequest>((req, res) =>
    withdrawalController.listWithdrawals(req, res)
  )
);

export default router;
