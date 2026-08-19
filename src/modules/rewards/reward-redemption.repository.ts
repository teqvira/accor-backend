import { PoolClient } from 'pg';
import pool from '../../database/connection';
import {
  CreateRewardRedemptionData,
  IRewardRedemption,
  RewardRedemptionStatus,
} from './rewards.types';

type Queryable = Pick<PoolClient, 'query'>;

interface RewardRedemptionRow {
  id: string;
  user_id: string;
  reward_id: string;
  idempotency_key: string;
  reward_code: string;
  reward_name: string;
  reward_image_url: string | null;
  points_spent: number;
  points_balance_after: number;
  status: RewardRedemptionStatus;
  admin_note: string | null;
  processed_at: Date | null;
  redeemed_at: Date;
  created_at: Date;
  handover_image_url?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_note?: string | null;
  handover_date?: Date | null;
  user_name?: string | null;
  user_mobile_number?: string | null;
}

function mapRow(row: RewardRedemptionRow): IRewardRedemption {
  return {
    _id: row.id,
    userId: row.user_id,
    rewardId: row.reward_id,
    idempotencyKey: row.idempotency_key,
    rewardCode: row.reward_code,
    rewardName: row.reward_name,
    rewardImageUrl: row.reward_image_url,
    pointsSpent: row.points_spent,
    pointsBalanceAfter: row.points_balance_after,
    status: row.status,
    adminNote: row.admin_note,
    processedAt: row.processed_at,
    redeemedAt: row.redeemed_at,
    createdAt: row.created_at,
    handoverImageUrl: row.handover_image_url ?? null,
    recipientName: row.recipient_name ?? null,
    recipientPhone: row.recipient_phone ?? null,
    recipientNote: row.recipient_note ?? null,
    handoverDate: row.handover_date ?? null,
    userName: row.user_name,
    userMobileNumber: row.user_mobile_number,
  };
}

const COLS = `
  id, user_id, reward_id, idempotency_key,
  reward_code, reward_name, reward_image_url,
  points_spent, points_balance_after, status, admin_note,
  processed_at, redeemed_at, created_at,
  handover_image_url, recipient_name, recipient_phone,
  recipient_note, handover_date
`;

export const rewardRedemptionRepository = {
  findByUserAndIdempotencyKey: async (
    userId: string,
    idempotencyKey: string,
    client?: Queryable
  ): Promise<IRewardRedemption | null> => {
    const db = client ?? pool;
    const result = await db.query<RewardRedemptionRow>(
      `SELECT ${COLS} FROM reward_redemptions
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, idempotencyKey]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  findById: async (
    id: string,
    client?: Queryable
  ): Promise<IRewardRedemption | null> => {
    const db = client ?? pool;
    const result = await db.query<RewardRedemptionRow>(
      `SELECT ${COLS} FROM reward_redemptions WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  findByIdForUpdate: async (
    id: string,
    client: Queryable
  ): Promise<IRewardRedemption | null> => {
    const result = await client.query<RewardRedemptionRow>(
      `SELECT ${COLS} FROM reward_redemptions WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  create: async (
    data: CreateRewardRedemptionData,
    client: Queryable
  ): Promise<IRewardRedemption> => {
    const result = await client.query<RewardRedemptionRow>(
      `INSERT INTO reward_redemptions
         (user_id, reward_id, idempotency_key,
          reward_code, reward_name, reward_image_url,
          points_spent, points_balance_after, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLS}`,
      [
        data.userId,
        data.rewardId,
        data.idempotencyKey,
        data.rewardCode,
        data.rewardName,
        data.rewardImageUrl,
        data.pointsSpent,
        data.pointsBalanceAfter,
        data.status ?? 'pending',
      ]
    );
    return mapRow(result.rows[0]);
  },

  findAllAdmin: async (
    page = 1,
    limit = 20,
    filters: {
      status?: RewardRedemptionStatus;
      search?: string;
      rewardId?: string;
    } = {}
  ): Promise<{ items: IRewardRedemption[]; total: number }> => {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (filters.status) {
      conditions.push(`rr.status = $${i++}`);
      values.push(filters.status);
    }

    if (filters.rewardId) {
      conditions.push(`rr.reward_id = $${i++}`);
      values.push(filters.rewardId);
    }

    if (filters.search) {
      conditions.push(
        `(rr.reward_name ILIKE $${i} OR u.name ILIKE $${i} OR u.mobile_number ILIKE $${i})`
      );
      values.push(`%${filters.search}%`);
      i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [itemsResult, countResult] = await Promise.all([
      pool.query<RewardRedemptionRow>(
        `SELECT rr.id, rr.user_id, rr.reward_id, rr.idempotency_key,
                rr.reward_code, rr.reward_name, rr.reward_image_url,
                rr.points_spent, rr.points_balance_after, rr.status, rr.admin_note,
                rr.processed_at, rr.redeemed_at, rr.created_at,
                rr.handover_image_url, rr.recipient_name, rr.recipient_phone,
                rr.recipient_note, rr.handover_date,
                u.name AS user_name, u.mobile_number AS user_mobile_number
         FROM reward_redemptions rr
         LEFT JOIN users u ON u.id = rr.user_id
         ${where}
         ORDER BY rr.redeemed_at DESC
         LIMIT $${i++} OFFSET $${i}`,
        [...values, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM reward_redemptions rr
         LEFT JOIN users u ON u.id = rr.user_id
         ${where}`,
        values
      ),
    ]);

    return {
      items: itemsResult.rows.map(mapRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  updateStatus: async (
    id: string,
    status: RewardRedemptionStatus,
    adminNote: string | null,
    client: Queryable,
    handover?: {
      handoverImageUrl?: string | null;
      recipientName?: string | null;
      recipientPhone?: string | null;
      recipientNote?: string | null;
      handoverDate?: Date | null;
    }
  ): Promise<IRewardRedemption | null> => {
    const result = await client.query<RewardRedemptionRow>(
      `UPDATE reward_redemptions
       SET status = $2,
           admin_note = $3,
           processed_at = NOW(),
           handover_image_url = COALESCE($4, handover_image_url),
           recipient_name = COALESCE($5, recipient_name),
           recipient_phone = COALESCE($6, recipient_phone),
           recipient_note = COALESCE($7, recipient_note),
           handover_date = COALESCE($8, handover_date)
       WHERE id = $1
       RETURNING ${COLS}`,
      [
        id,
        status,
        adminNote,
        handover?.handoverImageUrl ?? null,
        handover?.recipientName ?? null,
        handover?.recipientPhone ?? null,
        handover?.recipientNote ?? null,
        handover?.handoverDate ?? (status === 'gifted' ? new Date() : null),
      ]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  getTotalCount: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM reward_redemptions`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  getCountByStatus: async (
    status: RewardRedemptionStatus
  ): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM reward_redemptions WHERE status = $1`,
      [status]
    );
    return Number(result.rows[0]?.count ?? 0);
  },
};
