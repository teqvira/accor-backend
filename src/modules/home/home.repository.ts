import pool from '../../database/connection';
import { WithdrawalStatus } from '../withdrawals/withdrawal.constants';
import { HomePendingWithdrawal } from './home.types';

interface PendingWithdrawalRow {
  id: string;
  amount: string | number;
  status: WithdrawalStatus;
  requested_at: Date;
}

export const homeRepository = {
  countTotalScans: async (userId: string): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM redemption_transactions
       WHERE user_id = $1`,
      [userId]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  findPendingWithdrawalSummary: async (
    userId: string
  ): Promise<HomePendingWithdrawal | null> => {
    const result = await pool.query<PendingWithdrawalRow>(
      `SELECT id, amount, status, requested_at
       FROM withdrawals
       WHERE user_id = $1
         AND status IN ($2, $3)
       ORDER BY requested_at DESC
       LIMIT 1`,
      [userId, WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      amount: Number(row.amount),
      status: row.status,
      requestedAt: row.requested_at,
    };
  },
};
