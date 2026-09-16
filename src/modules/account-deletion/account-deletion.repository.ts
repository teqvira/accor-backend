import pool from '../../database/connection';
import {
  AccountDeletionListFilters,
  AccountDeletionSource,
  AccountDeletionStatus,
  CreateAccountDeletionRequestData,
  IAccountDeletionRequest,
} from './account-deletion.types';

interface DeletionRequestRow {
  id: string;
  user_id: string;
  mobile_number: string;
  source: AccountDeletionSource;
  status: AccountDeletionStatus;
  reason: string | null;
  requested_at: Date;
  scheduled_for: Date | null;
  processed_at: Date | null;
  cancelled_at: Date | null;
  processed_by: string | null;
  cancelled_by: string | null;
  created_at: Date;
  updated_at: Date;
  user_name?: string | null;
  user_email?: string | null;
  user_is_active?: boolean | null;
  user_deleted_at?: Date | null;
}

const COLUMNS = `
  id, user_id, mobile_number, source, status, reason,
  requested_at, scheduled_for, processed_at, cancelled_at,
  processed_by, cancelled_by, created_at, updated_at
`;

function mapRow(row: DeletionRequestRow): IAccountDeletionRequest {
  return {
    _id: row.id,
    userId: row.user_id,
    mobileNumber: row.mobile_number,
    source: row.source,
    status: row.status,
    reason: row.reason ?? undefined,
    requestedAt: row.requested_at,
    scheduledFor: row.scheduled_for ?? undefined,
    processedAt: row.processed_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    processedBy: row.processed_by ?? undefined,
    cancelledBy: row.cancelled_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userName: row.user_name ?? undefined,
    userEmail: row.user_email ?? undefined,
    userIsActive:
      row.user_is_active === null || row.user_is_active === undefined
        ? undefined
        : row.user_is_active,
    userDeletedAt: row.user_deleted_at ?? undefined,
  };
}

export const accountDeletionRepository = {
  create: async (
    data: CreateAccountDeletionRequestData
  ): Promise<IAccountDeletionRequest> => {
    const result = await pool.query<DeletionRequestRow>(
      `INSERT INTO account_deletion_requests
         (user_id, mobile_number, source, status, reason, scheduled_for, processed_at, processed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLUMNS}`,
      [
        data.userId,
        data.mobileNumber,
        data.source,
        data.status,
        data.reason ?? null,
        data.scheduledFor ?? null,
        data.processedAt ?? null,
        data.processedBy ?? null,
      ]
    );
    return mapRow(result.rows[0]);
  },

  findById: async (id: string): Promise<IAccountDeletionRequest | null> => {
    const result = await pool.query<DeletionRequestRow>(
      `SELECT r.id, r.user_id, r.mobile_number, r.source, r.status, r.reason,
              r.requested_at, r.scheduled_for, r.processed_at, r.cancelled_at,
              r.processed_by, r.cancelled_by, r.created_at, r.updated_at,
              u.name AS user_name,
              u.email AS user_email,
              u.is_active AS user_is_active,
              u.deleted_at AS user_deleted_at
       FROM account_deletion_requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  findPendingByUserId: async (
    userId: string
  ): Promise<IAccountDeletionRequest | null> => {
    const result = await pool.query<DeletionRequestRow>(
      `SELECT ${COLUMNS}
       FROM account_deletion_requests
       WHERE user_id = $1 AND status = 'pending'
       LIMIT 1`,
      [userId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  findDuePending: async (limit = 50): Promise<IAccountDeletionRequest[]> => {
    const result = await pool.query<DeletionRequestRow>(
      `SELECT ${COLUMNS}
       FROM account_deletion_requests
       WHERE status = 'pending'
         AND scheduled_for IS NOT NULL
         AND scheduled_for <= NOW()
       ORDER BY scheduled_for ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(mapRow);
  },

  markCompleted: async (
    id: string,
    processedBy?: string | null
  ): Promise<IAccountDeletionRequest | null> => {
    const result = await pool.query<DeletionRequestRow>(
      `UPDATE account_deletion_requests
       SET status = 'completed',
           processed_at = NOW(),
           processed_by = COALESCE($2, processed_by),
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING ${COLUMNS}`,
      [id, processedBy ?? null]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  markCancelled: async (
    id: string,
    cancelledBy?: string | null
  ): Promise<IAccountDeletionRequest | null> => {
    const result = await pool.query<DeletionRequestRow>(
      `UPDATE account_deletion_requests
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING ${COLUMNS}`,
      [id, cancelledBy ?? null]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  completePendingForUser: async (
    userId: string,
    processedBy?: string | null
  ): Promise<void> => {
    await pool.query(
      `UPDATE account_deletion_requests
       SET status = 'completed',
           processed_at = NOW(),
           processed_by = COALESCE($2, processed_by),
           updated_at = NOW()
       WHERE user_id = $1 AND status = 'pending'`,
      [userId, processedBy ?? null]
    );
  },

  findAll: async (
    filters: AccountDeletionListFilters = {}
  ): Promise<{ items: IAccountDeletionRequest[]; total: number }> => {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.status) {
      conditions.push(`r.status = $${paramIndex++}`);
      values.push(filters.status);
    }
    if (filters.source) {
      conditions.push(`r.source = $${paramIndex++}`);
      values.push(filters.source);
    }
    if (filters.search) {
      conditions.push(
        `(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR r.mobile_number ILIKE $${paramIndex})`
      );
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM account_deletion_requests r
       JOIN users u ON u.id = r.user_id
       ${where}`,
      values
    );

    const listValues = [...values, limit, offset];
    const result = await pool.query<DeletionRequestRow>(
      `SELECT r.id, r.user_id, r.mobile_number, r.source, r.status, r.reason,
              r.requested_at, r.scheduled_for, r.processed_at, r.cancelled_at,
              r.processed_by, r.cancelled_by, r.created_at, r.updated_at,
              u.name AS user_name,
              u.email AS user_email,
              u.is_active AS user_is_active,
              u.deleted_at AS user_deleted_at
       FROM account_deletion_requests r
       JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY r.requested_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      listValues
    );

    return {
      items: result.rows.map(mapRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },
};
