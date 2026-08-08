import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { dashboardController } from './dashboard.controller';
import {
  dashboardOverviewQuerySchema,
  dashboardStatsQuerySchema,
} from './dashboard.validator';

const router = Router();

/** Admin home dashboard (summary + partner requests + scan distribution). */
router.get(
  '/',
  ...adminOnly,
  validate(dashboardOverviewQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    dashboardController.getOverview(req, res)
  )
);

/** Same overview payload — alias for clients that expect /stats. */
router.get(
  '/overview',
  ...adminOnly,
  validate(dashboardOverviewQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    dashboardController.getOverview(req, res)
  )
);

/** Legacy charts/cards stats (kept for older admin screens). */
router.get(
  '/stats',
  ...adminOnly,
  validate(dashboardStatsQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    dashboardController.getStats(req, res)
  )
);

export default router;
