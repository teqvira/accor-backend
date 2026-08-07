import pool from '../../database/connection';
import {
  INotification,
  INotificationInboxItem,
  INotificationRecipient,
  NotificationAudience,
  NotificationBroadcastType,
  NotificationPushStatus,
  NotificationType,
} from './notifications.types';

interface NotificationRow {
  id: string;
  code: string | null;
  title: string;
  body: string;
  type: NotificationType;
  broadcast_type: NotificationBroadcastType | null;
  audience: NotificationAudience;
  data: Record<string, unknown> | string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: Date;
}

interface RecipientRow {
  id: string;
  notification_id: string;
  user_id: string;
  is_read: boolean;
  read_at: Date | null;
  push_status: NotificationPushStatus;
  push_error: string | null;
  pushed_at: Date | null;
  created_at: Date;
}

interface InboxRow extends NotificationRow {
  recipient_id: string;
  is_read: boolean;
  read_at: Date | null;
  push_status: NotificationPushStatus;
}

function parseData(
  data: Record<string, unknown> | string | null
): Record<string, unknown> {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return data;
}

function mapNotification(row: NotificationRow): INotification {
  return {
    _id: row.id,
    code: row.code ?? undefined,
    title: row.title,
    body: row.body,
    type: row.type,
    broadcastType: row.broadcast_type ?? undefined,
    audience: row.audience,
    data: parseData(row.data),
    referenceType: row.reference_type ?? undefined,
    referenceId: row.reference_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  };
}

