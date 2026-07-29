import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { rewardsAdminController } from './rewards.admin.controller';

const router = Router();

router.get(
  '/users/:userId',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    rewardsAdminController.getUserRewards(req, res)
  )
);

export default router;
