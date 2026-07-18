import { Response, Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { authenticate, requireRoles } from '../auth/auth.middleware';
import { UserRole } from '../auth/index';
import { AuthRequest } from '../auth/auth.types';
import { qrController } from './qr.controller';
import { createBatchSchema } from './qr.validator';

const router = Router();

const adminOnly = [authenticate, requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN)];

const asyncHandler =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

router.post(
  '/batches',
  ...adminOnly,
  validate(createBatchSchema),
  asyncHandler((req, res) => qrController.createBatch(req, res))
);

router.get(
  '/batches',
  ...adminOnly,
  asyncHandler((req, res) => qrController.listBatches(req, res))
);

router.get(
  '/batches/:id',
  ...adminOnly,
  asyncHandler((req, res) => qrController.getBatch(req, res))
);

router.post(
  '/batches/:id/generate',
  ...adminOnly,
  asyncHandler((req, res) => qrController.generateBatch(req, res))
);

router.get(
  '/batches/:id/stats',
  ...adminOnly,
  asyncHandler((req, res) => qrController.getBatchStats(req, res))
);

router.get(
  '/batches/:id/export',
  ...adminOnly,
  asyncHandler((req, res) => qrController.exportBatch(req, res))
);

router.get(
  '/codes',
  ...adminOnly,
  asyncHandler((req, res) => qrController.listCodes(req, res))
);

export default router;
