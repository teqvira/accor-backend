import pool from '../../../database/connection';
import {
  DEFAULT_QR_LABEL_COLOR,
  DEFAULT_QR_LABEL_SHAPE,
  QrLabelColor,
  QrLabelShape,
} from '../constants/qr-label.constants';
import { IQrBatch, QrBatchListFilters, QrBatchStatus } from '../qr.types';

interface QrBatchRow {
  id: string;
  name: string;
  coupon_name: string | null;
  total_qrs: number;
  generated_count: number;
  product_id: string | null;
  wallet_amount: string | number;
  reward_points: number;
  start_date: Date | null;
  end_date: Date | null;
  active: boolean;
  status: QrBatchStatus;
  label_shape: QrLabelShape;
  label_color: QrLabelColor;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  product_sku_code?: string | null;
  product_name?: string | null;
  product_image_url?: string | null;
  product_color?: string | null;
  redeemed_count?: string | number;
  pending_count?: string | number;
}

const BATCH_COLUMNS = `
  b.id, b.name, b.coupon_name, b.total_qrs, b.generated_count, b.product_id,
  b.wallet_amount, b.reward_points, b.start_date, b.end_date, b.active,
  b.status, b.label_shape, b.label_color, b.created_by, b.created_at, b.updated_at
`;

const BATCH_RETURNING = `
  id, name, coupon_name, total_qrs, generated_count, product_id,
  wallet_amount, reward_points, start_date, end_date, active,
  status, label_shape, label_color, created_by, created_at, updated_at
`;

