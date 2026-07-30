import { PoolClient } from 'pg';
import pool from '../../database/connection';
import {
  CreateRewardRedemptionData,
  IRewardRedemption,
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
  redeemed_at: Date;
  created_at: Date;
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
    redeemedAt: row.redeemed_at,
    createdAt: row.created_at,
  };
}

const COLS = `
  id, user_id, reward_id, idempotency_key,
  reward_code, reward_name, reward_image_url,
  points_spent, points_balance_after, redeemed_at, created_at
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

  create: async (
    data: CreateRewardRedemptionData,
    client: Queryable
  ): Promise<IRewardRedemption> => {
    const result = await client.query<RewardRedemptionRow>(
      `INSERT INTO reward_redemptions
         (user_id, reward_id, idempotency_key,
          reward_code, reward_name, reward_image_url,
          points_spent, points_balance_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      ]
    );
    return mapRow(result.rows[0]);
  },

  getTotalCount: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM reward_redemptions`
    );
    return Number(result.rows[0]?.count ?? 0);
  },
};

