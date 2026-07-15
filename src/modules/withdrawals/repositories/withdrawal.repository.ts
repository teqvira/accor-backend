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
  payout_profile_id: string;
  amount: string | number;
  status: WithdrawalStatus;
  transaction_reference: string | null;
  remarks: string | null;
  provider: string | null;
  provider_payout_id: string | null;
  requested_at: Date;
  processed_at: Date | null;
  created_at: Date;
  account_type?: PayoutMethod | null;
  upi_id?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
}

function resolvePayoutDestination(row: WithdrawalRow): string {
  if (row.account_type === PayoutMethod.UPI) {
    return row.upi_id ?? '';
  }
  if (row.account_number || row.ifsc_code) {
    const masked =
      row.account_number && row.account_number.length > 4
        ? `****${row.account_number.slice(-4)}`
        : '****';
    return `${masked}@${row.ifsc_code ?? ''}`;
  }
  return '';
}

export function mapWithdrawalRow(row: WithdrawalRow): IWithdrawal {
  return {
    _id: row.id,
    userId: row.user_id,
    payoutProfileId: row.payout_profile_id,
    amount: Number(row.amount),
    method: row.account_type ?? PayoutMethod.UPI,
    status: row.status,
    provider: (row.provider as IWithdrawal['provider']) ?? undefined,
    providerPayoutId: row.provider_payout_id ?? undefined,
    providerReferenceId: row.transaction_reference ?? '',
    failureReason: row.remarks ?? undefined,
    payoutDestination: resolvePayoutDestination(row),
    requestedAt: row.requested_at,
    processedAt: row.processed_at ?? undefined,
    createdAt: row.created_at,
  };
}

const WITHDRAWAL_COLUMNS = `
  w.id, w.user_id, w.payout_profile_id, w.amount, w.status,
  w.transaction_reference, w.remarks, w.provider, w.provider_payout_id,
  w.requested_at, w.processed_at, w.created_at,
  p.account_type, p.upi_id, p.account_number, p.ifsc_code
`;

const WITHDRAWAL_FROM = `
  FROM withdrawals w
  LEFT JOIN payout_profiles p ON p.id = w.payout_profile_id
`;

export const withdrawalRepository = {
  create: async (
    data: CreateWithdrawalData,
    client?: Queryable
  ): Promise<IWithdrawal> => {
    const db = client ?? pool;
    const result = await db.query<WithdrawalRow>(
      `WITH inserted AS (
         INSERT INTO withdrawals
           (user_id, payout_profile_id, amount, status, provider, transaction_reference)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *
       )
       SELECT
         i.id, i.user_id, i.payout_profile_id, i.amount, i.status,
         i.transaction_reference, i.remarks, i.provider, i.provider_payout_id,
         i.requested_at, i.processed_at, i.created_at,
         p.account_type, p.upi_id, p.account_number, p.ifsc_code
       FROM inserted i
       LEFT JOIN payout_profiles p ON p.id = i.payout_profile_id`,
      [
        data.userId,
        data.payoutProfileId,
        data.amount,
        data.status,
        data.provider ?? null,
        data.providerReferenceId,
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
      `SELECT ${WITHDRAWAL_COLUMNS} ${WITHDRAWAL_FROM} WHERE w.id = $1`,
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
         ${WITHDRAWAL_FROM}
         WHERE w.user_id = $1
         ORDER BY w.created_at DESC
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
       ${WITHDRAWAL_FROM}
       WHERE w.user_id = $1
         AND w.status IN ($2, $3)
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
       ${WITHDRAWAL_FROM}
       WHERE w.transaction_reference = $1`,
      [providerReferenceId]
    );
    return result.rows[0] ? mapWithdrawalRow(result.rows[0]) : null;
  },

  findByProviderReferenceOrPayoutId: async (
    transferId: string
  ): Promise<IWithdrawal | null> => {
    const result = await pool.query<WithdrawalRow>(
      `SELECT ${WITHDRAWAL_COLUMNS}
       ${WITHDRAWAL_FROM}
       WHERE w.transaction_reference = $1 OR w.provider_payout_id = $1`,
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
    await db.query(
      `UPDATE withdrawals
       SET status = $2,
           processed_at = CASE
             WHEN $2 IN ('success', 'failed') THEN NOW()
             ELSE processed_at
           END
       WHERE id = $1`,
      [id, status]
    );
    return withdrawalRepository.findById(id, client);
  },

  updateProviderDetails: async (
    id: string,
    data: {
      providerPayoutId?: string;
      status: WithdrawalStatus;
    }
  ): Promise<IWithdrawal | null> => {
    await pool.query(
      `UPDATE withdrawals
       SET provider_payout_id = COALESCE($2, provider_payout_id),
           status = $3,
           processed_at = CASE
             WHEN $3 IN ('success', 'failed') THEN NOW()
             ELSE processed_at
           END
       WHERE id = $1`,
      [id, data.providerPayoutId ?? null, data.status]
    );
    return withdrawalRepository.findById(id);
  },

  updateFailure: async (
    id: string,
    status: WithdrawalStatus,
    failureReason: string,
    client?: Queryable
  ): Promise<IWithdrawal | null> => {
    const db = client ?? pool;
    await db.query(
      `UPDATE withdrawals
       SET status = $2,
           remarks = $3,
           processed_at = NOW()
       WHERE id = $1`,
      [id, status, failureReason]
    );
    return withdrawalRepository.findById(id, client);
  },
};
