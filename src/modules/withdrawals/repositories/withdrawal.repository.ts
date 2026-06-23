import { PoolClient } from 'pg';
import pool from '../../../database/connection';
import { PayoutMethod, WithdrawalStatus } from '../constants/withdrawal.constants';
import {
  CreateWithdrawalData,
  IWithdrawal,
} from '../types/withdrawal.types';

type Queryable = Pick<PoolClient, 'query'>;

interface WithdrawalRow {
  id: string;
  user_id: string;
  amount: string | number;
  method: PayoutMethod;
  status: WithdrawalStatus;
  provider: string;
  provider_payout_id: string | null;
  provider_reference_id: string;
  failure_reason: string | null;
  payout_destination: unknown;
  created_at: Date;
  updated_at: Date;
}

function parsePayoutDestination(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

export function mapWithdrawalRow(row: WithdrawalRow): IWithdrawal {
  return {
    _id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    method: row.method,
    status: row.status,
    provider: row.provider as IWithdrawal['provider'],
    providerPayoutId: row.provider_payout_id ?? undefined,
    providerReferenceId: row.provider_reference_id,
    failureReason: row.failure_reason ?? undefined,
    payoutDestination: parsePayoutDestination(row.payout_destination),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const WITHDRAWAL_COLUMNS = `
  id, user_id, amount, method, status, provider, provider_payout_id,
  provider_reference_id, failure_reason, payout_destination, created_at, updated_at
`;

export const withdrawalRepository = {
  create: async (
    data: CreateWithdrawalData,
    client?: Queryable
  ): Promise<IWithdrawal> => {
    const db = client ?? pool;
    const result = await db.query<WithdrawalRow>(
      `INSERT INTO withdrawals
         (user_id, amount, method, status, provider, provider_reference_id, payout_destination)
       VALUES ($1, $2, $3, $4, $5, $6, to_jsonb($7::text))
       RETURNING ${WITHDRAWAL_COLUMNS}`,
      [
        data.userId,
        data.amount,
        data.method,
        data.status,
        data.provider,
        data.providerReferenceId,
        data.payoutDestination,
      ]
    );
    return mapWithdrawalRow(result.rows[0]);
  },

  findById: async (
    id: string,
    client?: Queryable
  ): Promise<IWithdrawal | null> => {
    const db = client ?? pool;
    const result = await db.query<WithdrawalRow>(
      `SELECT ${WITHDRAWAL_COLUMNS} FROM withdrawals WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapWithdrawalRow(result.rows[0]) : null;
  },

  findByUserId: async (
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ items: IWithdrawal[]; total: number }> => {
    const offset = (page - 1) * limit;
    const [itemsResult, countResult] = await Promise.all([
      pool.query<WithdrawalRow>(
        `SELECT ${WITHDRAWAL_COLUMNS}
         FROM withdrawals
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM withdrawals WHERE user_id = $1`,
        [userId]
      ),
    ]);
    return {
      items: itemsResult.rows.map(mapWithdrawalRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  findPendingByUserId: async (
    userId: string
  ): Promise<IWithdrawal | null> => {
    const result = await pool.query<WithdrawalRow>(
      `SELECT ${WITHDRAWAL_COLUMNS}
       FROM withdrawals
       WHERE user_id = $1
         AND status IN ($2, $3)
       LIMIT 1`,
      [userId, WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING]
    );
    return result.rows[0] ? mapWithdrawalRow(result.rows[0]) : null;
  },

  findByProviderReferenceId: async (
    providerReferenceId: string
  ): Promise<IWithdrawal | null> => {
    const result = await pool.query<WithdrawalRow>(
      `SELECT ${WITHDRAWAL_COLUMNS}
       FROM withdrawals
       WHERE provider_reference_id = $1`,
      [providerReferenceId]
    );
    return result.rows[0] ? mapWithdrawalRow(result.rows[0]) : null;
  },

  findByProviderReferenceOrPayoutId: async (
    transferId: string
  ): Promise<IWithdrawal | null> => {
    const result = await pool.query<WithdrawalRow>(
      `SELECT ${WITHDRAWAL_COLUMNS}
       FROM withdrawals
       WHERE provider_reference_id = $1 OR provider_payout_id = $1`,
      [transferId]
    );
    return result.rows[0] ? mapWithdrawalRow(result.rows[0]) : null;
  },

  countByUserId: async (userId: string): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM withdrawals WHERE user_id = $1`,
      [userId]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  updateStatus: async (
    id: string,
    status: WithdrawalStatus,
    client?: Queryable
  ): Promise<IWithdrawal | null> => {
    const db = client ?? pool;
    const result = await db.query<WithdrawalRow>(
      `UPDATE withdrawals
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING ${WITHDRAWAL_COLUMNS}`,
      [id, status]
    );
    return result.rows[0] ? mapWithdrawalRow(result.rows[0]) : null;
  },

  updateProviderDetails: async (
    id: string,
    data: {
      providerPayoutId?: string;
      status: WithdrawalStatus;
    }
  ): Promise<IWithdrawal | null> => {
    const result = await pool.query<WithdrawalRow>(
      `UPDATE withdrawals
       SET provider_payout_id = COALESCE($2, provider_payout_id),
           status = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${WITHDRAWAL_COLUMNS}`,
      [id, data.providerPayoutId ?? null, data.status]
    );
    return result.rows[0] ? mapWithdrawalRow(result.rows[0]) : null;
  },

  updateFailure: async (
    id: string,
    status: WithdrawalStatus,
    failureReason: string,
    client?: Queryable
  ): Promise<IWithdrawal | null> => {
    const db = client ?? pool;
    const result = await db.query<WithdrawalRow>(
      `UPDATE withdrawals
       SET status = $2, failure_reason = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING ${WITHDRAWAL_COLUMNS}`,
      [id, status, failureReason]
    );
    return result.rows[0] ? mapWithdrawalRow(result.rows[0]) : null;
  },
};
