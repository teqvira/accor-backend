import { PoolClient } from 'pg';
import pool from '../../../database/connection';
import {
  ApprovalStatus,
  CreateUserData,
  IUser,
  mapUserRow,
  UpdateUserData,
  UserRole,
  UserType,
} from '../user.types';

type Queryable = Pick<PoolClient, 'query'>;

const USER_PUBLIC_COLUMNS = `
  id, name, email, mobile_number, wallet_balance, reward_points,
  role, is_active, is_verified, approval_status,
  avatar_url, date_of_birth, city, state, user_type, profile_completed,
  pincode, garage_id, garage_role, garage_name, garage_owner_name,
  created_at, updated_at
`;

const USER_COLUMNS_WITH_PASSWORD = `
  id, name, email, mobile_number, password_hash, wallet_balance, reward_points,
  role, is_active, is_verified, approval_status,
  avatar_url, date_of_birth, city, state, user_type, profile_completed,
  pincode, garage_id, garage_role, garage_name, garage_owner_name,
  created_at, updated_at
`;

function mapOptionalRow(
  row: Parameters<typeof mapUserRow>[0] | undefined
): IUser | null {
  return row ? mapUserRow(row) : null;
}

type UserRow = Parameters<typeof mapUserRow>[0] & {
  password_hash?: string | null;
};

export interface PartnerListRow extends UserRow {
  qr_scan_count?: string | number;
  rewards_earned?: string | number;
  cash_redeemed?: string | number;
  aadhaar_url?: string | null;
  pan_url?: string | null;
}

export interface PartnerListItem extends IUser {
  qrScanCount: number;
  rewardsEarned: number;
  cashRedeemed: number;
  documents: {
    aadhaarUrl: string | null;
    panUrl: string | null;
  };
}

function mapPartnerRow(row: PartnerListRow): PartnerListItem {
  return {
    ...mapUserRow(row),
    qrScanCount: Number(row.qr_scan_count ?? 0),
    rewardsEarned: Number(row.rewards_earned ?? 0),
    cashRedeemed: Number(row.cash_redeemed ?? 0),
    documents: {
      aadhaarUrl: row.aadhaar_url ?? null,
      panUrl: row.pan_url ?? null,
    },
  };
}

const PARTNER_USER_COLUMNS = `
  u.id, u.name, u.email, u.mobile_number, u.wallet_balance, u.reward_points,
  u.role, u.is_active, u.is_verified, u.approval_status,
  u.avatar_url, u.date_of_birth, u.city, u.state, u.user_type, u.profile_completed,
  u.pincode, u.garage_id, u.garage_role, u.garage_name, u.garage_owner_name,
  u.created_at, u.updated_at
`;

const PARTNER_SELECT = `
  ${PARTNER_USER_COLUMNS},
  COALESCE(scans.qr_scan_count, '0') AS qr_scan_count,
  COALESCE(scans.rewards_earned, '0') AS rewards_earned,
  COALESCE((
    SELECT SUM(w.amount) FROM withdrawals w
    WHERE w.user_id = u.id AND w.status = 'success'
  ), 0)::text AS cash_redeemed,
  (
    SELECT ud.document_front FROM user_documents ud
    WHERE ud.user_id = u.id AND ud.document_type = 'aadhaar'
    ORDER BY ud.created_at DESC LIMIT 1
  ) AS aadhaar_url,
  (
    SELECT ud.document_front FROM user_documents ud
    WHERE ud.user_id = u.id AND ud.document_type = 'pan'
    ORDER BY ud.created_at DESC LIMIT 1
  ) AS pan_url
`;

const PARTNER_SCAN_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::text AS qr_scan_count,
      COALESCE(SUM(rt.wallet_amount), 0)::text AS rewards_earned
    FROM redemption_transactions rt
    WHERE rt.user_id = u.id
  ) scans ON true
