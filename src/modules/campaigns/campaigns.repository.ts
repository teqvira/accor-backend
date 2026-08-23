import { PoolClient } from 'pg';
import pool from '../../database/connection';
import {
  ActiveCampaignMultiplier,
  CampaignBonusTarget,
  CampaignFilterParams,
  CampaignStatus,
  CreateCampaignInput,
  ICampaign,
  UpdateCampaignInput,
} from './campaigns.types';
import { normalizeBonusTarget } from './campaigns.validator';

interface CampaignRow {
  id: string;
  campaign_code: string;
  name: string;
  product_id: string;
  multiplier: string | number;
  apply_bonus_to?: string | null;
  pincode_scope?: string | null;
  pincode?: string | null;
  pincodes?: string[] | null;
  start_date: Date;
  end_date: Date;
  active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  product_sku_code?: string | null;
  product_name?: string | null;
  product_brand?: string | null;
  batch_ids?: string[] | null;
  batches_info?: any[] | null;
}

export function parseStartDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) return dateInput;
  const str = String(dateInput).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, yStr, mStr, dStr] = match;
    if (!str.includes('T') || str.includes('T00:00:00')) {
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    }
  }
  return new Date(str);
}

export function parseEndDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) return dateInput;
  const str = String(dateInput).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, yStr, mStr, dStr] = match;
    if (!str.includes('T') || str.includes('T00:00:00') || str.includes('T23:59:59')) {
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      return new Date(y, m - 1, d, 23, 59, 59, 999);
    }
  }
  return new Date(str);
}

export function computeCampaignStatus(
  startDate: Date,
  endDate: Date,
  active: boolean
): CampaignStatus {
  if (!active) return CampaignStatus.INACTIVE;
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now > end) return CampaignStatus.EXPIRED;

  if (now < start) {
    const isSameOrPastDay =
      now.getFullYear() > start.getFullYear() ||
      (now.getFullYear() === start.getFullYear() &&
        (now.getMonth() > start.getMonth() ||
          (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate())));

    if (!isSameOrPastDay) {
      return CampaignStatus.UPCOMING;
    }
  }

  return CampaignStatus.ACTIVE;
}

function mapCampaignRow(row: CampaignRow): ICampaign {
  const status = computeCampaignStatus(
    row.start_date,
    row.end_date,
    row.active
  );

  const applyBonusTo: CampaignBonusTarget =
    row.apply_bonus_to === 'cash' || row.apply_bonus_to === 'reward'
      ? row.apply_bonus_to
      : 'both';

  const pincodesArray = Array.isArray(row.pincodes)
    ? row.pincodes
    : row.pincode
      ? [row.pincode]
      : [];

  const campaign: ICampaign = {
    _id: row.id,
    campaignCode: row.campaign_code,
    name: row.name,
    productId: row.product_id,
    multiplier: Number(row.multiplier),
    applyBonusTo,
    bonusType: applyBonusTo,
    pincodeScope: (row.pincode_scope === 'specific' ? 'specific' : 'all'),
    pincode: row.pincode ?? (pincodesArray[0] || undefined),
    pincodes: pincodesArray,
    allPincodes: row.pincode_scope !== 'specific',
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.active,
    status,
    batchIds: row.batch_ids ?? [],
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.product_sku_code && row.product_name) {
    campaign.product = {
      id: row.product_id,
      skuCode: row.product_sku_code,
      name: row.product_name,
      brand: row.product_brand ?? undefined,
    };
  }

  const rawBatches = typeof row.batches_info === 'string'
    ? JSON.parse(row.batches_info)
    : row.batches_info;

  if (Array.isArray(rawBatches) && rawBatches.length > 0) {
    campaign.batches = rawBatches
      .filter((b) => b && b.id)
      .map((b) => ({
        id: b.id,
        name: b.name,
        couponName: b.coupon_name ?? undefined,
        walletAmount: Number(b.wallet_amount),
        rewardPoints: Number(b.reward_points),
      }));
  }

  return campaign;
}

