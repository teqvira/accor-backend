import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { dashboardController } from './dashboard.controller';
import { dashboardStatsQuerySchema } from './dashboard.validator';

const router = Router();

router.get(
  '/stats',
  ...adminOnly,
  validate(dashboardStatsQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    dashboardController.getStats(req, res)
  )
);

export default router;
