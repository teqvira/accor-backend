import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { AuthRequest } from '../auth/auth.types';
import { optionalAuthenticate } from '../auth/auth.middleware';
import { redemptionController } from './redemption.controller';

const router = Router();

router.get(
  '/validate/:code',
  optionalAuthenticate,
  asyncHandler<AuthRequest>((req, res) =>
    redemptionController.validate(req, res)
  )
);

export default router;
