import { PoolClient } from 'pg';
import pool from '../../../database/connection';
import {
  CreateRedemptionTransactionData,
  IRedemptionTransaction,
} from '../types/redemption-transaction.types';

type Queryable = Pick<PoolClient, 'query'>;

interface RedemptionTransactionRow {
  id: string;
  user_id: string;
  qr_code_id: string;
  product_id: string;
  wallet_amount: string | number;
  reward_points: number;
  created_at: Date;
  updated_at: Date;
}

export function mapRedemptionTransactionRow(
  row: RedemptionTransactionRow
): IRedemptionTransaction {
  return {
    _id: row.id,
    userId: row.user_id,
    qrCodeId: row.qr_code_id,
    productId: row.product_id,
    walletAmount: Number(row.wallet_amount),
    rewardPoints: row.reward_points,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TX_COLUMNS = `
  id, user_id, qr_code_id, product_id, wallet_amount, reward_points,
  created_at, updated_at
`;

export const redemptionTransactionRepository = {
  create: async (
    data: CreateRedemptionTransactionData,
    client?: Queryable
  ): Promise<IRedemptionTransaction> => {
    const db = client ?? pool;
    const result = await db.query<RedemptionTransactionRow>(
      `INSERT INTO redemption_transactions
         (user_id, qr_code_id, product_id, wallet_amount, reward_points)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${TX_COLUMNS}`,
      [
        data.userId,
        data.qrCodeId,
        data.productId,
        data.walletAmount,
        data.rewardPoints,
      ]
    );
    return mapRedemptionTransactionRow(result.rows[0]);
  },

  findById: async (id: string): Promise<IRedemptionTransaction | null> => {
    const result = await pool.query<RedemptionTransactionRow>(
      `SELECT ${TX_COLUMNS} FROM redemption_transactions WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapRedemptionTransactionRow(result.rows[0]) : null;
  },

  findByQrCodeId: async (
    qrCodeId: string
  ): Promise<IRedemptionTransaction | null> => {
    const result = await pool.query<RedemptionTransactionRow>(
      `SELECT ${TX_COLUMNS} FROM redemption_transactions WHERE qr_code_id = $1`,
      [qrCodeId]
    );
    return result.rows[0] ? mapRedemptionTransactionRow(result.rows[0]) : null;
  },

  findByUserId: async (
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ items: IRedemptionTransaction[]; total: number }> => {
    const offset = (page - 1) * limit;
    const [itemsResult, countResult] = await Promise.all([
      pool.query<RedemptionTransactionRow>(
        `SELECT ${TX_COLUMNS}
         FROM redemption_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM redemption_transactions
         WHERE user_id = $1`,
        [userId]
      ),
    ]);
    return {
      items: itemsResult.rows.map(mapRedemptionTransactionRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  findAll: async (
    page = 1,
    limit = 20
  ): Promise<{ items: IRedemptionTransaction[]; total: number }> => {
    const offset = (page - 1) * limit;
    const [itemsResult, countResult] = await Promise.all([
      pool.query<RedemptionTransactionRow>(
        `SELECT ${TX_COLUMNS}
         FROM redemption_transactions
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM redemption_transactions`
      ),
    ]);
    return {
      items: itemsResult.rows.map(mapRedemptionTransactionRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  count: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM redemption_transactions`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  findAllWithDetails: async (
    page = 1,
    limit = 20
  ): Promise<{
    items: Array<{
      id: string;
      user: { _id: string; mobileNumber?: string; name?: string };
      qrCode: { _id: string; code: string };
      product: { _id: string; name: string; skuCode: string };
      walletAmount: number;
      rewardPoints: number;
      createdAt: Date;
    }>;
    total: number;
  }> => {
    const offset = (page - 1) * limit;
    const [itemsResult, countResult] = await Promise.all([
      pool.query<{
        id: string;
        wallet_amount: string | number;
        reward_points: number;
        created_at: Date;
        user_id: string;
        mobile_number: string | null;
        user_name: string | null;
        qr_code_id: string;
        code: string;
        product_id: string;
        product_name: string;
        product_sku: string;
      }>(
        `SELECT
           rt.id,
           rt.wallet_amount,
           rt.reward_points,
           rt.created_at,
           u.id AS user_id,
           u.mobile_number,
           u.name AS user_name,
           qc.id AS qr_code_id,
           qc.code,
           p.id AS product_id,
           p.name AS product_name,
           p.sku_code AS product_sku
         FROM redemption_transactions rt
         LEFT JOIN users u ON rt.user_id = u.id
         LEFT JOIN qr_codes qc ON rt.qr_code_id = qc.id
         LEFT JOIN products p ON rt.product_id = p.id
         ORDER BY rt.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM redemption_transactions`
      ),
    ]);

    return {
      items: itemsResult.rows.map((row) => ({
        id: row.id,
        user: {
          _id: row.user_id,
          mobileNumber: row.mobile_number ?? undefined,
          name: row.user_name ?? undefined,
        },
        qrCode: {
          _id: row.qr_code_id,
          code: row.code,
        },
        product: {
          _id: row.product_id,
          name: row.product_name,
          skuCode: row.product_sku,
        },
        walletAmount: Number(row.wallet_amount),
        rewardPoints: row.reward_points,
        createdAt: row.created_at,
      })),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },
};