export function mapQrBatchRow(row: QrBatchRow): IQrBatch {
  const batch: IQrBatch = {
    _id: row.id,
    name: row.name,
    couponName: row.coupon_name ?? undefined,
    totalQrs: row.total_qrs,
    generatedCount: row.generated_count,
    productId: row.product_id ?? undefined,
    walletAmount: Number(row.wallet_amount),
    rewardPoints: row.reward_points,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    active: row.active,
    status: row.status,
    labelShape: row.label_shape ?? DEFAULT_QR_LABEL_SHAPE,
    labelColor: row.label_color ?? DEFAULT_QR_LABEL_COLOR,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.product_id && row.product_sku_code && row.product_name) {
    batch.product = {
      id: row.product_id,
      skuCode: row.product_sku_code,
      name: row.product_name,
      imageUrl: row.product_image_url ?? undefined,
      color: row.product_color ?? undefined,
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
  couponName?: string;
  totalQrs: number;
  productId: string;
  walletAmount: number;
  rewardPoints: number;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  generatedCount?: number;
  status?: QrBatchStatus;
  labelShape: QrLabelShape;
  labelColor: QrLabelColor;
  createdBy?: string;
}

export interface UpdateQrBatchData {
  couponName?: string | null;
  totalQrs?: number;
  productId?: string;
  walletAmount?: number;
  rewardPoints?: number;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
  labelShape?: QrLabelShape;
  labelColor?: QrLabelColor;
}

export function buildBatchWhereClause(filters: QrBatchListFilters = {}): {
  clause: string;
  values: unknown[];
} {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.search?.trim()) {
    const searchPattern = `%${filters.search.trim()}%`;
    conditions.push(
      `(b.coupon_name ILIKE $${paramIndex} OR ` +
        `b.name ILIKE $${paramIndex} OR ` +
        `b.id::text ILIKE $${paramIndex} OR ` +
        `p.sku_code ILIKE $${paramIndex} OR ` +
        `p.name ILIKE $${paramIndex})`
    );
    values.push(searchPattern);
    paramIndex++;
  }

  if (filters.status) {
    const normalized = filters.status.trim().toLowerCase();
    if (normalized === 'active') {
      conditions.push('b.active = true');
    } else if (normalized === 'inactive') {
      conditions.push('b.active = false');
    } else if (normalized === 'draft' || normalized === 'generated') {
      conditions.push(`b.status = $${paramIndex++}`);
      values.push(normalized);
    }
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, values };
}

export const qrBatchRepository = {
  create: async (data: CreateQrBatchData): Promise<IQrBatch> => {
    const result = await pool.query<QrBatchRow>(
      `INSERT INTO qr_batches
         (name, coupon_name, total_qrs, generated_count, product_id,
          wallet_amount, reward_points, start_date, end_date, active, status,
          label_shape, label_color, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING ${BATCH_RETURNING}`,
      [
        data.name,
        data.couponName ?? null,
        data.totalQrs,
        data.generatedCount ?? 0,
        data.productId,
        data.walletAmount,
        data.rewardPoints,
        data.startDate ?? null,
        data.endDate ?? null,
        data.active ?? true,
        data.status ?? QrBatchStatus.DRAFT,
        data.labelShape,
        data.labelColor,
        data.createdBy ?? null,
      ]
    );
    return mapQrBatchRow(result.rows[0]);
  },

  findById: async (id: string): Promise<IQrBatch | null> => {
    try {
      const result = await pool.query<QrBatchRow>(
        `SELECT ${BATCH_COLUMNS},
                p.sku_code AS product_sku_code,
                p.name AS product_name,
                p.image_url AS product_image_url,
                p.color AS product_color,
                COUNT(qc.id) FILTER (WHERE qc.redeemed = true)::text AS redeemed_count,
                COUNT(qc.id) FILTER (WHERE qc.redeemed = false)::text AS pending_count
         FROM qr_batches b
         LEFT JOIN products p ON p.id = b.product_id
         LEFT JOIN qr_codes qc ON qc.batch_id = b.id
         WHERE b.id = $1
         GROUP BY b.id, p.sku_code, p.name, p.image_url, p.color`,
        [id]
      );
      return result.rows[0] ? mapQrBatchRow(result.rows[0]) : null;
    } catch (err) {
      if (
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === '22P02'
      ) {
        return null;
      }
      throw err;
    }
  },

  findAll: async (
    page = 1,
    limit = 20,
    filters: QrBatchListFilters = {}
  ): Promise<{ items: IQrBatch[]; total: number }> => {
    const offset = (page - 1) * limit;
    const { clause, values } = buildBatchWhereClause(filters);

    const [itemsResult, countResult] = await Promise.all([
      pool.query<QrBatchRow>(
        `SELECT ${BATCH_COLUMNS},
                p.sku_code AS product_sku_code,
                p.name AS product_name,
                p.image_url AS product_image_url,
                p.color AS product_color,
                COUNT(qc.id) FILTER (WHERE qc.redeemed = true)::text AS redeemed_count,
                COUNT(qc.id) FILTER (WHERE qc.redeemed = false)::text AS pending_count
         FROM qr_batches b
         LEFT JOIN products p ON p.id = b.product_id
         LEFT JOIN qr_codes qc ON qc.batch_id = b.id
         ${clause}
         GROUP BY b.id, p.sku_code, p.name, p.image_url, p.color
         ORDER BY b.created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM qr_batches b
         LEFT JOIN products p ON p.id = b.product_id
         ${clause}`,
        values
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

  update: async (
    id: string,
    data: UpdateQrBatchData
  ): Promise<IQrBatch | null> => {
    const sets: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    const assign = (column: string, value: unknown) => {
      sets.push(`${column} = $${paramIndex++}`);
      values.push(value);
    };

    if (data.couponName !== undefined) assign('coupon_name', data.couponName);
    if (data.totalQrs !== undefined) assign('total_qrs', data.totalQrs);
    if (data.productId !== undefined) assign('product_id', data.productId);
    if (data.walletAmount !== undefined) assign('wallet_amount', data.walletAmount);
    if (data.rewardPoints !== undefined) assign('reward_points', data.rewardPoints);
    if (data.startDate !== undefined) assign('start_date', data.startDate);
    if (data.endDate !== undefined) assign('end_date', data.endDate);
    if (data.active !== undefined) assign('active', data.active);
    if (data.labelShape !== undefined) assign('label_shape', data.labelShape);
    if (data.labelColor !== undefined) assign('label_color', data.labelColor);

    if (sets.length === 0) {
      return qrBatchRepository.findById(id);
    }

    const result = await pool.query<QrBatchRow>(
      `UPDATE qr_batches
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING ${BATCH_RETURNING}`,
      values
    );
    return result.rows[0] ? mapQrBatchRow(result.rows[0]) : null;
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

  findOptionsByProductId: async (
    productId?: string,
    search?: string
  ): Promise<IQrBatch[]> => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (productId) {
      conditions.push(`b.product_id = $${paramIndex++}`);
      values.push(productId);
    }

    if (search?.trim()) {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(
        `(b.coupon_name ILIKE $${paramIndex} OR ` +
          `b.name ILIKE $${paramIndex} OR ` +
          `p.sku_code ILIKE $${paramIndex} OR ` +
          `p.name ILIKE $${paramIndex})`
      );
      values.push(searchPattern);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query<QrBatchRow>(
      `SELECT ${BATCH_COLUMNS},
              p.sku_code AS product_sku_code,
              p.name AS product_name,
              p.image_url AS product_image_url,
              p.color AS product_color
       FROM qr_batches b
       LEFT JOIN products p ON p.id = b.product_id
       ${whereClause}
       ORDER BY b.created_at DESC`,
      values
    );
    return result.rows.map(mapQrBatchRow);
  },
};

