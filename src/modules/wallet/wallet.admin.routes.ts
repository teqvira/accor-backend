import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { walletAdminController } from './wallet.admin.controller';

const router = Router();

router.get(
  '/users/:userId',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    walletAdminController.getUserWallet(req, res)
  )
);

router.get(
  '/users/:userId/transactions',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    walletAdminController.getUserTransactions(req, res)
  )
);

export default router;
