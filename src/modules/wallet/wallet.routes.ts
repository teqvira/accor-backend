import { Response, Router } from 'express';
import { authenticate, requireRoles } from '../auth/auth.middleware';
import { UserRole } from '../auth/index';
import { AuthRequest } from '../auth/auth.types';
import { walletController } from './wallet.controller';

const router = Router();

const asyncHandler =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

router.get(
  '/balance',
  authenticate,
  requireRoles(UserRole.USER),
  asyncHandler((req, res) => walletController.getBalance(req, res))
);

router.get(
  '/transactions',
  authenticate,
  requireRoles(UserRole.USER),
  asyncHandler((req, res) => walletController.getTransactions(req, res))
);

router.get(
  '/users/:userId',
  authenticate,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  asyncHandler((req, res) => walletController.getUserWallet(req, res))
);

router.get(
  '/users/:userId/transactions',
  authenticate,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  asyncHandler((req, res) => walletController.getUserTransactions(req, res))
);

export default router;
