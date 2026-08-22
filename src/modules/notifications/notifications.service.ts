import { sendFcmToTokens } from '../../infrastructure/fcm/fcm.client';
import { BadRequestError, NotFoundError } from '../../shared/utils/errors';
import { NOTIFICATION_BROADCAST_TYPES } from './notifications.constants';
import {
  AdminBroadcastListFilters,
  AdminCreateBroadcastInput,
  CreateNotificationInput,
  INotification,
  INotificationInboxItem,
  NotificationType,
} from './notifications.types';
import { notificationRepository } from './notifications.repository';

function navigationFor(
  type: NotificationType,
  data: Record<string, unknown>,
  referenceId?: string
): {
  screen: string;
  tab: number;
  partnerId?: string;
  redemptionId?: string;
} {
  switch (type) {
    case 'partner_request':
      return {
        screen: 'requests',
        tab: 1,
        partnerId: String(data.userId ?? referenceId ?? ''),
      };
    case 'reward_request':
      return {
        screen: 'rewards',
        tab: 2,
        redemptionId: String(data.redemptionId ?? referenceId ?? ''),
      };
    case 'wallet_transaction':
      return {
        screen: 'requests',
        tab: 1,
        partnerId: String(data.userId ?? ''),
      };
    case 'campaign_expiry':
    case 'coupon_expiry':
      return { screen: 'home', tab: 0 };
    default:
      return { screen: 'inbox', tab: 0 };
  }
}

function sanitizeInboxItem(item: INotificationInboxItem) {
  const nav = navigationFor(item.type, item.data, item.referenceId);
  return {
    id: item._id,
    code: item.code ?? null,
    recipientId: item.recipientId,
    title: item.title,
    body: item.body,
    description: item.body,
    type: item.type,
    broadcastType: item.broadcastType ?? null,
    audience: item.audience,
    data: { ...item.data, ...nav },
    referenceType: item.referenceType ?? null,
    referenceId: item.referenceId ?? null,
    screen: nav.screen,
    tab: nav.tab,
    partnerId: nav.partnerId || null,
    redemptionId: nav.redemptionId || null,
    isRead: item.isRead,
    readAt: item.readAt ?? null,
    createdAt: item.createdAt,
  };
}

function sanitizeBroadcastItem(item: INotification) {
  return {
    id: item._id,
    notificationId: item.code ?? item._id,
    code: item.code ?? null,
    title: item.title,
    description: item.body,
    body: item.body,
    type: item.broadcastType ?? null,
    typeLabel:
      item.broadcastType === 'reminder'
        ? 'Reminder'
        : item.broadcastType === 'campaign'
          ? 'Campaign'
          : item.broadcastType === 'info'
            ? 'Info'
            : item.broadcastType === 'alert'
              ? 'Alert'
              : null,
    audience: item.audience,
    data: item.data,
    createdAt: item.createdAt,
  };
}

function fireAndForget(task: Promise<unknown>, label: string): void {
  void task.catch((err) => {
    console.error(
      `[notifications] ${label}:`,
      err instanceof Error ? err.message : err
    );
  });
}

export class NotificationsService {
  /**
   * Persist notification + recipients, then push via FCM (non-blocking for callers
   * that use notify* helpers).
   */
  async createAndPush(input: CreateNotificationInput): Promise<INotification | null> {
    const notification = await notificationRepository.create({
      title: input.title,
      body: input.body,
      type: input.type,
      audience: input.audience,
      broadcastType: input.broadcastType,
      code: input.code,
      data: input.data,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdBy: input.createdBy,
    });

    if (!notification) {
      // Duplicate expiry alert (unique index) — skip quietly
      return null;
    }

    let recipientIds: string[] = [];
    if (input.audience === 'admin') {
      recipientIds = await notificationRepository.findAdminIds();
    } else if (input.audience === 'all_users') {
      recipientIds = await notificationRepository.findActivePartnerIds();
    } else {
      recipientIds = input.recipientUserIds ?? [];
    }

    if (recipientIds.length === 0) {
      return notification;
    }

    const recipients = await notificationRepository.addRecipients(
      notification._id,
      recipientIds
    );

    await this.pushToRecipients(
      recipients.map((r) => ({ id: r._id, userId: r.userId })),
      {
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification._id,
          type: notification.type,
          ...navigationFor(
            notification.type,
            (notification.data ?? {}) as Record<string, unknown>,
            notification.referenceId
          ),
          ...(notification.data as Record<string, string | number | boolean>),
        },
      }
    );

