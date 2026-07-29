import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { userOnly } from '../auth/guards';
import { redemptionController } from './redemption.controller';
import { redeemSchema } from './redemption.validator';

const router = Router();

router.post(
  '/redeem',
  ...userOnly,
  validate(redeemSchema),
  asyncHandler<AuthRequest>((req, res) => redemptionController.redeem(req, res))
);

export default router;
