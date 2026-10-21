import { Router } from 'express';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { validate } from '../../../shared/middleware/validate';
import { AuthRequest } from '../../auth/auth.types';
import { adminOnly } from '../../auth/guards';
import { withdrawalAdminController } from '../controllers/withdrawal.admin.controller';
import {
  adminCompleteWithdrawalSchema,
  adminListWithdrawalsQuerySchema,
  adminRejectWithdrawalSchema,
} from '../withdrawal.validator';

const router = Router();

router.get(
  '/stats',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    withdrawalAdminController.getStats(req, res)
  )
);

router.get(
  '/',
  ...adminOnly,
  validate(adminListWithdrawalsQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    withdrawalAdminController.list(req, res)
  )
);

router.get(
  '/:id',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    withdrawalAdminController.getById(req, res)
  )
);

router.post(
  '/:id/complete',
  ...adminOnly,
  validate(adminCompleteWithdrawalSchema),
  asyncHandler<AuthRequest>((req, res) =>
    withdrawalAdminController.complete(req, res)
  )
);

router.post(
  '/:id/reject',
  ...adminOnly,
  validate(adminRejectWithdrawalSchema),
  asyncHandler<AuthRequest>((req, res) =>
    withdrawalAdminController.reject(req, res)
  )
);

export default router;
