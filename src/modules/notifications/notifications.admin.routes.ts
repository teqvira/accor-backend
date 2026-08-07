import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { AuthRequest } from '../auth/auth.types';
import { adminOnly } from '../auth/guards';
import { notificationsAdminController } from './notifications.controller';
import {
  createAdminNotificationSchema,
  listAdminBroadcastsQuerySchema,
  listNotificationsQuerySchema,
} from './notifications.validator';

const router = Router();

/** Static types for Create Notification dropdown */
router.get(
  '/types',
  ...adminOnly,
  asyncHandler<AuthRequest>((req, res) =>
    notificationsAdminController.getTypes(req, res)
  )
);

/** Personal inbox (system alerts to admin) */
router.get(
  '/inbox',
  ...adminOnly,
  validate(listNotificationsQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    notificationsAdminController.listInbox(req, res)
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

/**
 * Admin management list (screenshot table).
 * Supports search + type filter (reminder | campaign | info | alert).
 */
router.get(
  '/',
  ...adminOnly,
  validate(listAdminBroadcastsQuerySchema, 'query'),
  asyncHandler<AuthRequest>((req, res) =>
    notificationsAdminController.listBroadcasts(req, res)
  )
);

/** Create notification → push to mobile users */
router.post(
  '/',
  ...adminOnly,
  validate(createAdminNotificationSchema),
  asyncHandler<AuthRequest>((req, res) =>
    notificationsAdminController.create(req, res)
  )
);

export default router;
