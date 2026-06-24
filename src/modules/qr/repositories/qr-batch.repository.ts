import pool from '../../../database/connection';
import { IQrBatch, QrBatchStatus } from '../types/qr.types';

interface QrBatchRow {
  id: string;
  name: string;
  total_qrs: number;
  generated_count: number;
  product_id: string | null;
  campaign_id: string | null;
  description: string | null;
  status: QrBatchStatus;
  created_at: Date;
  updated_at: Date;
  product_sku_code?: string | null;
  product_name?: string | null;
  product_image_url?: string | null;
}

const BATCH_COLUMNS = `
  b.id, b.name, b.total_qrs, b.generated_count, b.product_id, b.campaign_id,
  b.description, b.status, b.created_at, b.updated_at
`;

export function mapQrBatchRow(row: QrBatchRow): IQrBatch {
  const batch: IQrBatch = {
    _id: row.id,
    name: row.name,
    totalQrs: row.total_qrs,
    generatedCount: row.generated_count,
    productId: row.product_id ?? undefined,
    campaignId: row.campaign_id ?? undefined,
    description: row.description ?? undefined,
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

  return batch;
}

export interface CreateQrBatchData {
  name: string;
  totalQrs: number;
  productId: string;
  campaignId?: string;
  description?: string;
  generatedCount?: number;
  status?: QrBatchStatus;
}

export const qrBatchRepository = {
  create: async (data: CreateQrBatchData): Promise<IQrBatch> => {
    const result = await pool.query<QrBatchRow>(
      `INSERT INTO qr_batches
         (name, total_qrs, generated_count, product_id, campaign_id, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, total_qrs, generated_count, product_id, campaign_id,
                 description, status, created_at, updated_at`,
      [
        data.name,
        data.totalQrs,
        data.generatedCount ?? 0,
        data.productId,
        data.campaignId ?? null,
        data.description ?? null,
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
                p.image_url AS product_image_url
         FROM qr_batches b
         LEFT JOIN products p ON p.id = b.product_id
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
       RETURNING id, name, total_qrs, generated_count, product_id, campaign_id,
                 description, status, created_at, updated_at`,
      [id, generatedCount, status]
    );
    return result.rows[0] ? mapQrBatchRow(result.rows[0]) : null;
  },

  assignCampaign: async (
    batchId: string,
    campaignId: string
  ): Promise<IQrBatch | null> => {
    const result = await pool.query<QrBatchRow>(
      `UPDATE qr_batches
       SET campaign_id = $2, status = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, total_qrs, generated_count, product_id, campaign_id,
                 description, status, created_at, updated_at`,
      [batchId, campaignId, QrBatchStatus.ASSIGNED]
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
       RETURNING id, name, total_qrs, generated_count, product_id, campaign_id,
                 description, status, created_at, updated_at`,
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
       RETURNING id, name, total_qrs, generated_count, product_id, campaign_id,
                 description, status, created_at, updated_at`,
      [id, delta]
    );
    return result.rows[0] ? mapQrBatchRow(result.rows[0]) : null;
  },
};
