import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { qrController } from './qr.controller';
import { createBatchSchema, updateBatchSchema } from './qr.validator';

const router = Router();

router.post(
  '/batches',
  ...adminOnly,
  validate(createBatchSchema),
  asyncHandler<AuthRequest>((req, res) => qrController.createBatch(req, res))
);

router.get(
  '/batches',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => qrController.listBatches(req, res))
);

router.get(
  '/batches-option',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => qrController.getBatchesOptions(req, res))
);

router.get(
  '/batches-option/:productId',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => qrController.getBatchesOptions(req, res))
);

router.get(
  '/batches/:id',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => qrController.getBatch(req, res))
);

router.patch(
  '/batches/:id',
  ...adminOnly,
  validate(updateBatchSchema),
  asyncHandler<AuthRequest>((req, res) => qrController.updateBatch(req, res))
);

router.post(
  '/batches/:id/generate',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => qrController.generateBatch(req, res))
);

router.get(
  '/batches/:id/stats',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => qrController.getBatchStats(req, res))
);

router.get(
  '/batches/:id/export',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => qrController.exportBatch(req, res))
);

router.get(
  '/codes',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => qrController.listCodes(req, res))
);

export default router;
