import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler';
import { validate } from '../../shared/middleware/validate';
import { getBearerToken } from '../../shared/utils/bearer-token';
import { AuthRequest } from '../auth/auth.types';
import { userOnly } from '../auth/guards';
import { verifyAccessToken } from '../auth/jwt.util';
import { UserRole } from '../auth/user.types';
import { notificationsUserController } from './notifications.controller';
import { listNotificationsQuerySchema } from './notifications.validator';

const router = Router();

/**
 * If the request carries an Admin token, skip this user router so Express
 * falls through to notificationsAdminRoutes mounted at the same path.
 */
router.use((req: AuthRequest, _res, next) => {
  const token = getBearerToken(req);
  if (token) {
    try {
      const user = verifyAccessToken(token);
      if (
        user &&
        (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN)
      ) {
        return next('router');
      }
    } catch {
      // Ignore token errors here; let downstream route guards handle authentication.
    }
  }
  next();
});

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
