import pool from '../../../database/connection';

/**
 * Human-readable batch code shown on QR labels (e.g. BATCH-001).
 * UUID remains the real DB primary key; this is only the display code.
 */
export async function generateNextBatchLabel(): Promise<string> {
  const result = await pool.query<{ next: string }>(
    `SELECT (COALESCE(MAX(
       CASE
         WHEN name ~ '^BATCH-[0-9]+$'
         THEN CAST(SUBSTRING(name FROM 7) AS INTEGER)
         ELSE 0
       END
     ), 0) + 1)::text AS next
     FROM qr_batches`
  );
  const next = Number(result.rows[0]?.next ?? 1);
  return `BATCH-${String(next).padStart(3, '0')}`;
}
