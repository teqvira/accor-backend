import pool from '../../../database/connection';
import { ProductStatus, ProductType } from '../constants/products.constants';
import {
  IProduct,
  ProductListFilters,
} from '../types/products.types';

interface ProductRow {
  id: string;
  sku_code: string;
  name: string;
  product_type: ProductType;
  brand: string | null;
  coupon_code: string | null;
  status: ProductStatus;
  description: string | null;
  image_url: string | null;
  created_at: Date;
  updated_at: Date;
  active_coupons?: string | number;
}

const PRODUCT_LIST_COLUMNS = `
  p.id, p.sku_code, p.name, p.product_type, p.brand, p.coupon_code, p.status,
  p.description, p.image_url, p.created_at, p.updated_at
`;

export function mapProductRow(row: ProductRow): IProduct {
  return {
    _id: row.id,
    skuCode: row.sku_code,
    name: row.name,
    productType: row.product_type,
    brand: row.brand ?? undefined,
    couponCode: row.coupon_code ?? undefined,
    status: row.status,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    activeCoupons:
      row.active_coupons !== undefined ? Number(row.active_coupons) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateProductData {
  skuCode: string;
  name: string;
  productType: ProductType;
  brand?: string;
  couponCode?: string;
  status?: ProductStatus;
  description?: string;
  imageUrl?: string;
}

export interface UpdateProductData {
  skuCode?: string;
  name?: string;
  productType?: ProductType;
  brand?: string | null;
  couponCode?: string | null;
  status?: ProductStatus;
  description?: string | null;
  imageUrl?: string | null;
}

function buildListWhereClause(filters: ProductListFilters): {
  clause: string;
  values: unknown[];
} {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.productType) {
    conditions.push(`p.product_type = $${paramIndex++}`);
    values.push(filters.productType);
  }

  if (filters.status) {
    conditions.push(`p.status = $${paramIndex++}`);
    values.push(filters.status);
  }

  if (filters.brand) {
    conditions.push(`p.brand ILIKE $${paramIndex++}`);
    values.push(`%${filters.brand}%`);
  }

  if (filters.search) {
    conditions.push(
      `(p.name ILIKE $${paramIndex} OR p.sku_code ILIKE $${paramIndex})`
    );
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const clause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { clause, values };
}

export const productRepository = {
  create: async (data: CreateProductData): Promise<IProduct> => {
    const result = await pool.query<ProductRow>(
      `INSERT INTO products
         (sku_code, name, product_type, brand, coupon_code, status, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, sku_code, name, product_type, brand, coupon_code, status,
                 description, image_url, created_at, updated_at`,
      [
        data.skuCode,
        data.name,
        data.productType,
        data.brand ?? null,
        data.couponCode ?? null,
        data.status ?? 'active',
        data.description ?? null,
        data.imageUrl ?? null,
      ]
    );
    return mapProductRow(result.rows[0]);
  },

  findById: async (id: string): Promise<IProduct | null> => {
    const result = await pool.query<ProductRow>(
      `SELECT ${PRODUCT_LIST_COLUMNS},
              COALESCE(SUM(b.generated_count), 0)::text AS active_coupons
       FROM products p
       LEFT JOIN qr_batches b ON b.product_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );
    return result.rows[0] ? mapProductRow(result.rows[0]) : null;
  },

  findBySkuCode: async (skuCode: string): Promise<IProduct | null> => {
    const result = await pool.query<ProductRow>(
      `SELECT id, sku_code, name, product_type, brand, coupon_code, status,
              description, image_url, created_at, updated_at
       FROM products WHERE sku_code = $1`,
      [skuCode]
    );
    return result.rows[0] ? mapProductRow(result.rows[0]) : null;
  },

  findAll: async (
    page = 1,
    limit = 20,
    filters: ProductListFilters = {}
  ): Promise<{ items: IProduct[]; total: number }> => {
    const offset = (page - 1) * limit;
    const { clause, values } = buildListWhereClause(filters);

    const [itemsResult, countResult] = await Promise.all([
      pool.query<ProductRow>(
        `SELECT ${PRODUCT_LIST_COLUMNS},
                COALESCE(SUM(b.generated_count), 0)::text AS active_coupons
         FROM products p
         LEFT JOIN qr_batches b ON b.product_id = p.id
         ${clause}
         GROUP BY p.id
         ORDER BY p.created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM products p ${clause}`,
        values
      ),
    ]);

    return {
      items: itemsResult.rows.map(mapProductRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  countActive: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM products WHERE status = 'active'`
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  update: async (
    id: string,
    data: UpdateProductData & {
      skuCode: string;
      name: string;
      productType: ProductType;
      status: ProductStatus;
    }
  ): Promise<IProduct | null> => {
    const result = await pool.query<ProductRow>(
      `UPDATE products
       SET sku_code = $2,
           name = $3,
           product_type = $4,
           brand = $5,
           coupon_code = $6,
           status = $7,
           description = $8,
           image_url = $9,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, sku_code, name, product_type, brand, coupon_code, status,
                 description, image_url, created_at, updated_at`,
      [
        id,
        data.skuCode,
        data.name,
        data.productType,
        data.brand ?? null,
        data.couponCode ?? null,
        data.status,
        data.description ?? null,
        data.imageUrl ?? null,
      ]
    );
    return result.rows[0] ? mapProductRow(result.rows[0]) : null;
  },

  setStatus: async (
    id: string,
    status: ProductStatus
  ): Promise<IProduct | null> => {
    const result = await pool.query<ProductRow>(
      `UPDATE products
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, sku_code, name, product_type, brand, coupon_code, status,
                 description, image_url, created_at, updated_at`,
      [id, status]
    );
    return result.rows[0] ? mapProductRow(result.rows[0]) : null;
  },
};
