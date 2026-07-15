import { PoolClient } from 'pg';
import pool from '../../../database/connection';
import {
  CreateRewardTransactionData,
  IRewardTransaction,
  RewardTransactionType,
} from '../types/rewards.types';

type Queryable = Pick<PoolClient, 'query'>;

interface RewardTransactionRow {
  id: string;
  user_id: string;
  points: number;
  type: RewardTransactionType;
  reference_type: IRewardTransaction['referenceType'] | null;
  reference_id: string | null;
  remarks: string | null;
  created_at: Date;
}

export function mapRewardTransactionRow(
  row: RewardTransactionRow
): IRewardTransaction {
  return {
    _id: row.id,
    userId: row.user_id,
    points: row.points,
    type: row.type,
    referenceType: row.reference_type ?? undefined,
    referenceId: row.reference_id ?? undefined,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
  };
}

const TX_COLUMNS = `
  id, user_id, points, type, reference_type, reference_id, remarks, created_at
`;

export const rewardTransactionRepository = {
  create: async (
    data: CreateRewardTransactionData,
    client?: Queryable
  ): Promise<IRewardTransaction> => {
    const db = client ?? pool;
    const result = await db.query<RewardTransactionRow>(
      `INSERT INTO reward_transactions
         (user_id, points, type, reference_type, reference_id, remarks)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${TX_COLUMNS}`,
      [
        data.userId,
        data.points,
        data.type,
        data.referenceType ?? null,
        data.referenceId ?? null,
        data.remarks ?? null,
      ]
    );
    return mapRewardTransactionRow(result.rows[0]);
  },

  findById: async (id: string): Promise<IRewardTransaction | null> => {
    const result = await pool.query<RewardTransactionRow>(
      `SELECT ${TX_COLUMNS} FROM reward_transactions WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapRewardTransactionRow(result.rows[0]) : null;
  },

  findByReferenceId: async (
    referenceId: string
  ): Promise<IRewardTransaction[]> => {
    const result = await pool.query<RewardTransactionRow>(
      `SELECT ${TX_COLUMNS}
       FROM reward_transactions
       WHERE reference_id = $1
       ORDER BY created_at DESC`,
      [referenceId]
    );
    return result.rows.map(mapRewardTransactionRow);
  },

  findByUserId: async (
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ items: IRewardTransaction[]; total: number }> => {
    const offset = (page - 1) * limit;
    const [itemsResult, countResult] = await Promise.all([
      pool.query<RewardTransactionRow>(
        `SELECT ${TX_COLUMNS}
         FROM reward_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM reward_transactions
         WHERE user_id = $1`,
        [userId]
      ),
    ]);
    return {
      items: itemsResult.rows.map(mapRewardTransactionRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  countByUserId: async (userId: string): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM reward_transactions
       WHERE user_id = $1`,
      [userId]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  sumCredits: async (): Promise<number> => {
    const result = await pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(points), 0)::text AS total
       FROM reward_transactions
       WHERE type = $1`,
      [RewardTransactionType.CREDIT]
    );
    return Number(result.rows[0]?.total ?? 0);
  },
};