export const campaignsRepository = {
  create: async (
    data: CreateCampaignInput & { campaignCode: string; createdBy?: string },
    client?: PoolClient
  ): Promise<ICampaign> => {
    const db = client || pool;

    const applyBonusTo = normalizeBonusTarget(
      data.applyBonusTo || data.bonusType || data.type || 'both'
    );

    const isAll =
      data.allPincodes === true ||
      data.pincodeScope === 'all' ||
      (!data.pincodes?.length && !data.pincode && data.pincodeScope !== 'specific');

    const pincodeScope = isAll ? 'all' : 'specific';
    const pincodesArray: string[] = isAll
      ? []
      : data.pincodes && data.pincodes.length > 0
        ? data.pincodes
        : data.pincode
          ? [data.pincode]
          : [];
    const singlePincode = isAll ? null : (pincodesArray[0] || data.pincode || null);

    const result = await db.query<CampaignRow>(
      `INSERT INTO campaigns
         (campaign_code, name, product_id, multiplier, start_date, end_date, active, created_by, pincode_scope, pincode, apply_bonus_to, pincodes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        data.campaignCode,
        data.name,
        data.productId,
        data.multiplier,
        parseStartDate(data.startDate),
        parseEndDate(data.endDate),
        data.active ?? true,
        data.createdBy || null,
        pincodeScope,
        singlePincode,
        applyBonusTo,
        pincodesArray,
      ]
    );

    const campaignId = result.rows[0].id;

    if (data.batchIds && data.batchIds.length > 0) {
      const values: string[] = [];
      const queryParams: any[] = [campaignId];
      let paramIdx = 2;

      for (const batchId of data.batchIds) {
        values.push(`($1, $${paramIdx})`);
        queryParams.push(batchId);
        paramIdx++;
      }

      await db.query(
        `INSERT INTO campaign_batches (campaign_id, batch_id) VALUES ${values.join(', ')}`,
        queryParams
      );
    }

    const fetched = await campaignsRepository.findById(campaignId, client);
    return fetched!;
  },

  findById: async (id: string, client?: PoolClient): Promise<ICampaign | null> => {
    const db = client || pool;
    const result = await db.query<CampaignRow>(
      `SELECT c.*,
              p.sku_code AS product_sku_code,
              p.name AS product_name,
              p.brand AS product_brand,
              COALESCE(
                (SELECT ARRAY_AGG(cb.batch_id) FROM campaign_batches cb WHERE cb.campaign_id = c.id),
                '{}'::uuid[]
              ) AS batch_ids,
              COALESCE(
                (
                  SELECT JSON_AGG(
                    JSON_BUILD_OBJECT(
                      'id', b.id,
                      'name', b.name,
                      'coupon_name', b.coupon_name,
                      'wallet_amount', b.wallet_amount,
                      'reward_points', b.reward_points
                    )
                  )
                  FROM campaign_batches cb
                  JOIN qr_batches b ON b.id = cb.batch_id
                  WHERE cb.campaign_id = c.id
                ),
                '[]'::json
              ) AS batches_info
       FROM campaigns c
       LEFT JOIN products p ON p.id = c.product_id
       WHERE c.id = $1`,
      [id]
    );

    return result.rows[0] ? mapCampaignRow(result.rows[0]) : null;
  },

  findAll: async (
    params: CampaignFilterParams
  ): Promise<{ items: ICampaign[]; total: number }> => {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (params.status) {
      if (params.status === CampaignStatus.ACTIVE) {
        whereClauses.push(
          `c.active = true AND (NOW() AT TIME ZONE 'Asia/Kolkata')::date >= (c.start_date AT TIME ZONE 'Asia/Kolkata')::date AND NOW() <= c.end_date`
        );
      } else if (params.status === CampaignStatus.UPCOMING) {
        whereClauses.push(
          `c.active = true AND (NOW() AT TIME ZONE 'Asia/Kolkata')::date < (c.start_date AT TIME ZONE 'Asia/Kolkata')::date`
        );
      } else if (params.status === CampaignStatus.EXPIRED) {
        whereClauses.push(`c.active = true AND NOW() > c.end_date`);
      } else if (params.status === CampaignStatus.INACTIVE) {
        whereClauses.push(`c.active = false`);
      }
    }

    if (params.productId) {
      whereClauses.push(`c.product_id = $${paramIdx}`);
      queryParams.push(params.productId);
      paramIdx++;
    }

    if (params.search) {
      whereClauses.push(
        `(c.name ILIKE $${paramIdx} OR c.campaign_code ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx})`
      );
      queryParams.push(`%${params.search}%`);
      paramIdx++;
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*)::text AS count
      FROM campaigns c
      LEFT JOIN products p ON p.id = c.product_id
      ${whereSql}
    `;

    const dataQuery = `
      SELECT c.*,
             p.sku_code AS product_sku_code,
             p.name AS product_name,
             p.brand AS product_brand,
             COALESCE(
               (SELECT ARRAY_AGG(cb.batch_id) FROM campaign_batches cb WHERE cb.campaign_id = c.id),
               '{}'::uuid[]
             ) AS batch_ids,
             COALESCE(
               (
                 SELECT JSON_AGG(
                   JSON_BUILD_OBJECT(
                     'id', b.id,
                     'name', b.name,
                     'coupon_name', b.coupon_name,
                     'wallet_amount', b.wallet_amount,
                     'reward_points', b.reward_points
                   )
                 )
                 FROM campaign_batches cb
                 JOIN qr_batches b ON b.id = cb.batch_id
                 WHERE cb.campaign_id = c.id
               ),
               '[]'::json
             ) AS batches_info
      FROM campaigns c
      LEFT JOIN products p ON p.id = c.product_id
      ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const [itemsResult, countResult] = await Promise.all([
      pool.query<CampaignRow>(dataQuery, [...queryParams, limit, offset]),
      pool.query<{ count: string }>(countQuery, queryParams),
    ]);

    return {
      items: itemsResult.rows.map(mapCampaignRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  update: async (
    id: string,
    data: UpdateCampaignInput,
    client?: PoolClient
  ): Promise<ICampaign | null> => {
    const db = client || pool;

    const setClauses: string[] = [];
    const queryParams: any[] = [id];
    let paramIdx = 2;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIdx}`);
      queryParams.push(data.name);
      paramIdx++;
    }

    if (data.campaignCode !== undefined) {
      setClauses.push(`campaign_code = $${paramIdx}`);
      queryParams.push(data.campaignCode);
      paramIdx++;
    }

    if (data.productId !== undefined) {
      setClauses.push(`product_id = $${paramIdx}`);
      queryParams.push(data.productId);
      paramIdx++;
    }

    if (data.multiplier !== undefined) {
      setClauses.push(`multiplier = $${paramIdx}`);
      queryParams.push(data.multiplier);
      paramIdx++;
    }

    if (
      data.applyBonusTo !== undefined ||
      data.bonusType !== undefined ||
      data.type !== undefined
    ) {
      const applyBonusTo = normalizeBonusTarget(
        data.applyBonusTo || data.bonusType || data.type
      );
      setClauses.push(`apply_bonus_to = $${paramIdx}`);
      queryParams.push(applyBonusTo);
      paramIdx++;
    }

    const hasPincodeUpdate =
      data.allPincodes !== undefined ||
      data.pincodeScope !== undefined ||
      data.pincodes !== undefined ||
      data.pincode !== undefined;

    if (hasPincodeUpdate) {
      const isAll =
        data.allPincodes === true ||
        data.pincodeScope === 'all' ||
        (data.allPincodes === undefined && data.pincodeScope === undefined && !data.pincodes?.length && !data.pincode);

      const pincodeScope = isAll ? 'all' : 'specific';
      const pincodesArray: string[] = isAll
        ? []
        : data.pincodes && data.pincodes.length > 0
          ? data.pincodes
          : data.pincode
            ? [data.pincode]
            : [];
      const singlePincode = isAll ? null : (pincodesArray[0] || data.pincode || null);

      setClauses.push(`pincode_scope = $${paramIdx}`);
      queryParams.push(pincodeScope);
      paramIdx++;

      setClauses.push(`pincode = $${paramIdx}`);
      queryParams.push(singlePincode);
      paramIdx++;

      setClauses.push(`pincodes = $${paramIdx}`);
      queryParams.push(pincodesArray);
      paramIdx++;
    }

    if (data.startDate !== undefined) {
      setClauses.push(`start_date = $${paramIdx}`);
      queryParams.push(parseStartDate(data.startDate));
      paramIdx++;
    }

    if (data.endDate !== undefined) {
      setClauses.push(`end_date = $${paramIdx}`);
      queryParams.push(parseEndDate(data.endDate));
      paramIdx++;
    }

    if (data.active !== undefined) {
      setClauses.push(`active = $${paramIdx}`);
      queryParams.push(data.active);
      paramIdx++;
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`);
      await db.query(
        `UPDATE campaigns SET ${setClauses.join(', ')} WHERE id = $1`,
        queryParams
      );
    }

    if (data.batchIds !== undefined) {
      await db.query(`DELETE FROM campaign_batches WHERE campaign_id = $1`, [id]);

      if (data.batchIds.length > 0) {
        const values: string[] = [];
        const batchQueryParams: any[] = [id];
        let bIdx = 2;

        for (const batchId of data.batchIds) {
          values.push(`($1, $${bIdx})`);
          batchQueryParams.push(batchId);
          bIdx++;
        }

        await db.query(
          `INSERT INTO campaign_batches (campaign_id, batch_id) VALUES ${values.join(', ')}`,
          batchQueryParams
        );
      }
    }

    return campaignsRepository.findById(id, client);
  },

  delete: async (id: string, client?: PoolClient): Promise<boolean> => {
    const db = client || pool;
    const result = await db.query(`DELETE FROM campaigns WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },

  findActiveCampaignForBatch: async (
    batchId: string,
    client?: PoolClient
  ): Promise<ActiveCampaignMultiplier | null> => {
    const db = client || pool;
    const result = await db.query<{
      id: string;
      campaign_code: string;
      name: string;
      multiplier: string | number;
      apply_bonus_to: string | null;
      pincode_scope: string | null;
      pincode: string | null;
      pincodes: string[] | null;
    }>(
      `SELECT c.id, c.campaign_code, c.name, c.multiplier, c.apply_bonus_to, c.pincode_scope, c.pincode, c.pincodes
       FROM campaigns c
       JOIN campaign_batches cb ON cb.campaign_id = c.id
       WHERE cb.batch_id = $1
         AND c.active = true
         AND (NOW() AT TIME ZONE 'Asia/Kolkata')::date >= (c.start_date AT TIME ZONE 'Asia/Kolkata')::date
         AND NOW() <= c.end_date
       ORDER BY c.multiplier DESC, c.created_at DESC
       LIMIT 1`,
      [batchId]
    );

    if (!result.rows[0]) return null;

    const row = result.rows[0];
    const applyBonusTo: CampaignBonusTarget =
      row.apply_bonus_to === 'cash' || row.apply_bonus_to === 'reward'
        ? row.apply_bonus_to
        : 'both';

    const pincodesArray = Array.isArray(row.pincodes)
      ? row.pincodes
      : row.pincode
        ? [row.pincode]
        : [];

    return {
      campaignId: row.id,
      campaignCode: row.campaign_code,
      campaignName: row.name,
      multiplier: Number(row.multiplier),
      applyBonusTo,
      pincodeScope: row.pincode_scope === 'specific' ? 'specific' : 'all',
      pincode: row.pincode ?? (pincodesArray[0] || undefined),
      pincodes: pincodesArray,
    };
  },

  findActiveCampaignsForUser: async (
    userPincode?: string | null,
    client?: PoolClient
  ): Promise<ICampaign[]> => {
    const db = client || pool;
    const pincode = userPincode ? userPincode.trim() : null;

    const result = await db.query<CampaignRow>(
      `SELECT c.*,
              p.sku_code AS product_sku_code,
              p.name AS product_name,
              p.brand AS product_brand,
              COALESCE(
                (SELECT ARRAY_AGG(cb.batch_id) FROM campaign_batches cb WHERE cb.campaign_id = c.id),
                '{}'::uuid[]
              ) AS batch_ids,
              COALESCE(
                (
                  SELECT JSON_AGG(
                    JSON_BUILD_OBJECT(
                      'id', b.id,
                      'name', b.name,
                      'coupon_name', b.coupon_name,
                      'wallet_amount', b.wallet_amount,
                      'reward_points', b.reward_points
                    )
                  )
                  FROM campaign_batches cb
                  JOIN qr_batches b ON b.id = cb.batch_id
                  WHERE cb.campaign_id = c.id
                ),
                '[]'::json
              ) AS batches_info
       FROM campaigns c
       LEFT JOIN products p ON p.id = c.product_id
       WHERE c.active = true
         AND (NOW() AT TIME ZONE 'Asia/Kolkata')::date >= (c.start_date AT TIME ZONE 'Asia/Kolkata')::date
         AND NOW() <= c.end_date
         AND (
           c.pincode_scope = 'all'
           OR (
             c.pincode_scope = 'specific'
             AND $1::varchar IS NOT NULL
             AND ($1 = ANY(c.pincodes) OR $1 = c.pincode)
           )
         )
       ORDER BY c.created_at DESC`,
      [pincode]
    );

    return result.rows.map(mapCampaignRow);
  },

  findByCode: async (code: string, client?: PoolClient): Promise<ICampaign | null> => {
    const db = client || pool;
    const result = await db.query<{ id: string }>(
      `SELECT id FROM campaigns WHERE campaign_code = $1`,
      [code]
    );
    if (!result.rows[0]) return null;
    return campaignsRepository.findById(result.rows[0].id, client);
  },

  validateBatchesBelongToProduct: async (
    productId: string,
    batchIds: string[],
    client?: PoolClient
  ): Promise<boolean> => {
    if (!batchIds || batchIds.length === 0) return true;
    const db = client || pool;
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM qr_batches
       WHERE product_id = $1 AND id = ANY($2::uuid[])`,
      [productId, batchIds]
    );
    const validCount = Number(result.rows[0]?.count ?? 0);
    return validCount === batchIds.length;
  },

  getStats: async (client?: PoolClient): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    upcomingCampaigns: number;
  }> => {
    const db = client || pool;
    const result = await db.query<{
      total_campaigns: string;
      active_campaigns: string;
      upcoming_campaigns: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_campaigns,
         COUNT(*) FILTER (
           WHERE active = true
             AND (NOW() AT TIME ZONE 'Asia/Kolkata')::date >= (start_date AT TIME ZONE 'Asia/Kolkata')::date
             AND NOW() <= end_date
         )::text AS active_campaigns,
         COUNT(*) FILTER (
           WHERE active = true
             AND (NOW() AT TIME ZONE 'Asia/Kolkata')::date < (start_date AT TIME ZONE 'Asia/Kolkata')::date
         )::text AS upcoming_campaigns
       FROM campaigns`
    );

    const row = result.rows[0];
    return {
      totalCampaigns: Number(row?.total_campaigns ?? 0),
      activeCampaigns: Number(row?.active_campaigns ?? 0),
      upcomingCampaigns: Number(row?.upcoming_campaigns ?? 0),
    };
  },
};
