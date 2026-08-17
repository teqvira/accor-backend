import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { walletAdminController } from './wallet.admin.controller';
import {
  adminWalletScansQuerySchema,
  createWalletOrderSchema,
  verifyWalletPaymentSchema,
} from './wallet.validator';

const router = Router();

router.get(
  '/kpis',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    walletAdminController.getKpis(req, res)
  )
);

router.get(
  '/scans',
  ...adminOnly,
  validate(adminWalletScansQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    walletAdminController.listScans(req, res)
  )
);

router.get(
  '/topup-details',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    walletAdminController.getTopupDetails(req, res)
  )
);

router.post(
  '/create-order',
  ...adminOnly,
  validate(createWalletOrderSchema),
  asyncHandler<AuthRequest>((req, res) =>
    walletAdminController.createOrder(req, res)
  )
);

router.post(
  '/verify-payment',
  ...adminOnly,
  validate(verifyWalletPaymentSchema),
  asyncHandler<AuthRequest>((req, res) =>
    walletAdminController.verifyPayment(req, res)
  )
);

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


