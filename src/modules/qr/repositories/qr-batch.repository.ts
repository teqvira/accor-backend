import pool from '../../../database/connection';
import { IQrBatch, QrBatchStatus } from '../types/qr.types';

interface QrBatchRow {
  id: string;
  name: string;
  total_qrs: number;
  generated_count: number;
  product_id: string | null;
  description: string | null;
  wallet_amount: string | number;
  reward_points: number;
  start_date: Date | null;
  end_date: Date | null;
  active: boolean;
  status: QrBatchStatus;
  created_at: Date;
  updated_at: Date;
  product_sku_code?: string | null;
  product_name?: string | null;
  product_image_url?: string | null;
  redeemed_count?: string | number;
  pending_count?: string | number;
}

const BATCH_COLUMNS = `
  b.id, b.name, b.total_qrs, b.generated_count, b.product_id, b.description,
  b.wallet_amount, b.reward_points, b.start_date, b.end_date, b.active,
  b.status, b.created_at, b.updated_at
`;

const BATCH_RETURNING = `
  id, name, total_qrs, generated_count, product_id, description,
  wallet_amount, reward_points, start_date, end_date, active,
  status, created_at, updated_at
`;

export function mapQrBatchRow(row: QrBatchRow): IQrBatch {
  const batch: IQrBatch = {
    _id: row.id,
    name: row.name,
    totalQrs: row.total_qrs,
    generatedCount: row.generated_count,
    productId: row.product_id ?? undefined,
    description: row.description ?? undefined,
    walletAmount: Number(row.wallet_amount),
    rewardPoints: row.reward_points,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    active: row.active,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.product_id && row.product_sku_code && row.product_name) {
    batch.product = {
      id: row.product_id,
      skuCode: row.product_sku_code,
      name: row.product_name,
      imageUrl: row.product_image_url ?? undefined,
    };
  }

  if (row.redeemed_count !== undefined && row.pending_count !== undefined) {
    batch.stats = {
      generated: row.generated_count,
      redeemed: Number(row.redeemed_count),
      pending: Number(row.pending_count),
    };
  }

  return batch;
}

export interface CreateQrBatchData {
  name: string;
  totalQrs: number;
  productId: string;
  description?: string;
  walletAmount: number;
  rewardPoints: number;
  startDate: string;
  endDate: string;
  active?: boolean;
  generatedCount?: number;
  status?: QrBatchStatus;
}

export const qrBatchRepository = {
  create: async (data: CreateQrBatchData): Promise<IQrBatch> => {
    const result = await pool.query<QrBatchRow>(
      `INSERT INTO qr_batches
         (name, total_qrs, generated_count, product_id, description,
          wallet_amount, reward_points, start_date, end_date, active, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${BATCH_RETURNING}`,
      [
        data.name,
        data.totalQrs,
        data.generatedCount ?? 0,
        data.productId,
        data.description ?? null,
        data.walletAmount,
        data.rewardPoints,
        data.startDate,
        data.endDate,
        data.active ?? true,
        data.status ?? QrBatchStatus.DRAFT,
      ]
    );
    return mapQrBatchRow(result.rows[0]);
  },

  findById: async (id: string): Promise<IQrBatch | null> => {
    const result = await pool.query<QrBatchRow>(
      `SELECT ${BATCH_COLUMNS},
              p.sku_code AS product_sku_code,
              p.name AS product_name,
              p.image_url AS product_image_url
       FROM qr_batches b
       LEFT JOIN products p ON p.id = b.product_id
       WHERE b.id = $1`,
      [id]
    );
    return result.rows[0] ? mapQrBatchRow(result.rows[0]) : null;
  },

  findAll: async (
    page = 1,
    limit = 20
  ): Promise<{ items: IQrBatch[]; total: number }> => {
    const offset = (page - 1) * limit;
    const [itemsResult, countResult] = await Promise.all([
      pool.query<QrBatchRow>(
        `SELECT ${BATCH_COLUMNS},
                p.sku_code AS product_sku_code,
                p.name AS product_name,
                p.image_url AS product_image_url,
                COUNT(qc.id) FILTER (WHERE qc.redeemed = true)::text AS redeemed_count,
                COUNT(qc.id) FILTER (WHERE qc.redeemed = false)::text AS pending_count
         FROM qr_batches b
         LEFT JOIN products p ON p.id = b.product_id
         LEFT JOIN qr_codes qc ON qc.batch_id = b.id
         GROUP BY b.id, p.sku_code, p.name, p.image_url
         ORDER BY b.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM qr_batches`
      ),
    ]);
    return {
      items: itemsResult.rows.map(mapQrBatchRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  count: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM qr_batches`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  updateAfterGeneration: async (
    id: string,
    generatedCount: number,
    status: QrBatchStatus
  ): Promise<IQrBatch | null> => {
    const result = await pool.query<QrBatchRow>(
      `UPDATE qr_batches
       SET generated_count = $2, status = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING ${BATCH_RETURNING}`,
      [id, generatedCount, status]
    );
    return result.rows[0] ? mapQrBatchRow(result.rows[0]) : null;
  },

  updateStatus: async (
    id: string,
    status: QrBatchStatus
  ): Promise<IQrBatch | null> => {
    const result = await pool.query<QrBatchRow>(
      `UPDATE qr_batches
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING ${BATCH_RETURNING}`,
      [id, status]
    );
    return result.rows[0] ? mapQrBatchRow(result.rows[0]) : null;
  },

  incrementGeneratedCount: async (
    id: string,
    delta: number
  ): Promise<IQrBatch | null> => {
    const result = await pool.query<QrBatchRow>(
      `UPDATE qr_batches
       SET generated_count = generated_count + $2, updated_at = NOW()
       WHERE id = $1
       RETURNING ${BATCH_RETURNING}`,
      [id, delta]
    );
    return result.rows[0] ? mapQrBatchRow(result.rows[0]) : null;
  },
};
