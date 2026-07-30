import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { rewardsAdminController } from './rewards.admin.controller';
import {
  adminRewardListQuerySchema,
  createRewardSchema,
  updateRewardSchema,
} from './rewards.validator';

const router = Router();

router.get(
  '/',
  ...adminOnly,
  validate(adminRewardListQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    rewardsAdminController.listRewards(req, res)
  )
);

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

router.delete(
  '/:rewardId',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    rewardsAdminController.deleteReward(req, res)
  )
);

router.patch(
  '/:rewardId',
  ...adminOnly,
  validate(updateRewardSchema),
  asyncHandler<AuthRequest>((req, res) =>
    rewardsAdminController.updateReward(req, res)
  )
);

export default router;
