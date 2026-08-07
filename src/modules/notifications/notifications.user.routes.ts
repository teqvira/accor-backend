import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { userOnly } from '../auth/guards';
import { notificationsUserController } from './notifications.controller';
import { listNotificationsQuerySchema } from './notifications.validator';

const router = Router();

router.get(
  '/',
  ...userOnly,
  validate(listNotificationsQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    notificationsUserController.list(req, res)
  )
);

router.get(
  '/unread-count',
  ...userOnly,
  asyncHandler<AuthRequest>((req, res) =>
    notificationsUserController.unreadCount(req, res)
  )
);

router.post(
  '/read-all',
  ...userOnly,
  asyncHandler<AuthRequest>((req, res) =>
    notificationsUserController.markAllRead(req, res)
  )
);

router.post(
  '/:notificationId/read',
  ...userOnly,
  asyncHandler<AuthRequest>((req, res) =>
    notificationsUserController.markRead(req, res)
  )
);

export default router;
