import { PoolClient } from 'pg';
import pool from '../../../database/connection';
import { IQrCode, QrCodeListFilters } from '../types/qr.types';

interface QrCodeRow {
  id: string;
  code: string;
  batch_id: string;
  campaign_id: string | null;
  redeemed: boolean;
  redeemed_by: string | null;
  redeemed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function mapQrCodeRow(row: QrCodeRow): IQrCode {
  return {
    _id: row.id,
    code: row.code,
    batchId: row.batch_id,
    campaignId: row.campaign_id ?? undefined,
    redeemed: row.redeemed,
    redeemedBy: row.redeemed_by ?? undefined,
    redeemedAt: row.redeemed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CODE_COLUMNS = `
  id, code, batch_id, campaign_id, redeemed, redeemed_by, redeemed_at,
  created_at, updated_at
`;

type Queryable = Pick<PoolClient, 'query'>;

export interface QrCodeInsertDoc {
  code: string;
  batchId: string;
  campaignId?: string;
}

export const qrCodeRepository = {
  create: async (data: QrCodeInsertDoc): Promise<IQrCode> => {
    const result = await pool.query<QrCodeRow>(
      `INSERT INTO qr_codes (code, batch_id, campaign_id)
       VALUES ($1, $2, $3)
       RETURNING ${CODE_COLUMNS}`,
      [data.code, data.batchId, data.campaignId ?? null]
    );
    return mapQrCodeRow(result.rows[0]);
  },

  bulkCreate: async (docs: QrCodeInsertDoc[]): Promise<number> => {
    if (docs.length === 0) return 0;

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const doc of docs) {
      placeholders.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );
      values.push(doc.code, doc.batchId, doc.campaignId ?? null);
    }

    const result = await pool.query<{ id: string }>(
      `INSERT INTO qr_codes (code, batch_id, campaign_id)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (code) DO NOTHING
       RETURNING id`,
      values
    );
    return result.rows.length;
  },

  findById: async (id: string): Promise<IQrCode | null> => {
    const result = await pool.query<QrCodeRow>(
      `SELECT ${CODE_COLUMNS} FROM qr_codes WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapQrCodeRow(result.rows[0]) : null;
  },

  findByCode: async (
    code: string,
    client?: Queryable
  ): Promise<IQrCode | null> => {
    const db = client ?? pool;
    const result = await db.query<QrCodeRow>(
      `SELECT ${CODE_COLUMNS} FROM qr_codes WHERE code = $1`,
      [code]
    );
    return result.rows[0] ? mapQrCodeRow(result.rows[0]) : null;
  },

  findUnredeemedByCode: async (code: string): Promise<IQrCode | null> => {
    const result = await pool.query<QrCodeRow>(
      `SELECT ${CODE_COLUMNS}
       FROM qr_codes
       WHERE code = $1 AND redeemed = false`,
      [code]
    );
    return result.rows[0] ? mapQrCodeRow(result.rows[0]) : null;
  },

  findByBatchId: async (
    batchId: string,
    page = 1,
    limit = 20,
    filters: Pick<QrCodeListFilters, 'redeemed'> = {}
  ): Promise<{ items: IQrCode[]; total: number }> => {
    const offset = (page - 1) * limit;
    const conditions = ['batch_id = $1'];
    const values: unknown[] = [batchId];
    let paramIndex = 2;

    if (filters.redeemed !== undefined) {
      conditions.push(`redeemed = $${paramIndex++}`);
      values.push(filters.redeemed);
    }

    const whereClause = conditions.join(' AND ');
    values.push(limit, offset);

    const [itemsResult, countResult] = await Promise.all([
      pool.query<QrCodeRow>(
        `SELECT ${CODE_COLUMNS}
         FROM qr_codes
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        values
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM qr_codes WHERE ${whereClause}`,
        values.slice(0, values.length - 2)
      ),
    ]);

    return {
      items: itemsResult.rows.map(mapQrCodeRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  findAll: async (
    page = 1,
    limit = 20,
    filters: QrCodeListFilters = {}
  ): Promise<{ items: IQrCode[]; total: number }> => {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.batchId) {
      conditions.push(`batch_id = $${paramIndex++}`);
      values.push(filters.batchId);
    }
    if (filters.redeemed !== undefined) {
      conditions.push(`redeemed = $${paramIndex++}`);
      values.push(filters.redeemed);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit, offset);

    const [itemsResult, countResult] = await Promise.all([
      pool.query<QrCodeRow>(
        `SELECT ${CODE_COLUMNS}
         FROM qr_codes
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        values
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM qr_codes ${whereClause}`,
        values.slice(0, values.length - 2)
      ),
    ]);

    return {
      items: itemsResult.rows.map(mapQrCodeRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  count: async (filters: QrCodeListFilters = {}): Promise<number> => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.batchId) {
      conditions.push(`batch_id = $${paramIndex++}`);
      values.push(filters.batchId);
    }
    if (filters.redeemed !== undefined) {
      conditions.push(`redeemed = $${paramIndex++}`);
      values.push(filters.redeemed);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM qr_codes ${whereClause}`,
      values
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  countByBatch: async (
    batchId: string,
    redeemed?: boolean
  ): Promise<number> => {
    if (redeemed === undefined) {
      return qrCodeRepository.count({ batchId });
    }
    return qrCodeRepository.count({ batchId, redeemed });
  },

  getBatchStats: async (
    batchId: string
  ): Promise<{ total: number; redeemed: number; unredeemed: number }> => {
    const result = await pool.query<{
      total: string;
      redeemed: string;
      unredeemed: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE redeemed = true)::text AS redeemed,
         COUNT(*) FILTER (WHERE redeemed = false)::text AS unredeemed
       FROM qr_codes
       WHERE batch_id = $1`,
      [batchId]
    );
    const row = result.rows[0];
    return {
      total: Number(row?.total ?? 0),
      redeemed: Number(row?.redeemed ?? 0),
      unredeemed: Number(row?.unredeemed ?? 0),
    };
  },

  findCodesByBatchId: async (batchId: string, limit = 1000): Promise<string[]> => {
    const result = await pool.query<{ code: string }>(
      `SELECT code FROM qr_codes WHERE batch_id = $1 ORDER BY created_at ASC LIMIT $2`,
      [batchId, limit]
    );
    return result.rows.map((row) => row.code);
  },

  updateCampaignForUnredeemed: async (
    batchId: string,
    campaignId: string
  ): Promise<number> => {
    const result = await pool.query(
      `UPDATE qr_codes
       SET campaign_id = $2, updated_at = NOW()
       WHERE batch_id = $1 AND redeemed = false`,
      [batchId, campaignId]
    );
    return result.rowCount ?? 0;
  },

  markRedeemed: async (
    id: string,
    userId: string,
    campaignId: string,
    client?: Queryable
  ): Promise<IQrCode | null> => {
    const db = client ?? pool;
    const result = await db.query<QrCodeRow>(
      `UPDATE qr_codes
       SET redeemed = true,
           redeemed_by = $2,
           redeemed_at = NOW(),
           campaign_id = $3,
           updated_at = NOW()
       WHERE id = $1 AND redeemed = false
       RETURNING ${CODE_COLUMNS}`,
      [id, userId, campaignId]
    );
    return result.rows[0] ? mapQrCodeRow(result.rows[0]) : null;
  },

  markRedeemedByCode: async (
    code: string,
    userId: string,
    campaignId: string,
    client?: Queryable
  ): Promise<IQrCode | null> => {
    const db = client ?? pool;
    const result = await db.query<QrCodeRow>(
      `UPDATE qr_codes
       SET redeemed = true,
           redeemed_by = $2,
           redeemed_at = NOW(),
           campaign_id = $3,
           updated_at = NOW()
       WHERE code = $1 AND redeemed = false
       RETURNING ${CODE_COLUMNS}`,
      [code, userId, campaignId]
    );
    return result.rows[0] ? mapQrCodeRow(result.rows[0]) : null;
  },
};