    return notification;
  }

  private async pushToRecipients(
    recipients: Array<{ id: string; userId: string }>,
    payload: {
      title: string;
      body: string;
      data?: Record<string, string | number | boolean | null | undefined>;
    }
  ): Promise<void> {
    if (recipients.length === 0) return;

    const userIds = recipients.map((r) => r.userId);
    const devices =
      await notificationRepository.findActiveDeviceTokensForUsers(userIds);

    if (devices.length === 0) {
      await notificationRepository.updatePushStatus(
        recipients.map((r) => r.id),
        'skipped',
        'No active device tokens'
      );
      return;
    }

    const tokens = devices.map((d) => d.deviceToken);
    const result = await sendFcmToTokens(tokens, {
      title: payload.title,
      body: payload.body,
      data: Object.fromEntries(
        Object.entries(payload.data ?? {}).map(([k, v]) => [
          k,
          v === undefined || v === null ? '' : String(v),
        ])
      ),
    });

    if (result.invalidTokens.length > 0) {
      await notificationRepository.deactivateDeviceTokens(result.invalidTokens);
    }

    const status =
      result.successCount > 0
        ? 'sent'
        : result.failureCount > 0
          ? 'failed'
          : 'skipped';

    await notificationRepository.updatePushStatus(
      recipients.map((r) => r.id),
      status,
      status === 'failed' ? 'FCM delivery failed for one or more tokens' : null
    );
  }

  // ---- Event helpers (Mobile / system → Admin) ----

  notifyPartnerRequest(input: {
    userId: string;
    name?: string;
    mobileNumber?: string;
    userType?: string;
  }): void {
    const who = input.name?.trim() || input.mobileNumber || 'A partner';
    fireAndForget(
      this.createAndPush({
        title: 'New partner request',
        body: `${who} submitted a partner registration for approval`,
        type: 'partner_request',
        audience: 'admin',
        referenceType: 'user',
        referenceId: input.userId,
        data: {
          screen: 'requests',
          tab: 1,
          partnerId: input.userId,
          userId: input.userId,
          name: input.name ?? null,
          mobileNumber: input.mobileNumber ?? null,
          userType: input.userType ?? null,
        },
      }),
      'notifyPartnerRequest'
    );
  }

  notifyRewardRequest(input: {
    userId: string;
    redemptionId: string;
    rewardName: string;
    pointsSpent: number;
    userName?: string;
  }): void {
    const who = input.userName?.trim() || 'A partner';
    fireAndForget(
      this.createAndPush({
        title: 'New reward request',
        body: `${who} requested "${input.rewardName}" (${input.pointsSpent} pts)`,
        type: 'reward_request',
        audience: 'admin',
        referenceType: 'reward_redemption',
        referenceId: input.redemptionId,
        data: {
          screen: 'rewards',
          tab: 2,
          redemptionId: input.redemptionId,
          userId: input.userId,
          rewardName: input.rewardName,
          pointsSpent: input.pointsSpent,
        },
      }),
      'notifyRewardRequest'
    );
  }

  notifyWalletTransaction(input: {
    userId: string;
    transactionId: string;
    amount: number;
    direction: 'credit' | 'debit';
    remarks?: string;
    userName?: string;
  }): void {
    const who = input.userName?.trim() || 'A partner';
    const verb = input.direction === 'credit' ? 'credited' : 'debited';
    fireAndForget(
      this.createAndPush({
        title: 'Wallet transaction',
        body: `${who}: ₹${input.amount.toFixed(2)} ${verb}${
          input.remarks ? ` — ${input.remarks}` : ''
        }`,
        type: 'wallet_transaction',
        audience: 'admin',
        referenceType: 'wallet_transaction',
        referenceId: input.transactionId,
        data: {
          screen: 'requests',
          tab: 1,
          partnerId: input.userId,
          userId: input.userId,
          transactionId: input.transactionId,
          amount: input.amount,
          direction: input.direction,
          remarks: input.remarks ?? null,
        },
      }),
      'notifyWalletTransaction'
    );
  }

  notifyCampaignExpiry(input: {
    campaignId: string;
    name: string;
    endDate: Date;
  }): void {
    fireAndForget(
      this.createAndPush({
        title: 'Campaign expiring soon',
        body: `"${input.name}" ends on ${input.endDate.toISOString()}`,
        type: 'campaign_expiry',
        audience: 'admin',
        referenceType: 'campaign',
        referenceId: input.campaignId,
        data: {
          screen: 'home',
          tab: 0,
          campaignId: input.campaignId,
          name: input.name,
          endDate: input.endDate.toISOString(),
        },
      }),
      'notifyCampaignExpiry'
    );
  }

  notifyCouponExpiry(input: {
    batchId: string;
    name: string;
    endDate: Date;
  }): void {
    fireAndForget(
      this.createAndPush({
        title: 'Coupon batch expiring soon',
        body: `"${input.name}" ends on ${input.endDate.toISOString().slice(0, 10)}`,
        type: 'coupon_expiry',
        audience: 'admin',
        referenceType: 'qr_batch',
        referenceId: input.batchId,
        data: {
          screen: 'home',
          tab: 0,
          batchId: input.batchId,
          name: input.name,
          endDate: input.endDate.toISOString(),
        },
      }),
      'notifyCouponExpiry'
    );
  }

  // ---- Admin → Mobile (explicit create only) ----

  getBroadcastTypes() {
    return { types: [...NOTIFICATION_BROADCAST_TYPES] };
  }

  async createAdminBroadcast(
    adminUserId: string,
    input: AdminCreateBroadcastInput
  ) {
    const description = (input.description ?? input.body ?? '').trim();
    if (!description) {
      throw new BadRequestError(
        'Description is required',
        'createAdminBroadcast: missing description/body'
      );
    }

    const code = await notificationRepository.nextBroadcastCode();
    const hasTargets = input.userIds && input.userIds.length > 0;
    const notification = await this.createAndPush({
      title: input.title.trim(),
      body: description,
      type: 'admin_broadcast',
      broadcastType: input.type,
      code,
      audience: hasTargets ? 'user' : 'all_users',
      recipientUserIds: hasTargets ? input.userIds : undefined,
      createdBy: adminUserId,
      data: {
        ...(input.data ?? {}),
        source: 'admin',
        broadcastType: input.type,
      },
    });

    if (!notification) {
      throw new NotFoundError(
        'Failed to create notification',
        'createAdminBroadcast: insert returned null'
      );
    }

    return sanitizeBroadcastItem(notification);
  }

  async listAdminBroadcasts(filters: AdminBroadcastListFilters = {}) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { items, total } = await notificationRepository.listAdminBroadcasts({
      page,
      limit,
      search: filters.search,
      type: filters.type,
    });

    return {
      items: items.map(sanitizeBroadcastItem),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ---- Inbox APIs ----

  async listInbox(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false
  ) {
    const { items, total } = await notificationRepository.findInboxByUserId(
      userId,
      page,
      limit,
      unreadOnly
    );
    return {
      items: items.map(sanitizeInboxItem),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      unreadCount: await notificationRepository.countUnread(userId),
    };
  }

  async getUnreadCount(userId: string) {
    return { unreadCount: await notificationRepository.countUnread(userId) };
  }

  async markRead(userId: string, notificationId: string) {
    const updated = await notificationRepository.markRead(
      userId,
      notificationId
    );
    if (!updated) {
      throw new NotFoundError(
        'Notification not found',
        `markRead: userId=${userId} notificationId=${notificationId}`
      );
    }
    return { id: notificationId, isRead: true, readAt: updated.readAt };
  }

  async markAllRead(userId: string) {
    const updated = await notificationRepository.markAllRead(userId);
    return { updated };
  }
}

export const notificationsService = new NotificationsService();
