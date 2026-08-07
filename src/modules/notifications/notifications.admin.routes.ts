import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { notificationsAdminController } from './notifications.controller';
import {
  createAdminNotificationSchema,
  listNotificationsQuerySchema,
} from './notifications.validator';

const router = Router();

/** Admin creates a notification → pushed only to mobile (partner) users. */
router.post(
  '/',
  ...adminOnly,
  validate(createAdminNotificationSchema),
  asyncHandler<AuthRequest>((req, res) =>
    notificationsAdminController.create(req, res)
  )
);

router.get(
  '/',
  ...adminOnly,
  validate(listNotificationsQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    notificationsAdminController.list(req, res)
  )
);

router.get(
  '/unread-count',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    notificationsAdminController.unreadCount(req, res)
  )
);

router.post(
  '/read-all',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    notificationsAdminController.markAllRead(req, res)
  )
);

router.post(
  '/:notificationId/read',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    notificationsAdminController.markRead(req, res)
  )
);

export default router;
