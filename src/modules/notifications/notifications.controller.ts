import { Response } from 'express';
import { getParam } from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { notificationsService } from './notifications.service';

export class NotificationsAdminController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    const notification = await notificationsService.createAdminBroadcast(
      req.user!.sub,
      req.body
    );
    sendSuccess(res, 'Notification sent to mobile users', { notification }, 201);
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const unreadOnly = Boolean(req.query.unreadOnly);
    const result = await notificationsService.listInbox(
      req.user!.sub,
      page,
      limit,
      unreadOnly
    );
    sendSuccess(res, 'Notifications fetched successfully', result);
  }

  async unreadCount(req: AuthRequest, res: Response): Promise<void> {
    const result = await notificationsService.getUnreadCount(req.user!.sub);
    sendSuccess(res, 'Unread count fetched successfully', result);
  }

  async markRead(req: AuthRequest, res: Response): Promise<void> {
    const notificationId = getParam(req.params.notificationId);
    const result = await notificationsService.markRead(
      req.user!.sub,
      notificationId
    );
    sendSuccess(res, 'Notification marked as read', result);
  }

  async markAllRead(req: AuthRequest, res: Response): Promise<void> {
    const result = await notificationsService.markAllRead(req.user!.sub);
    sendSuccess(res, 'All notifications marked as read', result);
  }
}

export class NotificationsUserController {
  async list(req: AuthRequest, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const unreadOnly = Boolean(req.query.unreadOnly);
    const result = await notificationsService.listInbox(
      req.user!.sub,
      page,
      limit,
      unreadOnly
    );
    sendSuccess(res, 'Notifications fetched successfully', result);
  }

  async unreadCount(req: AuthRequest, res: Response): Promise<void> {
    const result = await notificationsService.getUnreadCount(req.user!.sub);
    sendSuccess(res, 'Unread count fetched successfully', result);
  }

  async markRead(req: AuthRequest, res: Response): Promise<void> {
    const notificationId = getParam(req.params.notificationId);
    const result = await notificationsService.markRead(
      req.user!.sub,
      notificationId
    );
    sendSuccess(res, 'Notification marked as read', result);
  }

  async markAllRead(req: AuthRequest, res: Response): Promise<void> {
    const result = await notificationsService.markAllRead(req.user!.sub);
    sendSuccess(res, 'All notifications marked as read', result);
  }
}

export const notificationsAdminController = new NotificationsAdminController();
export const notificationsUserController = new NotificationsUserController();
