import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { rewardRedeemLimiter } from '../../shared/middleware/rate-limiters';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { userOnly } from '../auth/guards';
import { rewardsUserController } from './rewards.user.controller';
import {
  redeemRewardSchema,
  rewardStoreQuerySchema,
} from './rewards.validator';

const router = Router();

router.get(
  '/balance',
  ...userOnly,
  asyncHandler<AuthRequest>((req, res) =>
    rewardsUserController.getBalance(req, res)
  )
);

router.get(
  '/transactions',
  ...userOnly,
  asyncHandler<AuthRequest>((req, res) =>
    rewardsUserController.getTransactions(req, res)
  )
);

router.get(
  '/store',
  ...userOnly,
  validate(rewardStoreQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    rewardsUserController.getStore(req, res)
  )
);

router.post(
  '/redeem',
  rewardRedeemLimiter,
  ...userOnly,
  validate(redeemRewardSchema),
  asyncHandler<AuthRequest>((req, res) =>
    rewardsUserController.redeemReward(req, res)
  )
);

export default router;
