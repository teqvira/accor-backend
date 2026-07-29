import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { userOnly } from '../auth/guards';
import { homeUserController } from './home.user.controller';
import { homeQuerySchema } from './home.validator';

const router = Router();

router.get(
  '/',
  ...userOnly,
  validate(homeQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) => homeUserController.getHome(req, res))
);

export default router;
