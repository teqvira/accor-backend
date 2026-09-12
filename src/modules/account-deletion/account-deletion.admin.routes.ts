import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { accountDeletionAdminController } from './account-deletion.admin.controller';
import { listDeletionRequestsQuerySchema } from './account-deletion.validator';

const router = Router();

router.get(
  '/',
  ...adminOnly,
  validate(listDeletionRequestsQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    accountDeletionAdminController.list(req, res)
  )
);

router.get(
  '/:id',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    accountDeletionAdminController.getById(req, res)
  )
);

router.post(
  '/:id/cancel',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    accountDeletionAdminController.cancel(req, res)
  )
);

router.post(
  '/:id/process',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    accountDeletionAdminController.process(req, res)
  )
);

export default router;
