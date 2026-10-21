import { PoolClient } from 'pg';
import pool from '../../../database/connection';
import { PayoutMethod, WithdrawalStatus } from '../withdrawal.constants';
import {
  AdminWithdrawalFilters,
  AdminWithdrawalItem,
  AdminWithdrawalStats,
  CreateWithdrawalData,
  IWithdrawal,
} from '../withdrawal.types';

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
  reviewed_by?: string | null;
  utr_number?: string | null;
  admin_notes?: string | null;
  account_type?: PayoutMethod | null;
  upi_id?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
}

interface AdminWithdrawalRow extends WithdrawalRow {
  account_holder_name?: string | null;
  bank_name?: string | null;
  user_name?: string | null;
  user_mobile?: string | null;
  user_role?: string | null;
  user_wallet_balance?: string | number | null;
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
    reviewedBy: row.reviewed_by ?? undefined,
    utrNumber: row.utr_number ?? undefined,
    adminNotes: row.admin_notes ?? undefined,
  };
}

function mapAdminWithdrawalRow(row: AdminWithdrawalRow): AdminWithdrawalItem {
  return {
    id: row.id,
    amount: Number(row.amount),
    status: row.status,
    method: row.account_type ?? PayoutMethod.UPI,
    provider: (row.provider as AdminWithdrawalItem['provider']) ?? undefined,
    transactionReference: row.transaction_reference ?? '',
    providerPayoutId: row.provider_payout_id ?? undefined,
    requestedAt: row.requested_at,
    processedAt: row.processed_at ?? undefined,
    remarks: row.remarks ?? undefined,
    utrNumber: row.utr_number ?? undefined,
    adminNotes: row.admin_notes ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    user: {
      id: row.user_id,
      name: row.user_name ?? undefined,
      mobileNumber: row.user_mobile ?? undefined,
      role: row.user_role ?? undefined,
      walletBalance: Number(row.user_wallet_balance ?? 0),
    },
    beneficiary: {
      method: row.account_type ?? PayoutMethod.UPI,
      accountHolderName: row.account_holder_name ?? undefined,
      accountNumber: row.account_number ?? undefined,
      ifsc: row.ifsc_code ?? undefined,
      bankName: row.bank_name ?? undefined,
      upiId: row.upi_id ?? undefined,
    },
  };
}

