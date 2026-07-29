import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { userOnly } from '../auth/guards';
import { walletUserController } from './wallet.user.controller';
import { walletSummaryQuerySchema } from './wallet.validator';

const router = Router();

router.get(
  '/balance',
  ...userOnly,
  asyncHandler<AuthRequest>((req, res) =>
    walletUserController.getBalance(req, res)
  )
);

router.get(
  '/summary',
  ...userOnly,
  validate(walletSummaryQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    walletUserController.getSummary(req, res)
  )
);

router.get(
  '/transactions',
  ...userOnly,
  asyncHandler<AuthRequest>((req, res) =>
    walletUserController.getTransactions(req, res)
  )
);

export default router;
