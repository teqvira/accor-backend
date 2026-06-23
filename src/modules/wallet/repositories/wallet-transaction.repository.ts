import { PoolClient } from 'pg';
import pool from '../../../database/connection';
import {
  CreateWalletTransactionData,
  IWalletTransaction,
  WalletTransactionType,
} from '../types/wallet.types';

type Queryable = Pick<PoolClient, 'query'>;

interface WalletTransactionRow {
  id: string;
  user_id: string;
  amount: string | number;
  type: WalletTransactionType;
  reference_id: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export function mapWalletTransactionRow(
  row: WalletTransactionRow
): IWalletTransaction {
  return {
    _id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    type: row.type,
    referenceId: row.reference_id ?? undefined,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TX_COLUMNS = `
  id, user_id, amount, type, reference_id, description, created_at, updated_at
`;

export const walletTransactionRepository = {
  create: async (
    data: CreateWalletTransactionData,
    client?: Queryable
  ): Promise<IWalletTransaction> => {
    const db = client ?? pool;
    const result = await db.query<WalletTransactionRow>(
      `INSERT INTO wallet_transactions
         (user_id, amount, type, reference_id, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${TX_COLUMNS}`,
      [
        data.userId,
        data.amount,
        data.type,
        data.referenceId ?? null,
        data.description ?? null,
      ]
    );
    return mapWalletTransactionRow(result.rows[0]);
  },

  findById: async (id: string): Promise<IWalletTransaction | null> => {
    const result = await pool.query<WalletTransactionRow>(
      `SELECT ${TX_COLUMNS} FROM wallet_transactions WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapWalletTransactionRow(result.rows[0]) : null;
  },

  findByReferenceId: async (
    referenceId: string
  ): Promise<IWalletTransaction[]> => {
    const result = await pool.query<WalletTransactionRow>(
      `SELECT ${TX_COLUMNS}
       FROM wallet_transactions
       WHERE reference_id = $1
       ORDER BY created_at DESC`,
      [referenceId]
    );
    return result.rows.map(mapWalletTransactionRow);
  },

  findByUserId: async (
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ items: IWalletTransaction[]; total: number }> => {
    const offset = (page - 1) * limit;
    const [itemsResult, countResult] = await Promise.all([
      pool.query<WalletTransactionRow>(
        `SELECT ${TX_COLUMNS}
         FROM wallet_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM wallet_transactions
         WHERE user_id = $1`,
        [userId]
      ),
    ]);
    return {
      items: itemsResult.rows.map(mapWalletTransactionRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  countByUserId: async (userId: string): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM wallet_transactions
       WHERE user_id = $1`,
      [userId]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  sumCredits: async (): Promise<number> => {
    const result = await pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM wallet_transactions
       WHERE type = $1`,
      [WalletTransactionType.CREDIT]
    );
    return Number(result.rows[0]?.total ?? 0);
  },
};
