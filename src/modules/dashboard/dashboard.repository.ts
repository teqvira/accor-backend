import pool from '../../database/connection';
import {
  DateCountPoint,
  LabeledCount,
  ScanDistributionItem,
} from './dashboard.types';

function mapDateCounts(
  rows: Array<{ day: Date | string; count: string }>
): DateCountPoint[] {
  return rows.map((row) => ({
    date:
      row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : String(row.day).slice(0, 10),
    count: Number(row.count),
  }));
}

export const dashboardRepository = {
  /** One round-trip for the five admin home summary cards. */
  getSummary: async (): Promise<{
    totalPartners: number;
    pendingApprovals: number;
    totalQrGenerated: number;
    rewardAmountDistributed: number;
    rewardPointsIssued: number;
  }> => {
    const result = await pool.query<{
      total_partners: string;
      pending_approvals: string;
      total_qr: string;
      wallet_credits: string;
      reward_points: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text
            FROM users
           WHERE role = 'user'
             AND approval_status = 'approved'
             AND is_active = true) AS total_partners,
         (SELECT COUNT(*)::text
            FROM users
           WHERE role = 'user'
             AND approval_status = 'pending') AS pending_approvals,
         (SELECT COUNT(*)::text FROM qr_codes) AS total_qr,
         (SELECT COALESCE(SUM(amount), 0)::text
            FROM wallet_transactions
           WHERE type = 'credit') AS wallet_credits,
         (SELECT COALESCE(SUM(points), 0)::text
            FROM reward_transactions
           WHERE type = 'credit') AS reward_points`
    );
    const row = result.rows[0];
    return {
      totalPartners: Number(row?.total_partners ?? 0),
      pendingApprovals: Number(row?.pending_approvals ?? 0),
      totalQrGenerated: Number(row?.total_qr ?? 0),
      rewardAmountDistributed: Number(row?.wallet_credits ?? 0),
      rewardPointsIssued: Number(row?.reward_points ?? 0),
    };
  },

  countActivePartners: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM users
       WHERE role = 'user'
         AND approval_status = 'approved'
         AND is_active = true`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  countPendingApprovals: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM users
       WHERE role = 'user'
         AND approval_status = 'pending'`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  /** Product scan distribution for the donut chart (all-time redemptions). */
  scanDistributionByProduct: async (): Promise<{
    totalScans: number;
    items: Omit<ScanDistributionItem, 'percentage'>[];
  }> => {
    const result = await pool.query<{
      product_id: string;
      product_name: string;
      scan_count: string;
    }>(
      `SELECT
         p.id AS product_id,
         p.name AS product_name,
         COUNT(rt.id)::text AS scan_count
       FROM redemption_transactions rt
       INNER JOIN products p ON p.id = rt.product_id
       GROUP BY p.id, p.name
       ORDER BY COUNT(rt.id) DESC`
    );

    const items = result.rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      scanCount: Number(row.scan_count),
    }));
    const totalScans = items.reduce((sum, item) => sum + item.scanCount, 0);

    return { totalScans, items };
  },

  countPendingWithdrawals: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM withdrawals
       WHERE status IN ('pending', 'processing')`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  countSuccessfulWithdrawals: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM withdrawals
       WHERE status = 'success'`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  redemptionsOverTime: async (days: number): Promise<DateCountPoint[]> => {
    const result = await pool.query<{ day: Date; count: string }>(
      `SELECT DATE(redeemed_at) AS day, COUNT(*)::text AS count
       FROM redemption_transactions
       WHERE redeemed_at >= NOW() - ($1::text || ' days')::interval
       GROUP BY DATE(redeemed_at)
       ORDER BY day ASC`,
      [days]
    );
    return mapDateCounts(result.rows);
  },

  newUsersOverTime: async (days: number): Promise<DateCountPoint[]> => {
    const result = await pool.query<{ day: Date; count: string }>(
      `SELECT DATE(created_at) AS day, COUNT(*)::text AS count
       FROM users
       WHERE role = 'user'
         AND created_at >= NOW() - ($1::text || ' days')::interval
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      [days]
    );
    return mapDateCounts(result.rows);
  },

  productsByType: async (): Promise<LabeledCount[]> => {
    const result = await pool.query<{
      product_type: string | null;
      count: string;
    }>(
      `SELECT product_type, COUNT(*)::text AS count
       FROM products
       GROUP BY product_type
       ORDER BY COUNT(*) DESC`
    );
    return result.rows.map((row) => ({
      label: row.product_type ?? 'unknown',
      count: Number(row.count),
    }));
  },

  withdrawalsByStatus: async (): Promise<LabeledCount[]> => {
    const result = await pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count
       FROM withdrawals
       GROUP BY status
       ORDER BY COUNT(*) DESC`
    );
    return result.rows.map((row) => ({
      label: row.status,
      count: Number(row.count),
    }));
  },
};