const WITHDRAWAL_COLUMNS = `
  w.id, w.user_id, w.payout_profile_id, w.amount, w.status,
  w.transaction_reference, w.remarks, w.provider, w.provider_payout_id,
  w.requested_at, w.processed_at, w.created_at,
  w.reviewed_by, w.utr_number, w.admin_notes,
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
           processed_at = CASE WHEN $3 THEN NOW() ELSE processed_at END
       WHERE id = $1`,
      [
        id,
        status,
        status === WithdrawalStatus.SUCCESS || status === WithdrawalStatus.FAILED,
      ]
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
    const providerPayoutId = data.providerPayoutId ?? null;
    const shouldStampProcessed =
      data.status === WithdrawalStatus.SUCCESS ||
      data.status === WithdrawalStatus.FAILED;

    if (providerPayoutId) {
      await pool.query(
        `UPDATE withdrawals
         SET provider_payout_id = $2,
             status = $3,
             processed_at = CASE WHEN $4 THEN NOW() ELSE processed_at END
         WHERE id = $1`,
        [id, providerPayoutId, data.status, shouldStampProcessed]
      );
    } else {
      await pool.query(
        `UPDATE withdrawals
         SET status = $2,
             processed_at = CASE WHEN $3 THEN NOW() ELSE processed_at END
         WHERE id = $1`,
        [id, data.status, shouldStampProcessed]
      );
    }
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

  findAdminList: async (
    filters: AdminWithdrawalFilters
  ): Promise<{ items: AdminWithdrawalItem[]; total: number }> => {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.status && filters.status !== 'all') {
      conditions.push(`w.status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.search) {
      conditions.push(
        `(u.name ILIKE $${paramIndex} OR u.mobile_number ILIKE $${paramIndex} OR w.transaction_reference ILIKE $${paramIndex} OR w.utr_number ILIKE $${paramIndex})`
      );
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`w.requested_at >= $${paramIndex++}`);
      values.push(new Date(filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(`w.requested_at <= $${paramIndex++}`);
      values.push(new Date(filters.endDate));
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const adminColumns = `
      w.id, w.user_id, w.payout_profile_id, w.amount, w.status,
      w.transaction_reference, w.remarks, w.provider, w.provider_payout_id,
      w.requested_at, w.processed_at, w.created_at,
      w.reviewed_by, w.utr_number, w.admin_notes,
      p.account_type, p.account_holder_name, p.upi_id, p.account_number, p.ifsc_code, p.bank_name,
      u.name AS user_name, u.mobile_number AS user_mobile, u.role AS user_role, u.wallet_balance AS user_wallet_balance
    `;

    const adminFrom = `
      FROM withdrawals w
      LEFT JOIN payout_profiles p ON p.id = w.payout_profile_id
      LEFT JOIN users u ON u.id = w.user_id
    `;

    const listQuery = `
      SELECT ${adminColumns}
      ${adminFrom}
      ${whereClause}
      ORDER BY w.requested_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const countQuery = `
      SELECT COUNT(*)::text AS count
      ${adminFrom}
      ${whereClause}
    `;

    const [itemsResult, countResult] = await Promise.all([
      pool.query<AdminWithdrawalRow>(listQuery, [...values, limit, offset]),
      pool.query<{ count: string }>(countQuery, values),
    ]);

    return {
      items: itemsResult.rows.map(mapAdminWithdrawalRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  findAdminById: async (id: string): Promise<AdminWithdrawalItem | null> => {
    const adminColumns = `
      w.id, w.user_id, w.payout_profile_id, w.amount, w.status,
      w.transaction_reference, w.remarks, w.provider, w.provider_payout_id,
      w.requested_at, w.processed_at, w.created_at,
      w.reviewed_by, w.utr_number, w.admin_notes,
      p.account_type, p.account_holder_name, p.upi_id, p.account_number, p.ifsc_code, p.bank_name,
      u.name AS user_name, u.mobile_number AS user_mobile, u.role AS user_role, u.wallet_balance AS user_wallet_balance
    `;

    const adminFrom = `
      FROM withdrawals w
      LEFT JOIN payout_profiles p ON p.id = w.payout_profile_id
      LEFT JOIN users u ON u.id = w.user_id
    `;

    const result = await pool.query<AdminWithdrawalRow>(
      `SELECT ${adminColumns} ${adminFrom} WHERE w.id = $1`,
      [id]
    );

    return result.rows[0] ? mapAdminWithdrawalRow(result.rows[0]) : null;
  },

  getAdminStats: async (): Promise<AdminWithdrawalStats> => {
    const result = await pool.query<{
      status: string;
      count: string;
      total_amount: string;
    }>(
      `SELECT
         w.status,
         COUNT(*)::text AS count,
         COALESCE(SUM(w.amount), 0)::text AS total_amount
       FROM withdrawals w
       GROUP BY w.status`
    );

    const stats: AdminWithdrawalStats = {
      pending: { count: 0, totalAmount: 0 },
      processing: { count: 0, totalAmount: 0 },
      success: { count: 0, totalAmount: 0 },
      failed: { count: 0, totalAmount: 0 },
    };

    for (const row of result.rows) {
      const statusKey = row.status as keyof AdminWithdrawalStats;
      if (stats[statusKey]) {
        stats[statusKey] = {
          count: Number(row.count),
          totalAmount: Number(row.total_amount),
        };
      }
    }

    return stats;
  },

  completeWithdrawal: async (
    id: string,
    data: {
      utrNumber?: string;
      adminNotes?: string;
      reviewedBy: string;
    },
    client?: Queryable
  ): Promise<IWithdrawal | null> => {
    const db = client ?? pool;
    const result = await db.query(
      `UPDATE withdrawals
       SET status = $2,
           utr_number = COALESCE($3, utr_number),
           admin_notes = COALESCE($4, admin_notes),
           reviewed_by = $5,
           processed_at = NOW()
       WHERE id = $1 AND status IN ($6, $7)
       RETURNING id`,
      [
        id,
        WithdrawalStatus.SUCCESS,
        data.utrNumber ?? null,
        data.adminNotes ?? null,
        data.reviewedBy,
        WithdrawalStatus.PENDING,
        WithdrawalStatus.PROCESSING,
      ]
    );

    if (result.rowCount === 0) {
      return null;
    }
    return withdrawalRepository.findById(id, client);
  },

  rejectWithdrawal: async (
    id: string,
    data: {
      reason: string;
      adminNotes?: string;
      reviewedBy: string;
    },
    client?: Queryable
  ): Promise<IWithdrawal | null> => {
    const db = client ?? pool;
    const result = await db.query(
      `UPDATE withdrawals
       SET status = $2,
           remarks = $3,
           admin_notes = COALESCE($4, admin_notes),
           reviewed_by = $5,
           processed_at = NOW()
       WHERE id = $1 AND status IN ($6, $7)
       RETURNING id`,
      [
        id,
        WithdrawalStatus.FAILED,
        data.reason,
        data.adminNotes ?? null,
        data.reviewedBy,
        WithdrawalStatus.PENDING,
        WithdrawalStatus.PROCESSING,
      ]
    );

    if (result.rowCount === 0) {
      return null;
    }
    return withdrawalRepository.findById(id, client);
  },
};

