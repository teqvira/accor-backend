import pool from '../../../database/connection';
import { ICampaign } from '../types/campaigns.types';

interface CampaignRow {
  id: string;
  name: string;
  wallet_amount: string | number;
  reward_points: number;
  start_date: Date;
  end_date: Date;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export function mapCampaignRow(row: CampaignRow): ICampaign {
  return {
    _id: row.id,
    name: row.name,
    walletAmount: Number(row.wallet_amount),
    rewardPoints: row.reward_points,
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CAMPAIGN_COLUMNS = `
  id, name, wallet_amount, reward_points, start_date, end_date,
  active, created_at, updated_at
`;

export interface CreateCampaignData {
  name: string;
  walletAmount: number;
  rewardPoints: number;
  startDate: Date;
  endDate: Date;
  active?: boolean;
}

export interface UpdateCampaignData {
  name: string;
  walletAmount: number;
  rewardPoints: number;
  startDate: Date;
  endDate: Date;
}

export const campaignRepository = {
  create: async (data: CreateCampaignData): Promise<ICampaign> => {
    const result = await pool.query<CampaignRow>(
      `INSERT INTO campaigns
         (name, wallet_amount, reward_points, start_date, end_date, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CAMPAIGN_COLUMNS}`,
      [
        data.name,
        data.walletAmount,
        data.rewardPoints,
        data.startDate,
        data.endDate,
        data.active ?? false,
      ]
    );
    return mapCampaignRow(result.rows[0]);
  },

  findById: async (id: string): Promise<ICampaign | null> => {
    const result = await pool.query<CampaignRow>(
      `SELECT ${CAMPAIGN_COLUMNS} FROM campaigns WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapCampaignRow(result.rows[0]) : null;
  },

  findByIds: async (ids: string[]): Promise<ICampaign[]> => {
    if (ids.length === 0) return [];
    const result = await pool.query<CampaignRow>(
      `SELECT ${CAMPAIGN_COLUMNS} FROM campaigns WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    return result.rows.map(mapCampaignRow);
  },

  findAll: async (
    page = 1,
    limit = 20
  ): Promise<{ items: ICampaign[]; total: number }> => {
    const offset = (page - 1) * limit;
    const [itemsResult, countResult] = await Promise.all([
      pool.query<CampaignRow>(
        `SELECT ${CAMPAIGN_COLUMNS}
         FROM campaigns
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM campaigns`
      ),
    ]);
    return {
      items: itemsResult.rows.map(mapCampaignRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  findActive: async (): Promise<ICampaign[]> => {
    const result = await pool.query<CampaignRow>(
      `SELECT ${CAMPAIGN_COLUMNS}
       FROM campaigns
       WHERE active = true
       ORDER BY created_at DESC`
    );
    return result.rows.map(mapCampaignRow);
  },

  count: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM campaigns`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  countActive: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM campaigns WHERE active = true`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  update: async (id: string, data: UpdateCampaignData): Promise<ICampaign | null> => {
    const result = await pool.query<CampaignRow>(
      `UPDATE campaigns
       SET name = $2,
           wallet_amount = $3,
           reward_points = $4,
           start_date = $5,
           end_date = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${CAMPAIGN_COLUMNS}`,
      [
        id,
        data.name,
        data.walletAmount,
        data.rewardPoints,
        data.startDate,
        data.endDate,
      ]
    );
    return result.rows[0] ? mapCampaignRow(result.rows[0]) : null;
  },

  setActive: async (id: string, active: boolean): Promise<ICampaign | null> => {
    const result = await pool.query<CampaignRow>(
      `UPDATE campaigns
       SET active = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING ${CAMPAIGN_COLUMNS}`,
      [id, active]
    );
    return result.rows[0] ? mapCampaignRow(result.rows[0]) : null;
  },
};
