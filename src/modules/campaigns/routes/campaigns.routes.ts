import { Response, Router } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate, requireRoles } from '../../auth/middleware/auth.middleware';
import { UserRole } from '../../auth';
import { AuthRequest } from '../../auth/types/auth.types';
import { campaignsController } from '../controllers/campaigns.controller';
import {
  createCampaignSchema,
  updateCampaignSchema,
} from '../validators/campaigns.validator';

const router = Router();

const adminOnly = [authenticate, requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN)];

const asyncHandler =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

router.post(
  '/',
  ...adminOnly,
  validate(createCampaignSchema),
  asyncHandler((req, res) => campaignsController.create(req, res))
);

router.get(
  '/',
  ...adminOnly,
  asyncHandler((req, res) => campaignsController.list(req, res))
);

router.get(
  '/:id',
  ...adminOnly,
  asyncHandler((req, res) => campaignsController.getById(req, res))
);

router.patch(
  '/:id',
  ...adminOnly,
  validate(updateCampaignSchema),
  asyncHandler((req, res) => campaignsController.update(req, res))
);

router.patch(
  '/:id/activate',
  ...adminOnly,
  asyncHandler((req, res) => campaignsController.activate(req, res))
);

router.patch(
  '/:id/deactivate',
  ...adminOnly,
  asyncHandler((req, res) => campaignsController.deactivate(req, res))
);

export default router;
