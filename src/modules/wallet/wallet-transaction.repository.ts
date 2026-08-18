import { PoolClient } from 'pg';
import pool from '../../database/connection';
import {
  AdminWalletScanItem,
  AdminWalletScanQuery,
  CreateWalletTransactionData,
  IWalletTransaction,
  WalletTransactionType,
} from './wallet.types';


type Queryable = Pick<PoolClient, 'query'>;

interface WalletTransactionRow {
  id: string;
  user_id: string;
  amount: string | number;
  type: WalletTransactionType;
  reference_type: IWalletTransaction['referenceType'] | null;
  reference_id: string | null;
  remarks: string | null;
  created_at: Date;
}

export function mapWalletTransactionRow(
  row: WalletTransactionRow
): IWalletTransaction {
  return {
    _id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    type: row.type,
    referenceType: row.reference_type ?? undefined,
    referenceId: row.reference_id ?? undefined,
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
  };
}

const TX_COLUMNS = `
  id, user_id, amount, type, reference_type, reference_id, remarks, created_at
`;

export const walletTransactionRepository = {
  create: async (
    data: CreateWalletTransactionData,
    client?: Queryable
  ): Promise<IWalletTransaction> => {
    const db = client ?? pool;
    const result = await db.query<WalletTransactionRow>(
      `INSERT INTO wallet_transactions
         (user_id, amount, type, reference_type, reference_id, remarks)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${TX_COLUMNS}`,
      [
        data.userId,
        data.amount,
        data.type,
        data.referenceType ?? null,
        data.referenceId ?? null,
        data.remarks ?? null,
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

  sumTotalEarnedByUserId: async (userId: string): Promise<number> => {
    const result = await pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM wallet_transactions
       WHERE user_id = $1
         AND type = $2
         AND reference_type IS DISTINCT FROM 'withdrawal'`,
      [userId, WalletTransactionType.CREDIT]
    );
    return Number(result.rows[0]?.total ?? 0);
  },

  sumTotalWithdrawnByUserId: async (userId: string): Promise<number> => {
    const result = await pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM withdrawals
       WHERE user_id = $1
         AND status = 'success'`,
      [userId]
    );
    return Number(result.rows[0]?.total ?? 0);
  },

  sumPendingAmountByUserId: async (userId: string): Promise<number> => {
    const result = await pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM withdrawals
       WHERE user_id = $1
         AND status IN ('pending', 'processing')`,
      [userId]
    );
    return Number(result.rows[0]?.total ?? 0);
  },

  sumAllUserWalletBalances: async (): Promise<number> => {
    const result = await pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(wallet_balance), 0)::text AS total
       FROM users
       WHERE role = 'user'`
    );
    return Number(result.rows[0]?.total ?? 0);
  },

  sumTotalSuccessfulWithdrawals: async (): Promise<number> => {
    const result = await pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM withdrawals
       WHERE status = 'success'`
    );
    return Number(result.rows[0]?.total ?? 0);
  },

  countTotalScans: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM redemption_transactions`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  findAdminScans: async (
    page = 1,
    limit = 20,
    filters: AdminWalletScanQuery = {}
  ): Promise<{ items: AdminWalletScanItem[]; total: number }> => {
    const offset = (page - 1) * limit;
    const search = filters.search?.trim() || null;
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;

    const [itemsResult, countResult] = await Promise.all([
      pool.query<{
        redemption_id: string;
        user_id: string;
        user_name: string | null;
        mobile_number: string | null;
        recent_scan_value: string | number;
        wallet_balance: string | number;
        total_withdrawn: string | number;
        last_activity: Date;
        qr_code: string;
        product_name: string | null;
        sku_code: string | null;
        reward_points: number;
      }>(
        `SELECT
           rt.id AS redemption_id,
           rt.wallet_amount AS recent_scan_value,
           rt.reward_points,
           rt.redeemed_at AS last_activity,
           u.id AS user_id,
           u.name AS user_name,
           u.mobile_number,
           u.wallet_balance,
           COALESCE(w.total_withdrawn, 0) AS total_withdrawn,
           qc.code AS qr_code,
           p.name AS product_name,
           p.sku_code
         FROM redemption_transactions rt
         JOIN users u ON rt.user_id = u.id
         JOIN qr_codes qc ON rt.qr_code_id = qc.id
         LEFT JOIN products p ON rt.product_id = p.id
         LEFT JOIN (
           SELECT user_id, SUM(amount) AS total_withdrawn
           FROM withdrawals
           WHERE status = 'success'
           GROUP BY user_id
         ) w ON w.user_id = u.id
         WHERE ($1::text IS NULL OR u.name ILIKE '%' || $1 || '%' OR u.mobile_number ILIKE '%' || $1 || '%' OR qc.code ILIKE '%' || $1 || '%')
           AND ($2::timestamptz IS NULL OR rt.redeemed_at >= $2)
           AND ($3::timestamptz IS NULL OR rt.redeemed_at <= $3)
         ORDER BY rt.redeemed_at DESC
         LIMIT $4 OFFSET $5`,
        [search, startDate, endDate, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM redemption_transactions rt
         JOIN users u ON rt.user_id = u.id
         JOIN qr_codes qc ON rt.qr_code_id = qc.id
         WHERE ($1::text IS NULL OR u.name ILIKE '%' || $1 || '%' OR u.mobile_number ILIKE '%' || $1 || '%' OR qc.code ILIKE '%' || $1 || '%')
           AND ($2::timestamptz IS NULL OR rt.redeemed_at >= $2)
           AND ($3::timestamptz IS NULL OR rt.redeemed_at <= $3)`,
        [search, startDate, endDate]
      ),
    ]);

    return {
      items: itemsResult.rows.map((row) => ({
        id: row.redemption_id,
        userId: row.user_id,
        name: row.user_name,
        mobileNumber: row.mobile_number,
        recentScanValue: Number(row.recent_scan_value),
        walletBalance: Number(row.wallet_balance),
        totalWithdrawn: Number(row.total_withdrawn),
        lastActivity: row.last_activity,
        qrCode: row.qr_code,
        productName: row.product_name,
        skuCode: row.sku_code,
        rewardPoints: row.reward_points,
      })),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },
};