`;

export const userRepository = {
  findById: async (
    id: string,
    options?: { includePassword?: boolean; client?: Queryable }
  ): Promise<IUser | null> => {
    const db = options?.client ?? pool;
    const columns = options?.includePassword
      ? USER_COLUMNS_WITH_PASSWORD
      : USER_PUBLIC_COLUMNS;
    const result = await db.query<UserRow>(
      `SELECT ${columns} FROM users WHERE id = $1`,
      [id]
    );
    return mapOptionalRow(result.rows[0]);
  },

  findByEmail: async (
    email: string,
    options?: { includePassword?: boolean }
  ): Promise<IUser | null> => {
    const columns = options?.includePassword
      ? USER_COLUMNS_WITH_PASSWORD
      : USER_PUBLIC_COLUMNS;
    const result = await pool.query<UserRow>(
      `SELECT ${columns} FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    return mapOptionalRow(result.rows[0]);
  },

  findByMobile: async (
    mobileNumber: string,
    options?: { includePassword?: boolean }
  ): Promise<IUser | null> => {
    const columns = options?.includePassword
      ? USER_COLUMNS_WITH_PASSWORD
      : USER_PUBLIC_COLUMNS;
    const result = await pool.query<UserRow>(
      `SELECT ${columns} FROM users WHERE mobile_number = $1`,
      [mobileNumber]
    );
    return mapOptionalRow(result.rows[0]);
  },

  create: async (data: CreateUserData): Promise<IUser> => {
    const result = await pool.query<UserRow>(
      `INSERT INTO users
         (name, email, mobile_number, password_hash, role, is_verified,
          approval_status, city, state, user_type, profile_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${USER_PUBLIC_COLUMNS}`,
      [
        data.name ?? null,
        data.email?.toLowerCase() ?? null,
        data.mobileNumber ?? null,
        data.password ?? null,
        data.role ?? UserRole.USER,
        data.isVerified ?? false,
        data.approvalStatus ?? 'pending',
        data.city ?? null,
        data.state ?? null,
        data.userType ?? null,
        data.profileCompleted ?? false,
      ]
    );
    return mapUserRow(result.rows[0]);
  },

  update: async (
    id: string,
    data: UpdateUserData,
    options?: { client?: Queryable }
  ): Promise<IUser | null> => {
    const db = options?.client ?? pool;
    const sets: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    if (data.name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.email !== undefined) {
      sets.push(`email = $${paramIndex++}`);
      values.push(data.email?.toLowerCase() ?? null);
    }
    if (data.mobileNumber !== undefined) {
      sets.push(`mobile_number = $${paramIndex++}`);
      values.push(data.mobileNumber ?? null);
    }
    if (data.password !== undefined) {
      sets.push(`password_hash = $${paramIndex++}`);
      values.push(data.password);
    }
    if (data.role !== undefined) {
      sets.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }
    if (data.isActive !== undefined) {
      sets.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }
    if (data.isVerified !== undefined) {
      sets.push(`is_verified = $${paramIndex++}`);
      values.push(data.isVerified);
    }
    if (data.approvalStatus !== undefined) {
      sets.push(`approval_status = $${paramIndex++}`);
      values.push(data.approvalStatus);
    }
    if (data.avatarUrl !== undefined) {
      sets.push(`avatar_url = $${paramIndex++}`);
      values.push(data.avatarUrl);
    }
    if (data.dateOfBirth !== undefined) {
      sets.push(`date_of_birth = $${paramIndex++}`);
      values.push(data.dateOfBirth);
    }
    if (data.city !== undefined) {
      sets.push(`city = $${paramIndex++}`);
      values.push(data.city);
    }
    if (data.state !== undefined) {
      sets.push(`state = $${paramIndex++}`);
      values.push(data.state);
    }
    if (data.userType !== undefined) {
      sets.push(`user_type = $${paramIndex++}`);
      values.push(data.userType);
    }
    if (data.pincode !== undefined) {
      sets.push(`pincode = $${paramIndex++}`);
      values.push(data.pincode);
    }
    if (data.garageId !== undefined) {
      sets.push(`garage_id = $${paramIndex++}`);
      values.push(data.garageId);
    }
    if (data.garageRole !== undefined) {
      sets.push(`garage_role = $${paramIndex++}`);
      values.push(data.garageRole);
    }
    if (data.garageName !== undefined) {
      sets.push(`garage_name = $${paramIndex++}`);
      values.push(data.garageName);
    }
    if (data.garageOwnerName !== undefined) {
      sets.push(`garage_owner_name = $${paramIndex++}`);
      values.push(data.garageOwnerName);
    }
    if (data.profileCompleted !== undefined) {
      sets.push(`profile_completed = $${paramIndex++}`);
      values.push(data.profileCompleted);
    }

    if (sets.length === 0) {
      return userRepository.findById(id, { client: options?.client });
    }

    const result = await db.query<UserRow>(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING ${USER_PUBLIC_COLUMNS}`,
      values
    );
    return mapOptionalRow(result.rows[0]);
  },

  markVerified: async (id: string): Promise<IUser | null> => {
    const result = await pool.query<UserRow>(
      `UPDATE users
       SET is_verified = true, updated_at = NOW()
       WHERE id = $1
       RETURNING ${USER_PUBLIC_COLUMNS}`,
      [id]
    );
    return mapOptionalRow(result.rows[0]);
  },

  updatePassword: async (id: string, password: string): Promise<void> => {
    await pool.query(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
      [id, password]
    );
  },

  findAll: async (
    page = 1,
    limit = 20,
    filters: {
      role?: UserRole;
      isActive?: boolean;
      isVerified?: boolean;
      search?: string;
    } = {}
  ): Promise<{ items: IUser[]; total: number }> => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.role) {
      conditions.push(`role = $${paramIndex++}`);
      values.push(filters.role);
    }
    if (filters.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(filters.isActive);
    }
    if (filters.isVerified !== undefined) {
      conditions.push(`is_verified = $${paramIndex++}`);
      values.push(filters.isVerified);
    }
    if (filters.search) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR mobile_number ILIKE $${paramIndex})`
      );
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const [itemsResult, countResult] = await Promise.all([
      pool.query<UserRow>(
        `SELECT ${USER_PUBLIC_COLUMNS}
         FROM users
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...values, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users ${whereClause}`,
        values
      ),
    ]);

    return {
      items: itemsResult.rows.map(mapUserRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  findPartners: async (
    page = 1,
    limit = 20,
    filters: {
      userType?: UserType;
      approvalStatus?: ApprovalStatus;
      search?: string;
    } = {}
  ): Promise<{ items: PartnerListItem[]; total: number }> => {
    const conditions: string[] = [`u.role = 'user'`];
    const values: unknown[] = [];
    let i = 1;

    if (filters.userType) {
      conditions.push(`u.user_type = $${i++}`);
      values.push(filters.userType);
    }
    if (filters.approvalStatus) {
      conditions.push(`u.approval_status = $${i++}`);
      values.push(filters.approvalStatus);
    }
    if (filters.search) {
      conditions.push(
        `(u.name ILIKE $${i} OR u.email ILIKE $${i} OR u.mobile_number ILIKE $${i} OR u.city ILIKE $${i})`
      );
      values.push(`%${filters.search}%`);
      i++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * limit;

    const [itemsResult, countResult] = await Promise.all([
      pool.query<PartnerListRow>(
        `SELECT ${PARTNER_SELECT}
         FROM (
           SELECT ${PARTNER_USER_COLUMNS}
           FROM users u
           ${where}
           ORDER BY u.created_at DESC
           LIMIT $${i++} OFFSET $${i}
         ) u
         ${PARTNER_SCAN_LATERAL}`,
        [...values, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users u ${where}`,
        values
      ),
    ]);

    return {
      items: itemsResult.rows.map(mapPartnerRow),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  },

  findPartnerById: async (id: string): Promise<PartnerListItem | null> => {
    const result = await pool.query<PartnerListRow>(
      `SELECT ${PARTNER_SELECT}
       FROM users u
       ${PARTNER_SCAN_LATERAL}
       WHERE u.id = $1 AND u.role = 'user'`,
      [id]
    );
    return result.rows[0] ? mapPartnerRow(result.rows[0]) : null;
  },

  getPartnerStats: async (): Promise<{
    totalPartners: number;
    dealers: number;
    mechanics: number;
    pendingApprovals: number;
  }> => {
    const result = await pool.query<{
      total: string;
      dealers: string;
      mechanics: string;
      pending: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'user')::text AS total,
        COUNT(*) FILTER (WHERE role = 'user' AND user_type = 'dealer')::text AS dealers,
        COUNT(*) FILTER (WHERE role = 'user' AND user_type = 'mechanic')::text AS mechanics,
        COUNT(*) FILTER (WHERE role = 'user' AND approval_status = 'pending')::text AS pending
      FROM users
    `);
    const row = result.rows[0];
    return {
      totalPartners: Number(row.total),
      dealers: Number(row.dealers),
      mechanics: Number(row.mechanics),
      pendingApprovals: Number(row.pending),
    };
  },

  countAdmins: async (): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users
       WHERE role IN ($1, $2)`,
      [UserRole.SUPER_ADMIN, UserRole.ADMIN]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  countUsersByRole: async (role: UserRole): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users WHERE role = $1`,
      [role]
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  findByIdForUpdate: async (
    id: string,
    client: Queryable
  ): Promise<IUser | null> => {
    const result = await client.query<UserRow>(
      `SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return mapOptionalRow(result.rows[0]);
  },

  updateWalletAndPoints: async (
    id: string,
    walletDelta: number,
    pointsDelta: number,
    client?: Queryable
  ): Promise<IUser | null> => {
    const db = client ?? pool;
    const result = await db.query<UserRow>(
      `UPDATE users
       SET wallet_balance = wallet_balance + $2,
           reward_points = reward_points + $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${USER_PUBLIC_COLUMNS}`,
      [id, walletDelta, pointsDelta]
    );
    return mapOptionalRow(result.rows[0]);
  },

  upsertOwnerGarage: async (
    ownerId: string,
    name: string,
    client?: Queryable
  ): Promise<string> => {
    const db = client ?? pool;
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM garages WHERE owner_id = $1`,
      [ownerId]
    );
    if (existing.rows[0]) {
      await db.query(
        `UPDATE garages SET name = $2, updated_at = NOW() WHERE owner_id = $1`,
        [ownerId, name]
      );
      return existing.rows[0].id;
    }
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO garages (name, owner_id) VALUES ($1, $2) RETURNING id`,
      [name, ownerId]
    );
    return inserted.rows[0].id;
  },

  findGarageOwnerForWorker: async (
    worker: IUser,
    client?: Queryable
  ): Promise<IUser | null> => {
    const db = client ?? pool;
    if (worker.garageRole !== 'worker') return null;

    if (worker.garageId) {
      const byGarage = await db.query<UserRow>(
        `SELECT ${USER_PUBLIC_COLUMNS}
         FROM users
         WHERE id = (SELECT owner_id FROM garages WHERE id = $1)
         LIMIT 1`,
        [worker.garageId]
      );
      if (byGarage.rows[0]) return mapUserRow(byGarage.rows[0]);
    }

    const garageName = worker.garageName?.trim();
    const ownerName = worker.garageOwnerName?.trim();
    if (!garageName || !ownerName) return null;

    const byName = await db.query<UserRow>(
      `SELECT ${USER_PUBLIC_COLUMNS}
       FROM users
       WHERE role = 'user'
         AND garage_role = 'owner'
         AND LOWER(TRIM(garage_name)) = LOWER(TRIM($1))
         AND LOWER(TRIM(name)) = LOWER(TRIM($2))
       ORDER BY updated_at DESC
       LIMIT 1`,
      [garageName, ownerName]
    );
    return mapOptionalRow(byName.rows[0]);
  },
};
