export type NotificationType =
  | 'partner_request'
  | 'reward_request'
  | 'wallet_transaction'
  | 'campaign_expiry'
  | 'coupon_expiry'
  | 'admin_broadcast';

/** Admin UI notification types (Create / list filter). */
export type NotificationBroadcastType =
  | 'reminder'
  | 'campaign'
  | 'info'
  | 'alert';

export type NotificationAudience = 'admin' | 'user' | 'all_users';

export type NotificationPushStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'skipped';

export interface INotification {
  _id: string;
  code?: string;
  title: string;
  body: string;
  type: NotificationType;
  broadcastType?: NotificationBroadcastType;
  audience: NotificationAudience;
  data: Record<string, unknown>;
  referenceType?: string;
  referenceId?: string;
  createdBy?: string;
  createdAt: Date;
}

export interface INotificationRecipient {
  _id: string;
  notificationId: string;
  userId: string;
  isRead: boolean;
  readAt?: Date;
  pushStatus: NotificationPushStatus;
  pushError?: string;
  pushedAt?: Date;
  createdAt: Date;
}

export interface INotificationInboxItem extends INotification {
  recipientId: string;
  isRead: boolean;
  readAt?: Date;
  pushStatus: NotificationPushStatus;
}

export interface CreateNotificationInput {
  title: string;
  body: string;
  type: NotificationType;
  audience: NotificationAudience;
  broadcastType?: NotificationBroadcastType;
  code?: string;
  data?: Record<string, unknown>;
  referenceType?: string;
  referenceId?: string;
  createdBy?: string;
  /** When audience is `user`, these user IDs receive the notification. */
  recipientUserIds?: string[];
}

export interface AdminCreateBroadcastInput {
  title: string;
  /** Preferred field from admin UI. */
  description?: string;
  /** Alias for description (API docs). */
  body?: string;
  /** Admin UI type: reminder | campaign | info | alert */
  type: NotificationBroadcastType;
  data?: Record<string, unknown>;
  /** Optional: target specific mobile users. Omit = all active partners. */
  userIds?: string[];
}

export interface AdminBroadcastListFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: NotificationBroadcastType;
}
