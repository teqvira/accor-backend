import pool from '../../../database/connection';

export async function generateNextBatchLabel(): Promise<string> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM qr_batches`
  );
  const next = Number(result.rows[0]?.count ?? 0) + 1;
  return `BATCH-${String(next).padStart(3, '0')}`;
}
