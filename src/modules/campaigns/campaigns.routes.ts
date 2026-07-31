import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { campaignsController } from './campaigns.controller';
import {
  createCampaignSchema,
  listCampaignsQuerySchema,
  updateCampaignSchema,
} from './campaigns.validator';

const router = Router();

router.post(
  '/',
  ...adminOnly,
  validate(createCampaignSchema),
  asyncHandler<AuthRequest>((req, res) => campaignsController.create(req, res))
);

router.get(
  '/',
  ...adminOnly,
  validate(listCampaignsQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) => campaignsController.list(req, res))
);

router.get(
  '/:id',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => campaignsController.getById(req, res))
);

router.patch(
  '/:id',
  ...adminOnly,
  validate(updateCampaignSchema),
  asyncHandler<AuthRequest>((req, res) => campaignsController.update(req, res))
);

router.patch(
  '/:id/active',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    campaignsController.updateActive(req, res)
  )
);

router.delete(
  '/:id',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => campaignsController.delete(req, res))
);

export default router;
