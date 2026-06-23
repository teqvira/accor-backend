import pool from '../../../database/connection';
import { IQrBatch, QrBatchStatus } from '../types/qr.types';

interface QrBatchRow {
  id: string;
  name: string;
  total_qrs: number;
  generated_count: number;
  campaign_id: string | null;
  status: QrBatchStatus;
  created_at: Date;
  updated_at: Date;
}

export function mapQrBatchRow(row: QrBatchRow): IQrBatch {
  return {
    _id: row.id,
    name: row.name,
    totalQrs: row.total_qrs,
    generatedCount: row.generated_count,
    campaignId: row.campaign_id ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BATCH_COLUMNS = `
  id, name, total_qrs, generated_count, campaign_id, status, created_at, updated_at
`;

export interface CreateQrBatchData {
  name: string;
  totalQrs: number;
  campaignId?: string;
  generatedCount?: number;
  status?: QrBatchStatus;
}

export const qrBatchRepository = {
  create: async (data: CreateQrBatchData): Promise<IQrBatch> => {
    const result = await pool.query<QrBatchRow>(
      `INSERT INTO qr_batches
         (name, total_qrs, generated_count, campaign_id, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${BATCH_COLUMNS}`,
      [
        data.name,
        data.totalQrs,
        data.generatedCount ?? 0,
        data.campaignId ?? null,
        data.status ?? QrBatchStatus.DRAFT,
      ]
    );
    return mapQrBatchRow(result.rows[0]);
  },

  findById: async (id: string): Promise<IQrBatch | null> => {
    const result = await pool.query<QrBatchRow>(
      `SELECT ${BATCH_COLUMNS} FROM qr_batches WHERE id = $1`,
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
        `SELECT ${BATCH_COLUMNS}
         FROM qr_batches
         ORDER BY created_at DESC
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
       RETURNING ${BATCH_COLUMNS}`,
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
       RETURNING ${BATCH_COLUMNS}`,
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
       RETURNING ${BATCH_COLUMNS}`,
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
       RETURNING ${BATCH_COLUMNS}`,
      [id, delta]
    );
    return result.rows[0] ? mapQrBatchRow(result.rows[0]) : null;
  },
};
