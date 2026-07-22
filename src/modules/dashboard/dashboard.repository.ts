import pool from '../../database/connection';
import { DateCountPoint, LabeledCount } from './dashboard.types';

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
    const result = await pool.query<{ product_type: string | null; count: string }>(
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
