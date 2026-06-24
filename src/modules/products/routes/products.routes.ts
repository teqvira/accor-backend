import { Response, Router } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate, requireRoles } from '../../auth/middleware/auth.middleware';
import { UserRole } from '../../auth';
import { AuthRequest } from '../../auth/types/auth.types';
import { productsController } from '../controllers/products.controller';
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from '../validators/products.validator';

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
  validate(createProductSchema),
  asyncHandler((req, res) => productsController.create(req, res))
);

router.get(
  '/',
  ...adminOnly,
  validate(listProductsQuerySchema, 'query'),
  asyncHandler((req, res) => productsController.list(req, res))
);

router.get(
  '/:id',
  ...adminOnly,
  asyncHandler((req, res) => productsController.getById(req, res))
);

router.patch(
  '/:id',
  ...adminOnly,
  validate(updateProductSchema),
  asyncHandler((req, res) => productsController.update(req, res))
);

router.patch(
  '/:id/activate',
  ...adminOnly,
  asyncHandler((req, res) => productsController.activate(req, res))
);

router.patch(
  '/:id/deactivate',
  ...adminOnly,
  asyncHandler((req, res) => productsController.deactivate(req, res))
);

export default router;
