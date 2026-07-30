import { PoolClient } from 'pg';
import pool from '../../database/connection';
import { CreateRewardCatalogData, IRewardCatalogItem, RewardCategory } from './rewards.types';

type Queryable = Pick<PoolClient, 'query'>;

interface RewardCatalogRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  points_cost: number;
  image_url: string | null;
  stock_quantity: number | null;
  status: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: RewardCatalogRow): IRewardCatalogItem {
  return {
    _id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    category: row.category as RewardCategory,
    pointsCost: row.points_cost,
    imageUrl: row.image_url,
    stockQuantity: row.stock_quantity,
    status: row.status as IRewardCatalogItem['status'],
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLS = `
  id, code, name, description, category, points_cost, image_url,
  stock_quantity, status, sort_order, created_at, updated_at
`;

export const rewardCatalogRepository = {
  create: async (
    data: CreateRewardCatalogData,
    client?: Queryable
  ): Promise<IRewardCatalogItem> => {
    const q = client || pool;
    const result = await q.query<RewardCatalogRow>(
      `INSERT INTO reward_catalog (
        code, name, description, category, points_cost, image_url,
        stock_quantity, status, sort_order
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLS}`,
      [
        data.code,
        data.name,
        data.description ?? null,
        data.category ?? 'other',
        data.pointsCost,
        data.imageUrl ?? null,
        data.stockQuantity ?? null,
        data.status ?? 'active',
        data.sortOrder ?? 0,
      ]
    );

    return mapRow(result.rows[0]);
  },

  findActive: async (
    page = 1,
    limit = 20,
    category?: RewardCategory
  ): Promise<{ items: IRewardCatalogItem[]; total: number }> => {
    const offset = (page - 1) * limit;
    const conditions: string[] = [`status = 'active'`];
    const values: unknown[] = [];
    let i = 1;

    if (category) {
      conditions.push(`category = $${i++}`);
      values.push(category);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [itemsResult, countResult] = await Promise.all([
      pool.query<RewardCatalogRow>(
        `SELECT ${COLS} FROM reward_catalog
         ${where}
         ORDER BY sort_order ASC, created_at ASC
         LIMIT $${i++} OFFSET $${i}`,
        [...values, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM reward_catalog ${where}`,
        values
      ),
    ]);

    return {
      items: itemsResult.rows.map(mapRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  /** Lock the row FOR UPDATE inside a transaction. */
  findByIdForUpdate: async (
    id: string,
    client: Queryable
  ): Promise<IRewardCatalogItem | null> => {
    const result = await client.query<RewardCatalogRow>(
      `SELECT ${COLS} FROM reward_catalog WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  decrementStock: async (
    id: string,
    client: Queryable
  ): Promise<void> => {
    await client.query(
      `UPDATE reward_catalog
       SET stock_quantity = stock_quantity - 1, updated_at = NOW()
       WHERE id = $1 AND stock_quantity IS NOT NULL`,
      [id]
    );
  },
};