function mapRecipient(row: RecipientRow): INotificationRecipient {
  return {
    _id: row.id,
    notificationId: row.notification_id,
    userId: row.user_id,
    isRead: row.is_read,
    readAt: row.read_at ?? undefined,
    pushStatus: row.push_status,
    pushError: row.push_error ?? undefined,
    pushedAt: row.pushed_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapInbox(row: InboxRow): INotificationInboxItem {
  return {
    ...mapNotification(row),
    recipientId: row.recipient_id,
    isRead: row.is_read,
    readAt: row.read_at ?? undefined,
    pushStatus: row.push_status,
  };
}

const NOTIFICATION_COLUMNS = `
  id, code, title, body, type, broadcast_type, audience, data,
  reference_type, reference_id, created_by, created_at
`;

export const notificationRepository = {
  nextBroadcastCode: async (): Promise<string> => {
    const result = await pool.query<{ n: string }>(
      `SELECT nextval('notification_code_seq')::text AS n`
    );
    const num = Number(result.rows[0]?.n ?? 1);
    return `NFT-${String(num).padStart(4, '0')}`;
  },

  create: async (input: {
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
  }): Promise<INotification | null> => {
    try {
      const result = await pool.query<NotificationRow>(
        `INSERT INTO notifications (
           title, body, type, audience, broadcast_type, code,
           data, reference_type, reference_id, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
         RETURNING ${NOTIFICATION_COLUMNS}`,
        [
          input.title,
          input.body,
          input.type,
          input.audience,
          input.broadcastType ?? null,
          input.code ?? null,
          JSON.stringify(input.data ?? {}),
          input.referenceType ?? null,
          input.referenceId ?? null,
          input.createdBy ?? null,
        ]
      );
      return result.rows[0] ? mapNotification(result.rows[0]) : null;
    } catch (err: unknown) {
      // Unique expiry index — already notified for this campaign/coupon
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === '23505'
      ) {
        return null;
      }
      throw err;
    }
  },

  listAdminBroadcasts: async (filters: {
    page: number;
    limit: number;
    search?: string;
    type?: NotificationBroadcastType;
  }): Promise<{ items: INotification[]; total: number }> => {
    const conditions = [`type = 'admin_broadcast'`];
    const values: unknown[] = [];
    let i = 1;

    if (filters.type) {
      conditions.push(`broadcast_type = $${i++}`);
      values.push(filters.type);
    }

    if (filters.search?.trim()) {
      conditions.push(
        `(title ILIKE $${i} OR body ILIKE $${i} OR COALESCE(code, '') ILIKE $${i})`
      );
      values.push(`%${filters.search.trim()}%`);
      i++;
    }

    const where = conditions.join(' AND ');
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications WHERE ${where}`,
      values
    );

    const offset = (filters.page - 1) * filters.limit;
    const result = await pool.query<NotificationRow>(
      `SELECT ${NOTIFICATION_COLUMNS}
       FROM notifications
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...values, filters.limit, offset]
    );

    return {
      items: result.rows.map(mapNotification),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  addRecipients: async (
    notificationId: string,
    userIds: string[]
  ): Promise<INotificationRecipient[]> => {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return [];

    const result = await pool.query<RecipientRow>(
      `INSERT INTO notification_recipients (notification_id, user_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT (notification_id, user_id) DO NOTHING
       RETURNING id, notification_id, user_id, is_read, read_at,
                 push_status, push_error, pushed_at, created_at`,
      [notificationId, unique]
    );
    return result.rows.map(mapRecipient);
  },

  updatePushStatus: async (
    recipientIds: string[],
    status: NotificationPushStatus,
    pushError?: string | null
  ): Promise<void> => {
    if (recipientIds.length === 0) return;
    await pool.query(
      `UPDATE notification_recipients
       SET push_status = $2,
           push_error = $3,
           pushed_at = CASE WHEN $2 IN ('sent', 'failed', 'skipped') THEN NOW() ELSE pushed_at END
       WHERE id = ANY($1::uuid[])`,
      [recipientIds, status, pushError ?? null]
    );
  },

  findInboxByUserId: async (
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false
  ): Promise<{ items: INotificationInboxItem[]; total: number }> => {
    const offset = (page - 1) * limit;
    const unreadClause = unreadOnly ? 'AND nr.is_read = false' : '';

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM notification_recipients nr
       WHERE nr.user_id = $1 ${unreadClause}`,
      [userId]
    );

    const result = await pool.query<InboxRow>(
      `SELECT n.id, n.code, n.title, n.body, n.type, n.broadcast_type, n.audience, n.data,
              n.reference_type, n.reference_id, n.created_by, n.created_at,
              nr.id AS recipient_id, nr.is_read, nr.read_at, nr.push_status
       FROM notification_recipients nr
       INNER JOIN notifications n ON n.id = nr.notification_id
       WHERE nr.user_id = $1 ${unreadClause}
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      items: result.rows.map(mapInbox),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  countUnread: async (userId: string): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM notification_recipients
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  markRead: async (
    userId: string,
    notificationId: string
  ): Promise<INotificationRecipient | null> => {
    const result = await pool.query<RecipientRow>(
      `UPDATE notification_recipients
       SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND notification_id = $2
       RETURNING id, notification_id, user_id, is_read, read_at,
                 push_status, push_error, pushed_at, created_at`,
      [userId, notificationId]
    );
    return result.rows[0] ? mapRecipient(result.rows[0]) : null;
  },

  markAllRead: async (userId: string): Promise<number> => {
    const result = await pool.query(
      `UPDATE notification_recipients
       SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return result.rowCount ?? 0;
  },

  findAdminIds: async (): Promise<string[]> => {
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM users
       WHERE role IN ('super_admin', 'admin')
         AND is_active = true`
    );
    return result.rows.map((r) => r.id);
  },

  findActivePartnerIds: async (): Promise<string[]> => {
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM users
       WHERE role = 'user'
         AND is_active = true
         AND approval_status = 'approved'`
    );
    return result.rows.map((r) => r.id);
  },

  findActiveDeviceTokensForUsers: async (
    userIds: string[]
  ): Promise<Array<{ userId: string; deviceToken: string; tokenId: string }>> => {
    if (userIds.length === 0) return [];
    const result = await pool.query<{
      id: string;
      user_id: string;
      device_token: string;
    }>(
      `SELECT id, user_id, device_token
       FROM user_device_tokens
       WHERE user_id = ANY($1::uuid[])
         AND is_active = true`,
      [userIds]
    );
    return result.rows.map((r) => ({
      userId: r.user_id,
      deviceToken: r.device_token,
      tokenId: r.id,
    }));
  },

  deactivateDeviceTokens: async (tokens: string[]): Promise<void> => {
    if (tokens.length === 0) return;
    await pool.query(
      `UPDATE user_device_tokens
       SET is_active = false, updated_at = NOW()
       WHERE device_token = ANY($1::text[])
         AND is_active = true`,
      [tokens]
    );
  },

  findCampaignsExpiringWithinHours: async (
    hours: number
  ): Promise<Array<{ id: string; name: string; endDate: Date }>> => {
    const result = await pool.query<{
      id: string;
      name: string;
      end_date: Date;
    }>(
      `SELECT id, name, end_date
       FROM campaigns
       WHERE active = true
         AND end_date > NOW()
         AND end_date <= NOW() + ($1::text || ' hours')::interval`,
      [String(hours)]
    );
    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      endDate: r.end_date,
    }));
  },

  findCouponsExpiringWithinHours: async (
    hours: number
  ): Promise<Array<{ id: string; name: string; endDate: Date }>> => {
    const result = await pool.query<{
      id: string;
      name: string;
      end_date: Date;
    }>(
      `SELECT id,
              COALESCE(NULLIF(coupon_name, ''), name) AS name,
              end_date
       FROM qr_batches
       WHERE active = true
         AND end_date IS NOT NULL
         AND end_date::timestamptz > NOW()
         AND end_date::timestamptz <= NOW() + ($1::text || ' hours')::interval`,
      [String(hours)]
    );
    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      endDate: r.end_date,
    }));
  },
};
