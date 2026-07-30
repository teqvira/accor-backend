import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { rewardsAdminController } from './rewards.admin.controller';
import { createRewardSchema } from './rewards.validator';

const router = Router();

router.post(
  '/',
  ...adminOnly,
  validate(createRewardSchema),
  asyncHandler<AuthRequest>((req, res) =>
    rewardsAdminController.createReward(req, res)
  )
);

router.get(
  '/users/:userId',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    rewardsAdminController.getUserRewards(req, res)
  )
);

export default router;
