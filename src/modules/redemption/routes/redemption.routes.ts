import { Response, Router } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate, requireRoles } from '../../auth/middleware/auth.middleware';
import { UserRole } from '../../auth/models/user.model';
import { AuthRequest } from '../../auth/types/auth.types';
import { redemptionController } from '../controllers/redemption.controller';
import { redeemSchema } from '../validators/redemption.validator';

const router = Router();

const asyncHandler =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

router.get(
  '/validate/:code',
  asyncHandler((req, res) => redemptionController.validate(req, res))
);

router.post(
  '/redeem',
  authenticate,
  requireRoles(UserRole.USER),
  validate(redeemSchema),
  asyncHandler((req, res) => redemptionController.redeem(req, res))
);

export default router;
