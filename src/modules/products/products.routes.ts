import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { productsController } from './products.controller';
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from './products.validator';

const router = Router();

router.post(
  '/',
  ...adminOnly,
  validate(createProductSchema),
  asyncHandler<AuthRequest>((req, res) => productsController.create(req, res))
);

router.get(
  '/',
  ...adminOnly,
  validate(listProductsQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) => productsController.list(req, res))
);

router.get(
  '/:id',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => productsController.getById(req, res))
);

router.patch(
  '/:id',
  ...adminOnly,
  validate(updateProductSchema),
  asyncHandler<AuthRequest>((req, res) => productsController.update(req, res))
);

router.patch(
  '/:id/activate',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) => productsController.activate(req, res))
);

router.patch(
  '/:id/deactivate',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    productsController.deactivate(req, res)
  )
);

export default router;
